import config from '../../Config.js';
import message from './messageHandler.js';
import { downloadMedia } from '../Functions/Download_Functions/downloader.js';
import fs from 'fs';
import path from 'path';
import { saveLink } from '../utils/linkStorage.js';
import { processMessageWithAI } from '../ai/aiHandler.js';

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
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    return text.match(urlRegex) || [];
}

/**
 * Handle social media download based on detected platform
 */
async function handleMediaDownload(m, sock, url, platform) {
    try {
        await message.react('⏳', m, sock);
        
        // Download media, which will now include optimization
        let mediaPath;
        try {
            // For YouTube, check if it's an audio request (if URL contains &audio or ?audio)
            const isAudioRequest = url.includes('audio');
            
            // Get compression settings from config
            const compressionLevel = config.MEDIA_COMPRESSION_LEVEL;
            const maxResolution = config.MAX_VIDEO_RESOLUTION;
            
            mediaPath = await downloadMedia(url, platform, { 
                isAudio: platform === 'YouTube' && isAudioRequest,
                compressionLevel: compressionLevel,
                maxResolution: maxResolution
            });
        } catch (error) {
            await message.react('❌', m, sock);
            return await message.reply(`Failed to download media from ${platform}: ${error.message}`, m, sock);
        }
        
        if (!mediaPath) {
            await message.react('❌', m, sock);
            return await message.reply(`Failed to download media from ${platform}`, m, sock);
        }
        
        // Send the appropriate media type based on file extension and platform
        try {
            console.log(`Sending media from ${platform}, path: ${mediaPath}`);
            
            if (mediaPath.endsWith('.mp3')) {
                // Send as audio
                await message.sendAudio(mediaPath, false, m, sock);
            } else if (mediaPath.endsWith('.mp4')) {
                // Send as video with proper attribution
                await message.sendVideo(mediaPath, "", m, sock);
            } else if (mediaPath.endsWith('.jpg') || mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.png')) {
                // Send as image
                await message.sendImage(mediaPath, "", m, sock);
            } else {
                // Send as document for other formats
                await message.sendDocument(
                    mediaPath, 
                    `${platform}_media${path.extname(mediaPath)}`,
                    null,
                    m, 
                    sock
                );
            }
            
            // Delete the file after sending to save space
            if (fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
                console.log(`Deleted temporary file: ${mediaPath}`);
            }
            
            await message.react('✅', m, sock);
        } catch (sendError) {
            console.error(`Error sending ${platform} media:`, sendError);
            await message.react('❌', m, sock);
            await message.reply(`Error sending media: ${sendError.message}`, m, sock);
            
            // Clean up file if sending fails
            if (fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
            }
        }
    } catch (error) {
        console.error(`Error downloading from ${platform}:`, error);
        await message.react('❌', m, sock);
        await message.reply(`Failed to download: ${error.message}`, m, sock);
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
                    const aiResponse = await processMessageWithAI(m, messageText, sock);
                    
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