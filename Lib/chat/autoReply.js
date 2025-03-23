import config from '../../Config.js';
import message from './messageHandler.js';
import { downloadMedia } from '../Functions/Download_Functions/downloader.js';
import fs from 'fs';
import path from 'path';
import { saveLink } from '../utils/linkStorage.js';
import { processMessageWithAI } from '../ai/aiHandler.js';
import { filterThinkingPart } from '../ai/groq.js';

/**
 * Get message type from the message object
 */
function getMessageType(m) {
    if (m.message?.imageMessage) return 'image';
    if (m.message?.videoMessage) return 'video';
    if (m.message?.stickerMessage) return 'sticker';
    if (m.message?.audioMessage) return 'audio';
    if (m.message?.documentMessage) return 'document';
    if (m.message?.conversation || m.message?.extendedTextMessage?.text) return 'text';
    return 'unknown';
}

/**
 * Get message text from various message types
 */
function getMessageText(m) {
    return (m.message?.conversation || 
           m.message?.extendedTextMessage?.text || 
           m.message?.imageMessage?.caption ||
           m.message?.videoMessage?.caption || "").trim();
}

// Add a helper to track users we've interacted with
const interactedUsers = new Set();

/**
 * Check if this is a first-time interaction with this user
 * @param {string} userId - The user's JID
 * @returns {boolean} - True if this is the first interaction
 */
function isFirstTimeInteraction(userId) {
    if (interactedUsers.has(userId)) {
        return false;
    }
    
    // Mark as interacted
    interactedUsers.add(userId);
    return true;
}

/**
 * Detect social media links in a message
 * @param {string} text - Message text
 * @returns {Object|null} - Link info or null if no link found
 */
