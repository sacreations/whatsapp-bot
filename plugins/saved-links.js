import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import { loadSavedLinks, deleteLink, clearGroupLinks, getGroupLinks } from '../Lib/utils/linkStorage.js';
import { downloadMedia } from '../Lib/Functions/Download_Functions/downloader.js';
import fs from 'fs';
import path from 'path';

// Command to list all saved links
bot({
    pattern: 'savedlinks',
    fromMe: false,
    desc: 'List all saved links waiting to be downloaded'
}, async (m, sock) => {
    try {
        // Get group ID if in a group
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const groupId = isGroup ? m.key.remoteJid : null;
        
        // Load links - if in a group, show only links for that group
        const links = groupId ? getGroupLinks(groupId) : loadSavedLinks();
        
        if (links.length === 0) {
            return await message.reply('No saved links found.', m, sock);
        }
        
        // Group links by platform
        const grouped = {};
        links.forEach(link => {
            if (!grouped[link.platform]) grouped[link.platform] = [];
            grouped[link.platform].push(link);
        });
        
        // Build response
        let responseText = `📋 *Saved Links (${links.length})*\n\n`;
        
        for (const [platform, platformLinks] of Object.entries(grouped)) {
            responseText += `📌 *${platform}* (${platformLinks.length})\n`;
            
            // Show up to 5 links per platform to avoid message being too long
            for (let i = 0; i < Math.min(platformLinks.length, 5); i++) {
                const link = platformLinks[i];
                const date = new Date(link.timestamp).toLocaleDateString();
                
                responseText += `${i+1}. ${link.url.substring(0, 40)}...\n`;
                responseText += `   From: ${link.senderName}\n`;
                responseText += `   Date: ${date}\n`;
                if (!isGroup) {
                    responseText += `   Group: ${link.groupName}\n`;
                }
                responseText += '\n';
            }
            
            if (platformLinks.length > 5) {
                responseText += `...and ${platformLinks.length - 5} more links\n\n`;
            }
        }
        
        // Add help text
        responseText += `To download a specific link: ${config.PREFIX}dllink <url>\n`;
        responseText += `To download all saved links: ${config.PREFIX}dlall`;
        
        if (isGroup) {
            responseText += `\nTo clear all saved links for this group: ${config.PREFIX}clearsaved`;
        }
        
        return await message.reply(responseText, m, sock);
    } catch (error) {
        console.error('Error in savedlinks command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to download a saved link
bot({
    pattern: 'dllink',
    fromMe: false,
    desc: 'Download a saved link',
    usage: '<url>'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply(
                `Please provide a URL to download.\n\nExample: ${config.PREFIX}dllink https://www.youtube.com/watch?v=dQw4w9WgXcQ`, 
                m, sock
            );
        }
        
        // Load all saved links
        const links = loadSavedLinks();
        
        // Find the link
        const link = links.find(l => l.url.includes(args));
        
        if (!link) {
            return await message.reply(`Link not found in saved links. Use ${config.PREFIX}savedlinks to see all saved links.`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        await message.reply(`Processing ${link.platform} link...`, m, sock);
        
        try {
            // Get compression settings from config
            const compressionLevel = config.MEDIA_COMPRESSION_LEVEL;
            const maxResolution = config.MAX_VIDEO_RESOLUTION;
            
            // If it's YouTube, check if it's audio
            const isAudio = link.platform === 'YouTube' && link.url.includes('audio');
            
            // Download the media
            const mediaPath = await downloadMedia(link.url, link.platform, {
                isAudio: isAudio,
                compressionLevel: compressionLevel,
                maxResolution: maxResolution
            });
            
            // Send the media
            if (mediaPath.endsWith('.mp3')) {
                await message.sendAudio(mediaPath, false, m, sock);
            } else if (mediaPath.endsWith('.mp4')) {
                await message.sendVideo(mediaPath, `Downloaded from ${link.platform}`, m, sock);
            } else if (mediaPath.endsWith('.jpg') || mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.png')) {
                await message.sendImage(mediaPath, `Downloaded from ${link.platform}`, m, sock);
            } else {
                await message.sendDocument(
                    mediaPath,
                    `${link.platform}_media${path.extname(mediaPath)}`,
                    null,
                    m,
                    sock
                );
            }
            
            // Delete the file after sending
            if (fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
            }
            
            // Delete the link from saved links
            deleteLink(link.url);
            
            await message.react('✅', m, sock);
        } catch (error) {
            console.error('Error downloading saved link:', error);
            await message.react('❌', m, sock);
            return await message.reply(`Error downloading this link: ${error.message}`, m, sock);
        }
    } catch (error) {
        console.error('Error in dllink command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to download all saved links for a group
bot({
    pattern: 'dlall',
    fromMe: false,
    desc: 'Download all saved links for this group'
}, async (m, sock) => {
    try {
        // Get group ID if in a group
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        const groupId = isGroup ? m.key.remoteJid : null;
        
        // Load links - if in a group, get only links for that group
        const links = groupId ? getGroupLinks(groupId) : loadSavedLinks();
        
        if (links.length === 0) {
            return await message.reply('No saved links found.', m, sock);
        }
        
        await message.reply(`Starting to process ${links.length} saved links. This may take some time...`, m, sock);
        
        // Process the first 3 links (to avoid being blocked or overloading)
        const linksToProcess = links.slice(0, 3);
        let successCount = 0;
        
        for (const link of linksToProcess) {
            try {
                await message.react('⏳', m, sock);
                
                // Get compression settings from config
                const compressionLevel = config.MEDIA_COMPRESSION_LEVEL;
                const maxResolution = config.MAX_VIDEO_RESOLUTION;
                
                // If it's YouTube, check if it's audio
                const isAudio = link.platform === 'YouTube' && link.url.includes('audio');
                
                // Download the media
                const mediaPath = await downloadMedia(link.url, link.platform, {
                    isAudio: isAudio,
                    compressionLevel: compressionLevel,
                    maxResolution: maxResolution
                });
                
                // Send the media
                if (mediaPath.endsWith('.mp3')) {
                    await message.sendAudio(mediaPath, false, m, sock);
                } else if (mediaPath.endsWith('.mp4')) {
                    await message.sendVideo(mediaPath, `Downloaded from ${link.platform}`, m, sock);
                } else if (mediaPath.endsWith('.jpg') || mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.png')) {
                    await message.sendImage(mediaPath, `Downloaded from ${link.platform}`, m, sock);
                } else {
                    await message.sendDocument(
                        mediaPath,
                        `${link.platform}_media${path.extname(mediaPath)}`,
                        null,
                        m,
                        sock
                    );
                }
                
                // Delete the file after sending
                if (fs.existsSync(mediaPath)) {
                    fs.unlinkSync(mediaPath);
                }
                
                // Delete the link from saved links
                deleteLink(link.url);
                
                successCount++;
            } catch (error) {
                console.error('Error downloading saved link:', error);
                await message.reply(`Error downloading ${link.platform} link: ${error.message}`, m, sock);
            }
        }
        
        // Provide a summary
        if (successCount > 0) {
            await message.react('✅', m, sock);
            await message.reply(`Successfully processed ${successCount} of ${linksToProcess.length} links.\n\n${links.length - linksToProcess.length} links remaining.`, m, sock);
        } else {
            await message.react('❌', m, sock);
            await message.reply(`Failed to process any links. Please try again later.`, m, sock);
        }
    } catch (error) {
        console.error('Error in dlall command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to clear all saved links for a group
bot({
    pattern: 'clearsaved',
    fromMe: true,
    desc: 'Clear all saved links for this group'
}, async (m, sock) => {
    try {
        // Get group ID if in a group
        const isGroup = m.key.remoteJid.endsWith('@g.us');
        
        if (!isGroup) {
            return await message.reply('This command can only be used in a group.', m, sock);
        }
        
        const groupId = m.key.remoteJid;
        
        // Clear all links for the group
        const count = clearGroupLinks(groupId);
        
        if (count === 0) {
            return await message.reply('No saved links found for this group.', m, sock);
        }
        
        await message.react('🗑️', m, sock);
        return await message.reply(`Successfully cleared ${count} saved links for this group.`, m, sock);
    } catch (error) {
        console.error('Error in clearsaved command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});
