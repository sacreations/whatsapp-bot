import config from '../../Config.js';
import message from './messageHandler.js';
import { downloadMedia } from '../Functions/Download_Functions/downloader.js';
import fs from 'fs';
import path from 'path';
import { saveLink } from '../utils/linkStorage.js';
import { processMessageWithAI } from '../ai/aiHandler.js';
import { filterThinkingPart } from '../ai/groq.js';

// Track processed messages to prevent duplicate processing
const processedMessages = new Map();

// Set expiration time for processed message tracking (5 minutes)
const MESSAGE_TRACKING_EXPIRATION = 5 * 60 * 1000;

/**
 * Periodically clean up the processed messages map to prevent memory leaks
 */
setInterval(() => {
    const now = Date.now();
    for (const [key, timestamp] of processedMessages.entries()) {
        if (now - timestamp > MESSAGE_TRACKING_EXPIRATION) {
            processedMessages.delete(key);
        }
    }
}, 60 * 1000); // Clean up every minute

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
 * Detect social media platform from URL
 */
function detectPlatform(url) {
    const platforms = [
        { name: 'YouTube', regex: /youtu\.?be(.com)?/ },
        { name: 'TikTok', regex: /tiktok\.com/ },
        { name: 'Instagram', regex: /instagram\.com/ },
        { name: 'Facebook', regex: /facebook\.com|fb\.watch/ },
        { name: 'Twitter', regex: /twitter\.com|x\.com/ }
    ];
    
    for (const platform of platforms) {
        if (platform.regex.test(url)) {
            return platform.name;
        }
    }
    
    return null;
}

/**
 * Extract URLs from message text
 */
function extractUrls(text) {
    // More robust URL extraction regex
    const urlRegex = /(https?:\/\/[^\s\"\'\<\>\(\)]+)/g;
    
    // Find all matches
    const matches = text.match(urlRegex) || [];
    
    // Filter duplicates by creating a Set and converting back to array
    return [...new Set(matches)];
}

/**
 * Handle social media download based on detected platform
 */
async function handleMediaDownload(m, sock, url, platform) {
    // Create a unique ID for this download request
    const downloadId = `${m.key.id}_${url}`;
    
    // Check if we're already processing this download
    if (processedMessages.has(downloadId)) {
        console.log(`Skipping duplicate download request: ${url}`);
        return false;
    }
    
    // Mark this download as being processed
    processedMessages.set(downloadId, Date.now());
    
    try {
        await message.react('⏳', m, sock);
        
        // Download media, which will now include optimization
        let mediaResult;
        try {
            // For YouTube, check if it's an audio request (if URL contains &audio or ?audio)
            const isAudioRequest = url.includes('audio');
            
            // Get compression settings from config
            const compressionLevel = config.MEDIA_COMPRESSION_LEVEL;
            const maxResolution = config.MAX_VIDEO_RESOLUTION;
            
            console.log(`Starting download for ${platform}: ${url}`);
            mediaResult = await downloadMedia(url, platform, m, { 
                isAudio: platform === 'YouTube' && isAudioRequest,
                compressionLevel: compressionLevel,
                maxResolution: maxResolution,
                sock: sock // Pass the sock object to downloadMedia
            });
            
            // Extract the media path from the result
            const mediaPath = mediaResult.url;
            const isLocalFile = mediaResult.isLocalFile;
            
            console.log(`Download completed: ${mediaPath} (isLocalFile: ${isLocalFile})`);
        } catch (error) {
            await message.react('❌', m, sock);
            await message.reply(`Failed to download media from ${platform}: ${error.message}`, m, sock);
            return false;
        }
        
        if (!mediaResult || !mediaResult.url) {
            await message.react('❌', m, sock);
            await message.reply(`Failed to download media from ${platform}`, m, sock);
            return false;
        }
        
        const mediaPath = mediaResult.url;
        const isLocalFile = mediaResult.isLocalFile;
        
        // Send the appropriate media type based on file extension and platform
        try {
            console.log(`Sending media from ${platform}, path: ${mediaPath}`);

            await message.sendVideo(mediaPath, "", m, sock);
            
            // Delete the file after sending to save space (only if it's a local file)
            if (isLocalFile && fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
                console.log(`Deleted temporary file: ${mediaPath}`);
            }
            
            await message.react('✅', m, sock);
            return true;
        } catch (sendError) {
            console.error(`Error sending ${platform} media:`, sendError);
            await message.react('❌', m, sock);
            await message.reply(`Error sending media: ${sendError.message}`, m, sock);
            
            // Clean up file if sending fails (only if it's a local file)
            if (isLocalFile && fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
            }
            return false;
        }
    } catch (error) {
        console.error(`Error downloading from ${platform}:`, error);
        await message.react('❌', m, sock);
        await message.reply(`Failed to download: ${error.message}`, m, sock);
        return false;
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
        
        // Check if we've already processed this message
        if (processedMessages.has(m.key.id)) {
            console.log(`Skipping already processed message: ${m.key.id}`);
            return false;
        }
        
        // Mark this message as processed
        processedMessages.set(m.key.id, Date.now());
        
        const messageType = getMessageType(m);
        const messageText = getMessageText(m);
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        // Social media link processing - only in groups
        if (messageType === 'text' && isGroup) {
            const urls = extractUrls(messageText);
            
            // Process only one social media URL per message to avoid multiple downloads
            let handledSocialMedia = false;
            
            for (const url of urls) {
                const platform = detectPlatform(url);
                if (platform && !handledSocialMedia) {
                    // If social media downloads are enabled and group is allowed, download directly
                    if (config.ENABLE_SOCIAL_MEDIA_DOWNLOAD && isGroupAllowedForDownloads(m.key.remoteJid)) {
                        const success = await handleMediaDownload(m, sock, url, platform);
                        if (success) {
                            handledSocialMedia = true;
                        }
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
                            handledSocialMedia = true;
                        } else {
                            await message.reply(`This link has already been saved for future download.`, m, sock);
                            handledSocialMedia = true;
                        }
                    }
                }
            }
            
            if (handledSocialMedia) {
                return true;
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
                
                // Enhanced reply detection with debug logging
                let isReplyToBot = false;
                const contextInfo = m.message?.extendedTextMessage?.contextInfo;
                
                if (contextInfo) {
                    // Log the structure to debug
                    console.log("Reply detected, checking if it's to the bot...");
                    console.log("Bot ID:", sock.user.id);
                    console.log("Context participant:", contextInfo.participant);
                    console.log("Context quotedParticipant:", contextInfo.quotedParticipant);
                    console.log("Context stanzaId:", contextInfo.stanzaId);
                    
                    // Check multiple possible locations for the bot ID
                    isReplyToBot = contextInfo.participant === sock.user.id || 
                                  contextInfo.quotedParticipant === sock.user.id ||
                                  (contextInfo.quotedMessage && contextInfo.participant && 
                                   contextInfo.participant.includes(sock.user.id.split(':')[0]));
                }
                
                if (!isBotMentioned && !isReplyToBot) {
                    return false;
                }
            }
            
            
            
            try {
                
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
                        
                        await message.reply(aiResponse, m, sock);
                        
                        setTimeout(async () => {
                            await message.react('💡', m, sock);
                        }, 500);
                    } else {

                        await message.reply(aiResponse, m, sock);
                    }
                    
                    await message.react('✅', m, sock); 
                    

                    
                    return true;
                }
            } catch (error) {
                console.error('Error processing AI response:', error);
            }
        }
        
        // Simple auto-responses as fallback
        if (messageType === 'text') {

        } else if (messageType === 'sticker') {
            
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