function detectSocialMediaLink(text) {
    // Clean the URL if it contains whitespace or surrounding characters
    const cleanedText = text.replace(/\n/g, ' ').trim();
    
    // Extract URLs from text
    const urlMatch = cleanedText.match(/https?:\/\/[^\s]+/i);
    if (!urlMatch) return null;
    
    const url = urlMatch[0];
    
    // Detect platform based on URL
    if (url.match(/youtu\.?be/i)) {
        return { platform: 'youtube', url };
    } else if (url.match(/instagram\.com\/(p|reel|stories|tv)\/|instagr\.am\/(p|reel|stories|tv)\/|instagram\.com\/[^\/]+\/(p|reel|stories|tv)\/|ig\.me/i)) {
        // Enhanced Instagram pattern to match all link formats:
        // - instagram.com/p/CODE/
        // - instagram.com/reel/CODE/
        // - instagram.com/stories/USER/CODE/
        // - instagram.com/tv/CODE/
        // - instagr.am/... (shortened URLs)
        // - instagram.com/USERNAME/p/CODE/ (profile-specific posts)
        // - ig.me/... (shortened URLs)
        return { platform: 'instagram', url };
    } else if (url.match(/tiktok\.com|vm\.tiktok\.com|vt\.tiktok\.com/i)) {
        return { platform: 'tiktok', url };
    } else if (url.match(/facebook\.com\/|fb\.watch\/|fb\.me\/|facebook\.com\/watch/i)) {
        return { platform: 'facebook', url };
    } else if (url.match(/twitter\.com\/|t\.co\/|x\.com\//i)) {
        return { platform: 'twitter', url };
    }
    
    return null;
}

/**
 * Extract URLs from message text
 */
function extractUrls(text) {
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

/**
 * Handle media download from social media links
 */
async function handleMediaDownload(m, sock, link) {
    try {
        // Extract message info
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const groupId = isGroup ? m.key.remoteJid : null;
        
        // Check if group is allowed for downloads
        let isAllowed = !isGroup; // Individual chats always allowed
        if (isGroup && config.ALLOWED_DOWNLOAD_GROUPS) {
            isAllowed = config.ALLOWED_DOWNLOAD_GROUPS.includes(groupId);
            console.log(`Group ${groupId} allowed: ${isAllowed}`);
        }
        
        // If not allowed and link saving is enabled, save link instead of downloading
        if (!isAllowed && config.ENABLE_LINK_SAVING === true) {
            await message.reply(`Media download not enabled for this group. I've saved this link for you.`, m, sock);
            await saveSocialMediaLink(m, link.url, link.platform);
            return;
        }
        
        // If not allowed and link saving is disabled, just inform
        if (!isAllowed) {
            await message.reply(`Media download is not enabled for this group.`, m, sock);
            return;
        }
        
        // React to the message to indicate download started
        await message.react(reactionEmojis.downloading, m, sock);
        
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', m.key.remoteJid);
        
        // Download the media
        console.log(`Starting ${link.platform} download: ${link.url}`);
        
        // For YouTube, first check if audio requested
        const isAudioRequest = 
            m.message?.conversation?.toLowerCase().includes('audio') || 
            (m.message?.extendedTextMessage?.text && 
             m.message.extendedTextMessage.text.toLowerCase().includes('audio'));
        
        const options = {
            isAudio: isAudioRequest && link.platform === 'youtube'
        };
        
        const downloadedPath = await downloadMedia(link.url, link.platform, options);
        
        // Add delay to avoid quick successive messages
        await new Promise(r => setTimeout(r, 1000));
        
        if (options.isAudio) {
            // Send as audio
            await message.sendAudio(downloadedPath, true, m, sock);
        } else if (link.platform === 'youtube' || 
                 link.platform === 'facebook' || 
                 link.platform === 'tiktok' ||
                 link.platform === 'instagram') {
            // Send as video
            await message.sendVideo(downloadedPath, `Here's your ${link.platform} video`, m, sock);
        } else {
            // Send as file for anything else
            await message.sendDocument(
                downloadedPath,
                `${link.platform}_media.mp4`,
                'video/mp4',
                m, sock
            );
        }
        
        // React to indicate success
        await message.react(reactionEmojis.success, m, sock);
        
    } catch (error) {
        console.error(`Error downloading media: ${error}`);
        
        // React to indicate error and inform user
        await message.react(reactionEmojis.error, m, sock);
        await message.reply(`Sorry, I couldn't download that media: ${error.message}`, m, sock);
    }
}

/**
 * Check if group is allowed for auto-downloads
 * @param {string} groupId - The group ID to check
 * @returns {boolean} - True if group is allowed, false otherwise
 */
function isGroupAllowedForDownloads(groupId) {
    // If not a group, return false as we only want downloads in groups
    if (!groupId.endsWith('@g.us')) {
        return false;
    }
    
    // Get the latest allowed groups directly from config
    const allowedGroups = config.ALLOWED_DOWNLOAD_GROUPS;
    console.log(`Checking if group ${groupId} is in allowed list:`, allowedGroups);
    
    // If no specific groups are specified, allow all groups
    if (!allowedGroups || allowedGroups.length === 0) {
        console.log('No specific groups configured, allowing all groups');
        return true;
    }
    
    // Check if the group is in the allowed list
    const isAllowed = allowedGroups.includes(groupId);
    console.log(`Group ${groupId} allowed: ${isAllowed}`);
    return isAllowed;
}

/**
 * Check if a group is allowed for AI auto-replies
 * @param {string} groupId - The group ID to check
 * @returns {boolean} - True if group is allowed, false otherwise
 */
function isGroupAllowedForAI(groupId) {
    // If not a group, always allow - personal chats always get AI responses
    if (!groupId.endsWith('@g.us')) {
        return true;
    }
    
    // Get the list of allowed groups for AI
    const allowedGroups = config.AI_ALLOWED_GROUPS;
    console.log(`Checking if group ${groupId} is in AI allowed list:`, allowedGroups);
    
    // If no specific groups are specified, don't allow AI in any group
    if (!allowedGroups || allowedGroups.length === 0) {
        console.log('No groups allowed for AI auto-reply');
        return false;
    }
    
    // Check if the group is in the allowed list
    const isAllowed = allowedGroups.includes(groupId);
    console.log(`Group ${groupId} allowed for AI: ${isAllowed}`);
    return isAllowed;
}

/**
 * Main auto-reply handler
 */
export async function handleAutoReply(m, sock) {
    // Early return if autoReply is disabled or bot is paused
    if (!config.ENABLE_AUTO_REPLY || config.BOT_PAUSED || config.MAINTENANCE_MODE) {
        return false;
    }
    
    try {
        // Skip if message is from the bot itself
        if (m.key.fromMe === true) {
            return false;
        }
        
        const messageType = getMessageType(m);
        const messageText = getMessageText(m);
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        // Social media link processing - only in groups
        if (messageType === 'text' && isGroup) {
            const urls = extractUrls(messageText);
            
            for (const url of urls) {
                const platform = detectPlatform(url);
                if (platform) {
                    // If social media downloads are enabled and group is allowed, download directly
                    if (config.ENABLE_SOCIAL_MEDIA_DOWNLOAD && isGroupAllowedForDownloads(m.key.remoteJid)) {
                        await handleMediaDownload(m, sock, url, platform);
                        return true;
                    } 
                    // If link saving is enabled but downloads are disabled, save the link
                    else if (config.ENABLE_LINK_SAVING) {
                        // Get sender info
                        const sender = m.key.participant || m.key.remoteJid;
                        const senderName = m.pushName || 'Unknown';
                        
                        // Prepare link data
                        const linkData = {
                            url: url,
                            platform: platform,
                            timestamp: Date.now(),
                            sender: sender,
                            senderName: senderName,
                            groupId: m.key.remoteJid,
                            messageText: messageText
                        };
                        
                        // Try to get group name
                        try {
                            const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
                            linkData.groupName = groupMetadata.subject;
                        } catch (error) {
                            console.log('Could not fetch group metadata:', error.message);
                            linkData.groupName = 'Unknown Group';
                        }
                        
                        // Save the link
                        const saved = saveLink(linkData);
                        
                        // Reply with a message
                        if (saved) {
                            await message.reply(`📥 Link from ${platform} saved. It will be processed when downloads are enabled.\n\nUse .savedlinks to view all saved links.`, m, sock);
                            await message.react('📋', m, sock);
                        } else {
                            await message.reply(`This link has already been saved for future download.`, m, sock);
                        }
                        
                        return true;
                    }
                }
            }
        }
        
        // Auto media download feature (for media messages)
        if (config.ENABLE_AUTO_MEDIA_DOWNLOAD && 
            ['image', 'video', 'audio', 'document'].includes(messageType) && 
            isGroupAllowedForDownloads(m.key.remoteJid)) {
            // React to acknowledge receipt
            await message.react('📥', m, sock);
            return true;
        }
        
        // AI-powered auto-reply for text messages
        if (messageType === 'text' && messageText) {
            // Skip AI processing if message starts with command prefix
            if (messageText.startsWith(config.PREFIX)) {
                return false;
            }
            
            // Check if this chat is allowed to use AI
            if (isGroup && !isGroupAllowedForAI(m.key.remoteJid)) {
                // This group is not in the allowed list for AI
                return false;
            }
            
            // For groups, still require bot to be mentioned or it's a direct reply to bot's message
            if (isGroup) {
                const isBotMentioned = messageText.includes('@' + sock.user.id.split(':')[0]) || 
                                      messageText.toLowerCase().includes(config.BOT_NAME.toLowerCase());
                                      
                const isReplyToBot = m.message?.extendedTextMessage?.contextInfo?.participant === sock.user.id;
                
                if (!isBotMentioned && !isReplyToBot) {
                    return false;
                }
            }
            
            
            
            try {
                // Process with AI
                await message.react('🤖', m, sock); // React to show AI is processing
                
                // Check if AI and Search are both enabled
                if (config.ENABLE_AI_AUTO_REPLY) {
                    // Call with the correct parameter order
                    let aiResponse = await processMessageWithAI(m, sock, messageText);
                    
                    // Make sure to filter thinking parts before sending reply
                    if (aiResponse) {
                        // Apply safety filter
                        aiResponse = filterThinkingPart(aiResponse);
                    }
                    
                    // Check if the response is suggesting a command and that command exists
                    const commandMatch = aiResponse.match(new RegExp(`${config.PREFIX}(\\w+)`));
                    if (commandMatch && commandMatch[1]) {
                        const suggestedCommand = commandMatch[1];
                        
                        // Send the AI response with the command suggestion
                        await message.reply(aiResponse, m, sock);
                        
                        // Add a subtle hint to try the command
                        setTimeout(async () => {
                            await message.react('💡', m, sock);
                        }, 500);
                    } else {
                        // Regular response without command suggestion
                        await message.reply(aiResponse, m, sock);
                    }
                    
                    await message.react('✅', m, sock); // Change reaction when done
                    

                    
                    return true;
                }
                // Fall back to simple auto-responses if AI is disabled
            } catch (error) {
                console.error('Error processing AI response:', error);
                // Clear typing indicator on error
                
                // Fall back to simple auto-responses if AI fails
            }
        }
        
        // Simple auto-responses as fallback
        if (messageType === 'text') {
            // const greetings = ['hi', 'hello', 'hey', 'hola', 'howdy'];
            
            // if (greetings.includes(messageText.toLowerCase())) {
            //     await message.reply(`Hello! How can I help you today? Use ${config.PREFIX}menu to see available commands.`, m, sock);
            //     return true;
            // }
            
            // // Add more auto-reply patterns as needed
            
        } else if (messageType === 'sticker') {
            // // Maybe react to stickers
            // await message.react('👍', m, sock);
            // return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error in handleAutoReply:', error);
        // Clear typing indicator on error
        await message.react('❌', m, sock);
        return false;
    }
}

/**
 * Process message with AI
 */
export async function processWithAI(m, sock) {
    try {
        const messageText = getMessageText(m);
        const sender = m.key.remoteJid;
        
        // Ensure messageText is a string
        if (!messageText || typeof messageText !== 'string') {
            console.warn(`Attempted to process non-string message with AI: ${typeof messageText}`);
            return false;
        }
        
        // Set typing indicator safely
        try {
            if (sock && typeof sock.sendPresenceUpdate === 'function') {
                await sock.sendPresenceUpdate('composing', sender);
            }
        } catch (e) {
            console.error(`Error setting typing indicator: ${e.message}`);
        }
        
        // Check if this is a first-time interaction and log it
        const isFirstTime = isFirstTimeInteraction(sender);
        if (isFirstTime) {
            console.log(`First time interaction with user: ${sender}`);
        }
        
        // Process with AI, passing the correct parameter order: m, sock, messageText
        const response = await processMessageWithAI(m, sock, messageText);
        
        // Send the AI response
        await message.reply(response, m, sock);
        
        // Clear typing indicator safely
        try {
            if (sock && typeof sock.sendPresenceUpdate === 'function') {
                await sock.sendPresenceUpdate('paused', sender);
            }
        } catch (e) {
            console.error(`Error clearing typing indicator: ${e.message}`);
        }
        
        return true;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        return false;
    }
}