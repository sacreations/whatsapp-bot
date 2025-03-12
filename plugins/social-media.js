import { bot, listCommands } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import { downloadMedia } from '../Lib/Functions/Download_Functions/downloader.js';
import config from '../Config.js';
import axios from 'axios';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

// YouTube video/audio downloader
bot({
    pattern: 'yt',
    fromMe: false,
    desc: 'Download YouTube videos',
    usage: '<YouTube URL> [audio/hq/lq]'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply('Please provide a YouTube URL.\n\nExample: ' + 
                `${config.PREFIX}yt https://www.youtube.com/watch?v=dQw4w9WgXcQ\n` +
                `Options: audio = audio only, hq = high quality, lq = low quality/smaller file`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        // Parse arguments
        const parts = args.split(' ');
        const url = parts[0];
        const option = parts.length > 1 ? parts[1].toLowerCase() : '';
        
        // Determine download options
        const isAudio = option === 'audio';
        let compressionLevel = config.MEDIA_COMPRESSION_LEVEL; // default from config
        
        // Override compression based on option
        if (option === 'hq') compressionLevel = 'low'; // low compression = high quality
        if (option === 'lq') compressionLevel = 'high'; // high compression = low quality
        
        if (!url.match(/youtu\.?be/)) {
            await message.react('❌', m, sock);
            return await message.reply('Invalid YouTube URL. Please provide a valid YouTube link.', m, sock);
        }
        
        await message.reply(`Processing YouTube ${isAudio ? 'audio' : 'video'}... Quality: ${compressionLevel}`, m, sock);
        
        try {
            const downloadedPath = await downloadMedia(url, 'YouTube', { 
                isAudio, 
                compressionLevel,
                maxResolution: compressionLevel === 'low' ? 1080 : 720 // Higher resolution for HQ
            });
            
            if (isAudio) {
                await message.sendAudio(downloadedPath, false, m, sock);
            } else {
                await message.sendVideo(downloadedPath, 'Downloaded from YouTube', m, sock);
            }
            
            // Clean up file after sending
            fs.unlinkSync(downloadedPath);
            await message.react('✅', m, sock);
        } catch (error) {
            console.error('Error downloading YouTube content:', error);
            await message.react('❌', m, sock);
            return await message.reply(`Error downloading from YouTube: ${error.message}`, m, sock);
        }
    } catch (error) {
        console.error('Error in yt command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error processing command: ${error.message}`, m, sock);
    }
});

// TikTok downloader
bot({
    pattern: 'tiktok',
    fromMe: false,
    desc: 'Download TikTok videos',
    usage: '<TikTok URL>'
}, async (m, sock, args) => {
    if (!args) {
        return await message.reply('Please provide a TikTok URL.\n\nExample: ' + 
            `${config.PREFIX}tiktok https://www.tiktok.com/@username/video/1234567890123456789`, m, sock);
    }
    
    await message.react('⏳', m, sock);
    
    if (!args.match(/tiktok\.com/)) {
        await message.react('❌', m, sock);
        return await message.reply('Invalid TikTok URL. Please provide a valid TikTok link.', m, sock);
    }
    
    await message.reply('Processing TikTok video...', m, sock);
    
    try {
        const downloadedPath = await downloadMedia(args, 'TikTok');
        await message.sendVideo(downloadedPath, 'Downloaded from TikTok', m, sock);
        
        // Clean up file
        fs.unlinkSync(downloadedPath);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error downloading TikTok content:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error downloading from TikTok: ${error.message}`, m, sock);
    }
});

// Instagram downloader
bot({
    pattern: 'ig',
    fromMe: false,
    desc: 'Download Instagram posts/reels',
    usage: '<Instagram URL>'
}, async (m, sock, args) => {
    if (!args) {
        return await message.reply('Please provide an Instagram URL.\n\nExample: ' + 
            `${config.PREFIX}ig https://www.instagram.com/p/AbCdEfGhIjK/`, m, sock);
    }
    
    await message.react('⏳', m, sock);
    
    if (!args.match(/instagram\.com/)) {
        await message.react('❌', m, sock);
        return await message.reply('Invalid Instagram URL. Please provide a valid Instagram link.', m, sock);
    }
    
    await message.reply('Processing Instagram content...', m, sock);
    
    try {
        const downloadedPath = await downloadMedia(args, 'Instagram');
        
        // Check file extension to determine how to send
        if (downloadedPath.endsWith('.mp4')) {
            await message.sendVideo(downloadedPath, 'Downloaded from Instagram', m, sock);
        } else {
            await message.sendImage(downloadedPath, 'Downloaded from Instagram', m, sock);
        }
        
        // Clean up file
        fs.unlinkSync(downloadedPath);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error downloading Instagram content:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error downloading from Instagram: ${error.message}`, m, sock);
    }
});

// Facebook downloader
bot({
    pattern: 'fb',
    fromMe: false,
    desc: 'Download Facebook videos',
    usage: '<Facebook URL>'
}, async (m, sock, args) => {
    if (!args) {
        return await message.reply('Please provide a Facebook URL.\n\nExample: ' + 
            `${config.PREFIX}fb https://www.facebook.com/watch?v=1234567890123456`, m, sock);
    }
    
    await message.react('⏳', m, sock);
    
    if (!args.match(/facebook\.com|fb\.watch/)) {
        await message.react('❌', m, sock);
        return await message.reply('Invalid Facebook URL. Please provide a valid Facebook link.', m, sock);
    }
    
    await message.reply('Processing Facebook video...', m, sock);
    
    try {
        const downloadedPath = await downloadMedia(args, 'Facebook');
        await message.sendVideo(downloadedPath, 'Downloaded from Facebook', m, sock);
        
        // Clean up file
        fs.unlinkSync(downloadedPath);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error downloading Facebook content:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error downloading from Facebook: ${error.message}`, m, sock);
    }
});

// Twitter/X downloader
bot({
    pattern: 'twitter',
    fromMe: false,
    desc: 'Download Twitter/X media',
    usage: '<Twitter/X URL>'
}, async (m, sock, args) => {
    if (!args) {
        return await message.reply('Please provide a Twitter/X URL.\n\nExample: ' + 
            `${config.PREFIX}twitter https://twitter.com/username/status/1234567890123456789`, m, sock);
    }
    
    await message.react('⏳', m, sock);
    
    if (!args.match(/twitter\.com|x\.com/)) {
        await message.react('❌', m, sock);
        return await message.reply('Invalid Twitter/X URL. Please provide a valid Twitter/X link.', m, sock);
    }
    
    await message.reply('Processing Twitter/X media...', m, sock);
    
    try {
        const downloadedPath = await downloadMedia(args, 'Twitter');
        
        // Check file extension to determine how to send
        if (downloadedPath.endsWith('.mp4')) {
            await message.sendVideo(downloadedPath, 'Downloaded from Twitter/X', m, sock);
        } else {
            await message.sendImage(downloadedPath, 'Downloaded from Twitter/X', m, sock);
        }
        
        // Clean up file
        fs.unlinkSync(downloadedPath);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error downloading Twitter/X content:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error downloading from Twitter/X: ${error.message}`, m, sock);
    }
});

// Alias for twitter command
bot({
    pattern: 'x',
    fromMe: false,
    desc: 'Alias for twitter command'
}, async (m, sock, args) => {
    // Just call the twitter command handler
    const commands = listCommands();
    const twitterCmd = commands.find(cmd => typeof cmd.pattern === 'string' && cmd.pattern === 'twitter');
    if (twitterCmd) {
        await twitterCmd.handler(m, sock, args);
    }
});

// Add a compression command to control global compression settings
bot({
    pattern: 'compression',
    fromMe: true,
    desc: 'Set media compression level for downloads',
    usage: '<low/medium/high>'
}, async (m, sock, args) => {
    try {
        const validLevels = ['low', 'medium', 'high'];
        
        if (!args || !validLevels.includes(args.toLowerCase())) {
            const currentLevel = config.MEDIA_COMPRESSION_LEVEL;
            return await message.reply(
                `Current compression level: ${currentLevel}\n\n` +
                `To change, use: ${config.PREFIX}compression <level>\n` +
                `Available levels:\n` +
                `- low: High quality, larger files\n` +
                `- medium: Balanced quality and size\n` +
                `- high: Smaller files, reduced quality`, m, sock);
        }
        
        const level = args.toLowerCase();
        
        // Update config
        await config.set('MEDIA_COMPRESSION_LEVEL', level);
        
        return await message.reply(`Media compression level set to: ${level}`, m, sock);
    } catch (error) {
        console.error('Error in compression command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Add command to set maximum video resolution
bot({
    pattern: 'maxresolution',
    fromMe: true,
    desc: 'Set maximum video resolution for downloads',
    usage: '<360/480/720/1080/0>'
}, async (m, sock, args) => {
    try {
        const validResolutions = ['360', '480', '720', '1080', '0'];
        
        if (!args || !validResolutions.includes(args)) {
            const currentRes = config.MAX_VIDEO_RESOLUTION;
            return await message.reply(
                `Current maximum resolution: ${currentRes}p\n\n` +
                `To change, use: ${config.PREFIX}maxresolution <360/480/720/1080/0>\n` +
                `Use 0 to disable resolution limit.`, m, sock);
        }
        
        const resolution = args;
        
        // Update config
        await config.set('MAX_VIDEO_RESOLUTION', resolution);
        
        if (resolution === '0') {
            return await message.reply('Video resolution limit disabled.', m, sock);
        } else {
            return await message.reply(`Maximum video resolution set to: ${resolution}p`, m, sock);
        }
    } catch (error) {
        console.error('Error in maxresolution command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});
