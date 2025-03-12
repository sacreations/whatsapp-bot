import config from '../../Config.js';
import message from './messageHandler.js';
import { downloadMedia } from '../Functions/Download_Functions/downloader.js';

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
        await message.reply(`Detected ${platform} link. Downloading...`, m, sock);
        
        const mediaUrl = await downloadMedia(url, platform);
        
        if (!mediaUrl) {
            await message.react('❌', m, sock);
            return await message.reply(`Failed to download media from ${platform}`, m, sock);
        }
        
        if (platform === 'YouTube' || platform === 'Facebook' || platform === 'Twitter') {
            await message.sendVideo(mediaUrl, `Downloaded from ${platform}`, m, sock);
        } else if (platform === 'TikTok') {
            if (mediaUrl.includes('.mp4')) {
                await message.sendVideo(mediaUrl, `Downloaded from TikTok`, m, sock);
            } else {
                await message.sendImage(mediaUrl, `Downloaded from TikTok`, m, sock);
            }
        } else if (platform === 'Instagram') {
            // Instagram could be image or video
            if (mediaUrl.includes('.mp4')) {
                await message.sendVideo(mediaUrl, `Downloaded from Instagram`, m, sock);
            } else {
                await message.sendImage(mediaUrl, `Downloaded from Instagram`, m, sock);
            }
        }
        
        await message.react('✅', m, sock);
    } catch (error) {
        console.error(`Error downloading from ${platform}:`, error);
        await message.react('❌', m, sock);
        await message.reply(`Failed to download: ${error.message}`, m, sock);
    }
}

/**
 * Main auto-reply handler
 */
export async function handleAutoReply(m, sock) {
    if (!config.ENABLE_AUTO_REPLY) return false;
    
    try {
        const messageType = getMessageType(m);
        const messageText = getMessageText(m);
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        // Social media link processing
        if (messageType === 'text' && config.ENABLE_SOCIAL_MEDIA_DOWNLOAD) {
            const urls = extractUrls(messageText);
            
            for (const url of urls) {
                const platform = detectPlatform(url);
                if (platform) {
                    await handleMediaDownload(m, sock, url, platform);
                    return true;
                }
            }
        }
        
        // Simple auto-responses
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
