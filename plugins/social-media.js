import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import { downloadMedia } from '../Lib/Functions/Download_Functions/downloader.js';
import config from '../Config.js';
import axios from 'axios';

// YouTube video/audio downloader
bot({
    pattern: 'yt',
    fromMe: false,
    desc: 'Download YouTube videos',
    usage: '<YouTube URL> [audio]'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply('Please provide a YouTube URL.\n\nExample: ' + 
                `${config.PREFIX}yt https://www.youtube.com/watch?v=dQw4w9WgXcQ`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        // Parse arguments
        const parts = args.split(' ');
        const url = parts[0];
        const isAudio = parts.length > 1 && parts[1].toLowerCase() === 'audio';
        
        if (!url.match(/youtu\.?be/)) {
            await message.react('❌', m, sock);
            return await message.reply('Invalid YouTube URL. Please provide a valid YouTube link.', m, sock);
        }
        
        await message.reply(`Processing YouTube ${isAudio ? 'audio' : 'video'}...`, m, sock);
        
        try {
            const downloadedPath = await downloadMedia(url, 'YouTube');
            
            if (isAudio) {
                // Convert to mp3 if audio requested
                const audioPath = downloadedPath.replace('.mp4', '.mp3');
                await execAsync(`ffmpeg -i "${downloadedPath}" -vn -acodec libmp3lame "${audioPath}"`);
                
                await message.sendAudio(audioPath, false, m, sock);
                // Clean up files
                fs.unlinkSync(downloadedPath);
                fs.unlinkSync(audioPath);
            } else {
                await message.sendVideo(downloadedPath, 'Downloaded from YouTube', m, sock);
                // Clean up file
                fs.unlinkSync(downloadedPath);
            }
            
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
