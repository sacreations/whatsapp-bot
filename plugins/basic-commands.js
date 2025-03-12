import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

// Ping command to check if bot is online
bot({
    pattern: 'ping',
    fromMe: false,
    desc: 'Check if bot is online and measure response time'
}, async (m, sock) => {
    const start = new Date().getTime();
    await message.react('⏱️', m, sock);
    const end = new Date().getTime();
    const responseTime = end - start;
    return await message.reply(`*Pong!* ⚡\nResponse time: ${responseTime} ms`, m, sock);
});

// Echo command to repeat user's message
bot({
    pattern: 'echo',
    fromMe: false,
    desc: 'Repeat the given text',
    usage: '<text>'
}, async (m, sock, args) => {
    if (!args) return await message.reply(`Please provide text to echo. Example: ${config.PREFIX}echo Hello, world!`, m, sock);
    return await message.reply(args, m, sock);
});

// Owner command to get all group IDs
bot({
    pattern: 'getgroups',
    fromMe: true,
    desc: 'Get the list of all group IDs'
}, async (m, sock) => {
    try {
        const groups = Object.keys(await sock.groupFetchAllParticipating());
        let responseText = `*My Groups:*\n\n`;
        
        for (let i = 0; i < groups.length; i++) {
            const groupMetadata = await sock.groupMetadata(groups[i]);
            responseText += `${i+1}. *${groupMetadata.subject}*\n`;
            responseText += `   ID: ${groups[i]}\n`;
            responseText += `   Members: ${groupMetadata.participants.length}\n\n`;
        }
        
        if (groups.length === 0) {
            responseText = '*No groups found*';
        }
        
        return await message.reply(responseText, m, sock);
    } catch (error) {
        console.error('Error in getgroups command:', error);
        return await message.reply('Error fetching groups: ' + error.message, m, sock);
    }
});

// Sticker command to convert image to sticker
bot({
    pattern: 'sticker',
    fromMe: false,
    desc: 'Convert image to sticker'
}, async (m, sock) => {
    try {
        // Check if message has image
        if (!m.message.imageMessage) {
            return await message.reply('Please send an image with caption .sticker or reply to an image with .sticker', m, sock);
        }
        
        await message.react('⏳', m, sock);
        
        // Download the image
        const buffer = await downloadMediaMessage(
            m,
            'buffer',
            {},
            { logger }
        );
        
        // Create temporary file path
        const tempFile = path.join(config.DOWNLOAD_FOLDER, `sticker_${Date.now()}.webp`);
        
        // Convert image to WebP format for sticker
        await fs.promises.writeFile(tempFile, buffer);
        await execAsync(`ffmpeg -i ${tempFile} -vf scale=512:512 ${tempFile}.webp`);
        
        // Send the sticker
        await message.sendSticker(`${tempFile}.webp`, m, sock);
        await message.react('✅', m, sock);
        
        // Clean up temp files
        fs.unlinkSync(tempFile);
        fs.unlinkSync(`${tempFile}.webp`);
    } catch (error) {
        console.error('Error in sticker command:', error);
        await message.react('❌', m, sock);
        return await message.reply('Error creating sticker: ' + error.message, m, sock);
    }
});

// Status command to check bot status
bot({
    pattern: 'status',
    fromMe: false,
    desc: 'Check bot status and uptime'
}, async (m, sock) => {
    const uptimeMs = process.uptime() * 1000;
    const uptimeStr = formatUptime(uptimeMs);
    
    const status = {
        status: 'Online',
        uptime: uptimeStr,
        memory: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)} MB`,
        platform: process.platform,
        node: process.version
    };
    
    let statusText = `*Bot Status*\n\n`;
    statusText += `• Status: ${status.status}\n`;
    statusText += `• Uptime: ${status.uptime}\n`;
    statusText += `• Memory: ${status.memory}\n`;
    statusText += `• Platform: ${status.platform}\n`;
    statusText += `• Node.js: ${status.node}\n`;
    
    return await message.reply(statusText, m, sock);
});

// Helper function to format uptime
function formatUptime(ms) {
    const seconds = Math.floor((ms / 1000) % 60);
    const minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor((ms / (1000 * 60 * 60)) % 24);
    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    
    return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}
