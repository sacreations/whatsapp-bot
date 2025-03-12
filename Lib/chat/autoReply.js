import config from '../../Config.js';
import message from './messageHandler.js';
import { downloadMedia } from '../Functions/Download_Functions/downloader.js';
import fs from 'fs';
import path from 'path';

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
        
        // Download media, which will now include re-muxing
        let mediaPath;
        try {
            // For YouTube, check if it's an audio request (if URL contains &audio or ?audio)
            const isAudioRequest = url.includes('audio');
            mediaPath = await downloadMedia(url, platform, { 
                isAudio: platform === 'YouTube' && isAudioRequest
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
                await message.sendVideo(mediaPath, `Downloaded from ${platform}`, m, sock);
            } else if (mediaPath.endsWith('.jpg') || mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.png')) {
                // Send as image
                await message.sendImage(mediaPath, `Downloaded from ${platform}`, m, sock);
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
 * Main auto-reply handler
 */
export async function handleAutoReply(m, sock) {
    // Dynamically check auto-reply settings
    if (!config.ENABLE_AUTO_REPLY) return false;
    
    try {
        const messageType = getMessageType(m);
        const messageText = getMessageText(m);
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        // Social media link processing - only in groups
        if (messageType === 'text' && config.ENABLE_SOCIAL_MEDIA_DOWNLOAD) {
            // Only process in allowed groups
            if (!isGroupAllowedForDownloads(m.key.remoteJid)) {
                // Skip auto-download in non-group chats or unauthorized groups
                if (isGroup) {
                    console.log(`Skipping auto-download in unauthorized group: ${m.key.remoteJid}`);
                } else {
                    console.log(`Skipping auto-download in private chat: ${m.key.remoteJid}`);
                }
                return false;
            }
            
            const urls = extractUrls(messageText);
            
            for (const url of urls) {
                const platform = detectPlatform(url);
                if (platform) {
                    await handleMediaDownload(m, sock, url, platform);
                    return true;
                }
            }
        }
        
        // Simple auto-responses - these can work in both private and group chats
        if (messageType === 'text') {
            const greetings = ['hi', 'hello', 'hey', 'hola', 'howdy'];
            
            if (greetings.includes(messageText.toLowerCase())) {
                await message.reply(`Hello! How can I help you today? Use ${config.PREFIX}menu to see available commands.`, m, sock);
                return true;
            }
            
            // Add more auto-reply patterns as needed
            
        } else if (messageType === 'sticker') {
            // Maybe react to stickers
            await message.react('👍', m, sock);
            return true;
        }
        
        return false;
    } catch (error) {
        console.error('Error in handleAutoReply:', error);
        return false;
    }
}
