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
 * Check if a message should be ignored by auto-reply system
 * @param {string} text - Message text
 * @returns {boolean} - Whether the message should be ignored
 */
function isIgnoredMessage(text) {
    if (!text) return true;
    
    // Common patterns to ignore
    const ignorePatterns = [
        /^[.!#$%&'*+/=?^_`{|}~-]/, // Messages starting with common command prefixes
        /^[\u0600-\u06FF]+$/, // Pure Arabic text (potential spam)
        /^[\u4e00-\u9fa5]+$/, // Pure Chinese text (potential spam)
        /\u200e|\u200f/, // Messages with RTL/LTR markers
        /^(.)\1{4,}/, // Repetitive characters (e.g., "aaaaaa")
        /^[^a-zA-Z0-9\s\u00C0-\u00FF]{5,}$/, // Messages with 5+ special characters
        /^[0-9]{5,}$/, // Messages with 5+ digits
        /^http[s]?:\/\//i, // URLs
        /^sewa/i, // Rental spam
        /^beli/i, // Purchase spam
        /^join/i, // Join group spam
    ];
    
    return ignorePatterns.some(pattern => pattern.test(text));
}

/**
 * Handle auto-reply to user messages using AI
 * @param {Object} m - Message object
 * @param {Object} sock - Socket connection
 */
export async function handleAutoReply(m, sock) {
    try {
        // Check if auto reply is enabled in config
        if (!config.ENABLE_AUTO_REPLY) {
            return false;
        }
        
        // Check if bot is in maintenance mode
        if (config.MAINTENANCE_MODE) {
            return false;
        }
        
        // Extract relevant info from the message
        const fromMe = m.key.fromMe;
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const isStatus = m.key.remoteJid === 'status@broadcast';
        const messageContent = getMessageText(m);
        
        // Skip processing if any of these conditions are met
        if (
            fromMe || 
            isStatus || 
            !messageContent ||
            messageContent.length < 2 ||  // Skip very short messages
            m.message?.protocolMessage ||
            m.message?.reactionMessage
        ) {
            return false;
        }
        
        // Check if message is a command
        if (messageContent.startsWith(config.PREFIX)) {
            return false;
        }

        // Check for ignored message patterns
        if (isIgnoredMessage(messageContent)) {
            return false;
        }
        
        // Handle social media URLs for auto-download
        if (config.ENABLE_SOCIAL_MEDIA_DOWNLOAD) {
            const urls = extractUrls(messageContent);
            
            if (urls.length > 0) {
                console.log(`Found ${urls.length} URLs in message:`, urls);
                
                // Process the first URL only to avoid spam
                const url = urls[0];
                const platform = detectPlatform(url);
                
                if (platform) {
                    console.log(`Detected ${platform} URL: ${url}`);
                    
                    // Check if this is in a group and if the group is allowed
                    if (!isGroup || isGroupAllowedForDownloads(m.key.remoteJid)) {
                        // Save link if link saving is enabled
                        if (config.ENABLE_LINK_SAVING) {
                            try {
                                await saveLink({
                                    url: url,
                                    platform: platform,
                                    timestamp: Date.now(),
                                    sender: m.key.participant || m.key.remoteJid,
                                    senderName: m.pushName || 'Unknown',
                                    groupId: isGroup ? m.key.remoteJid : null,
                                    messageText: messageContent
                                });
                                console.log(`Saved ${platform} link to database`);
                            } catch (saveError) {
                                console.error(`Error saving ${platform} link:`, saveError);
                            }
                        }
                        
                        // Handle media download
                        await handleMediaDownload(m, sock, url, platform);
                        return true; // Handled by download, don't proceed to AI
                    }
                }
            }
        }
        
        // If AI Auto Reply is enabled and this is a direct message or allowed group
        if (config.ENABLE_AI_AUTO_REPLY) {
            // Check if this is a group and if it's allowed for AI
            if (isGroup && !isGroupAllowedForAI(m.key.remoteJid)) {
                return false;
            }
            
            if (messageContent.length > 0) {
                try {
                    // Log the message we're responding to
                    console.log(`AI auto-reply to: "${messageContent}"`);
                    
                    // Process with AI
                    const aiResponse = await processMessageWithAI(m, messageContent, sock);
                    
                    // Make sure typing indicator is cleared right before sending
                    await sock.sendPresenceUpdate('paused', m.key.remoteJid);
                    
                    // Send the AI response
                    await message.reply(aiResponse, m, sock);
                    
                    // Track AI conversation count if stats are enabled
                    if (global.aiStats) {
                        global.aiStats.conversationsHandled = (global.aiStats.conversationsHandled || 0) + 1;
                    }
                    
                    // Log the response
                    console.log(`AI responded: "${aiResponse.substring(0, 100)}${aiResponse.length > 100 ? '...' : ''}"`);
                    return true;
                } catch (error) {
                    console.error('Error in AI auto-reply:', error);
                    // Clear typing indicator if there was an error
                    await sock.sendPresenceUpdate('paused', m.key.remoteJid);
                    return false;
                }
            }
        }
        
        return false;
    } catch (error) {
        console.error('Error in handleAutoReply:', error);
        return false;
    }
}

/**
 * Get allowed AI groups from config
 * @returns {Array} - Array of allowed group JIDs
 */
function getAllowedAiGroups() {
    if (!config.AI_ALLOWED_GROUPS) {
        return [];
    }
    
    return config.AI_ALLOWED_GROUPS;
}
