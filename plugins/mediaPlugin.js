import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import { downloadMediaMessage } from '@whiskeysockets/baileys';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import axios from 'axios';
import config from '../Config.js';
import { fileTypeFromBuffer } from 'file-type';

const execAsync = promisify(exec);

// Helper function to download media from message
async function downloadMedia(m, messageType) {
    try {
        // Download media
        const buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
        );
        
        // Determine file extension
        const fileType = await fileTypeFromBuffer(buffer);
        const extension = fileType ? fileType.ext : (
            messageType === 'image' ? 'jpg' :
            messageType === 'video' ? 'mp4' :
            messageType === 'audio' ? 'mp3' :
            'bin'
        );
        
        // Create filename
        const filename = `${messageType}_${Date.now()}.${extension}`;
        const filepath = path.join(config.DOWNLOAD_FOLDER, filename);
        
        // Save file
        fs.writeFileSync(filepath, buffer);
        
        return {
            filename,
            filepath,
            mimetype: fileType ? fileType.mime : null,
            extension
        };
    } catch (error) {
        console.error(`Error downloading ${messageType}:`, error);
        throw error;
    }
}

// Get media type from message
function getMediaType(m) {
    if (m.message?.imageMessage) return 'image';
    if (m.message?.videoMessage) return 'video';
    if (m.message?.audioMessage) return 'audio';
    if (m.message?.documentMessage) return 'document';
    if (m.message?.stickerMessage) return 'sticker';
    return null;
}

// Command to download and save media
bot({
    pattern: 'save',
    fromMe: false,
    desc: 'Save media from message'
}, async (m, sock) => {
    try {
        const mediaType = getMediaType(m);
        
        if (!mediaType) {
            return await message.reply('No media found in message. Reply to a media message.', m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        const mediaInfo = await downloadMedia(m, mediaType);
        
        await message.reply(
            `Media saved successfully!\n\n` +
            `• Type: ${mediaType}\n` +
            `• Filename: ${mediaInfo.filename}\n` +
            `• MIME type: ${mediaInfo.mimetype || 'Unknown'}\n`,
            m, sock
        );
        
        // Send as document so user can download it
        await message.sendDocument(
            mediaInfo.filepath,
            mediaInfo.filename,
            mediaInfo.mimetype,
            m, sock
        );
        
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error in save command:', error);
        await message.react('❌', m, sock);
        await message.reply(`Error saving media: ${error.message}`, m, sock);
    }
});

// Convert media to different format
bot({
    pattern: 'convert',
    fromMe: false,
    desc: 'Convert media to different format',
    usage: '<format>'
}, async (m, sock, args) => {
    try {
        const validFormats = ['mp3', 'mp4', 'gif', 'webp', 'jpg', 'png'];
        const format = args?.trim().toLowerCase();
        
        if (!format || !validFormats.includes(format)) {
            return await message.reply(
                `Please specify a valid format: ${validFormats.join(', ')}\n` +
                `Example: ${config.PREFIX}convert mp3`,
                m, sock
            );
        }
        
        const mediaType = getMediaType(m);
        
        if (!mediaType) {
            return await message.reply('No media found in message. Reply to a media message.', m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        const mediaInfo = await downloadMedia(m, mediaType);
        const outputPath = path.join(config.DOWNLOAD_FOLDER, `converted_${Date.now()}.${format}`);
        
        // Convert using FFmpeg
        await execAsync(`ffmpeg -i "${mediaInfo.filepath}" -y "${outputPath}"`);
        
        await message.reply(`Media converted to ${format} format!`, m, sock);
        
        // Determine how to send the converted file
        if (['jpg', 'png'].includes(format)) {
            await message.sendImage(outputPath, `Converted to ${format}`, m, sock);
        } else if (format === 'mp4' || format === 'gif') {
            await message.sendVideo(outputPath, `Converted to ${format}`, m, sock);
        } else if (format === 'mp3') {
            await message.sendAudio(outputPath, false, m, sock);
        } else if (format === 'webp') {
            await message.sendSticker(outputPath, m, sock);
        } else {
            await message.sendDocument(outputPath, `converted.${format}`, null, m, sock);
        }
        
        await message.react('✅', m, sock);
        
        // Clean up temporary files
        fs.unlinkSync(mediaInfo.filepath);
        fs.unlinkSync(outputPath);
    } catch (error) {
        console.error('Error in convert command:', error);
        await message.react('❌', m, sock);
        await message.reply(`Error converting media: ${error.message}`, m, sock);
    }
});

// Get media information
bot({
    pattern: 'mediainfo',
    fromMe: false,
    desc: 'Get information about media'
}, async (m, sock) => {
    try {
        const mediaType = getMediaType(m);
        
        if (!mediaType) {
            return await message.reply('No media found in message. Reply to a media message.', m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        let info = '';
        
        switch (mediaType) {
            case 'image':
                info = `• Type: Image\n` +
                      `• MIME: ${m.message.imageMessage.mimetype}\n` +
                      `• Width: ${m.message.imageMessage.width}\n` +
                      `• Height: ${m.message.imageMessage.height}\n` +
                      `• Size: ${formatSize(m.message.imageMessage.fileLength || 0)}\n` +
                      `• Caption: ${m.message.imageMessage.caption || 'None'}`;
                break;
                
            case 'video':
                info = `• Type: Video\n` +
                      `• MIME: ${m.message.videoMessage.mimetype}\n` +
                      `• Width: ${m.message.videoMessage.width}\n` +
                      `• Height: ${m.message.videoMessage.height}\n` +
                      `• Duration: ${formatDuration(m.message.videoMessage.seconds || 0)}\n` +
                      `• Size: ${formatSize(m.message.videoMessage.fileLength || 0)}\n` +
                      `• Caption: ${m.message.videoMessage.caption || 'None'}`;
                break;
                
            case 'audio':
                info = `• Type: Audio\n` +
                      `• MIME: ${m.message.audioMessage.mimetype}\n` +
                      `• Duration: ${formatDuration(m.message.audioMessage.seconds || 0)}\n` +
                      `• Size: ${formatSize(m.message.audioMessage.fileLength || 0)}\n` +
                      `• Ptt: ${m.message.audioMessage.ptt ? 'Yes' : 'No'}`;
                break;
                
            case 'document':
                info = `• Type: Document\n` +
                      `• MIME: ${m.message.documentMessage.mimetype}\n` +
                      `• Title: ${m.message.documentMessage.title || 'Unknown'}\n` +
                      `• Filename: ${m.message.documentMessage.fileName || 'Unknown'}\n` +
                      `• Size: ${formatSize(m.message.documentMessage.fileLength || 0)}`;
                break;
                
            case 'sticker':
                info = `• Type: Sticker\n` +
                      `• MIME: ${m.message.stickerMessage.mimetype}\n` +
                      `• Width: ${m.message.stickerMessage.width}\n` +
                      `• Height: ${m.message.stickerMessage.height}\n` +
                      `• Size: ${formatSize(m.message.stickerMessage.fileLength || 0)}\n` +
                      `• Animated: ${m.message.stickerMessage.isAnimated ? 'Yes' : 'No'}`;
                break;
        }
        
        await message.reply(`📄 *Media Information*\n\n${info}`, m, sock);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error in mediainfo command:', error);
        await message.react('❌', m, sock);
        await message.reply(`Error getting media info: ${error.message}`, m, sock);
    }
});

// Helper function to format file size
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper function to format duration
function formatDuration(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
}
