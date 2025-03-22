import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import fs from 'fs';
import path from 'path';

// Status directory path
const statusDir = path.join(process.cwd(), 'downloads', 'statuses');

// Command to toggle auto status view
bot({
    pattern: 'autostatus',
    fromMe: true,
    desc: 'Toggle auto status view feature'
}, async (m, sock, args) => {
    try {
        // Get current state - dynamically
        const currentState = config.ENABLE_AUTO_STATUS_VIEW;
        
        // Toggle state based on args or just toggle if no args
        let newState;
        
        if (args) {
            if (args.toLowerCase() === 'on' || args.toLowerCase() === 'true') {
                newState = true;
            } else if (args.toLowerCase() === 'off' || args.toLowerCase() === 'false') {
                newState = false;
            } else {
                return await message.reply(
                    `Invalid argument. Use 'on', 'off', 'true', or 'false'.`, 
                    m, sock
                );
            }
        } else {
            // Just toggle current state
            newState = !currentState;
        }
        
        // Update config - using the new set method which updates the file directly
        config.set('ENABLE_AUTO_STATUS_VIEW', newState.toString());
        
        return await message.reply(
            `Auto status view has been turned ${newState ? 'ON' : 'OFF'}.`,
            m, sock
        );
    } catch (error) {
        console.error('Error in autostatus command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to list saved statuses
bot({
    pattern: 'liststatus',
    fromMe: true,
    desc: 'List saved statuses'
}, async (m, sock) => {
    try {
        // Create status directory if it doesn't exist
        if (!fs.existsSync(statusDir)) {
            fs.mkdirSync(statusDir, { recursive: true });
            return await message.reply('No statuses have been saved yet.', m, sock);
        }
        
        // Read status directory
        const files = fs.readdirSync(statusDir);
        
        if (files.length === 0) {
            return await message.reply('No statuses have been saved yet.', m, sock);
        }
        
        // Group files by contact
        const contactStatuses = {};
        files.forEach(file => {
            // Extract contact ID from filename (status_contactId_timestamp.ext)
            const match = file.match(/status_(\d+)_/);
            if (match && match[1]) {
                const contactId = match[1];
                if (!contactStatuses[contactId]) {
                    contactStatuses[contactId] = [];
                }
                contactStatuses[contactId].push(file);
            }
        });
        
        // Create response message
        let responseText = '*Saved Statuses*\n\n';
        
        Object.entries(contactStatuses).forEach(([contactId, statusFiles]) => {
            responseText += `👤 *Contact:* ${contactId}\n`;
            responseText += `📊 *Status Count:* ${statusFiles.length}\n\n`;
        });
        
        responseText += `Total: ${files.length} statuses saved`;
        
        return await message.reply(responseText, m, sock);
    } catch (error) {
        console.error('Error in liststatus command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to show contacts info
bot({
    pattern: 'contacts',
    fromMe: true,
    desc: 'Show saved contacts information'
}, async (m, sock) => {
    try {
        const dataDir = path.join(process.cwd(), 'data');
        const contactsPath = path.join(dataDir, 'contacts.json');
        
        if (!fs.existsSync(contactsPath)) {
            return await message.reply('No contacts information found.', m, sock);
        }
        
        const contactsData = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
        const contactCount = Object.keys(contactsData).length;
        
        if (contactCount === 0) {
            return await message.reply('No contacts have been saved yet.', m, sock);
        }
        
        let responseText = `*Saved Contacts (${contactCount})*\n\n`;
        
        // Show first 20 contacts to avoid message being too long
        let count = 0;
        for (const [jid, data] of Object.entries(contactsData)) {
            if (count < 20) {
                responseText += `👤 *JID:* ${jid}\n`;
                responseText += `   *Name:* ${data.name || 'Unknown'}\n`;
                responseText += `   *Last Updated:* ${new Date(data.updatedAt).toLocaleString()}\n\n`;
                count++;
            } else {
                responseText += `...and ${contactCount - 20} more contacts.`;
                break;
            }
        }
        
        return await message.reply(responseText, m, sock);
    } catch (error) {
        console.error('Error in contacts command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

bot({
    pattern: 'poststatus',
    fromMe: true,
    desc: 'Post media as a WhatsApp status',
    usage: 'Reply to a media message or attach media with caption'
}, async (m, sock) => {
    try {
        // Check if the message has media or is replying to a message with media
        const quotedMsg = m.message.extendedTextMessage?.contextInfo?.quotedMessage;
        
        let mediaType, mediaUrl, caption, mediaBuffer;
        
        // Get caption text if any
        caption = m.message.imageMessage?.caption || 
                 m.message.videoMessage?.caption || 
                 m.message.extendedTextMessage?.text || '';
        
        if (caption.startsWith('.poststatus ')) {
            caption = caption.slice('.poststatus '.length);
        }
        
        // Try to get media from quoted message or original message
        if (quotedMsg) {
            if (quotedMsg.imageMessage) {
                mediaType = 'image';
                mediaBuffer = await downloadMediaMessage(
                    { message: { imageMessage: quotedMsg.imageMessage } },
                    'buffer',
                    {},
                    { logger }
                );
            } else if (quotedMsg.videoMessage) {
                mediaType = 'video';
                mediaBuffer = await downloadMediaMessage(
                    { message: { videoMessage: quotedMsg.videoMessage } },
                    'buffer',
                    {},
                    { logger }
                );
            } else {
                return await message.reply('Please reply to an image or video to post as status', m, sock);
            }
        } else if (m.message.imageMessage) {
            mediaType = 'image';
            mediaBuffer = await downloadMediaMessage(m, 'buffer', {}, { logger });
        } else if (m.message.videoMessage) {
            mediaType = 'video';
            mediaBuffer = await downloadMediaMessage(m, 'buffer', {}, { logger });
        } else {
            return await message.reply('Please send an image or video to post as status, or reply to one', m, sock);
        }
        
        // Temporary file path to save the media
        const timestamp = Date.now();
        const tempMediaPath = path.join(config.DOWNLOAD_FOLDER, `status_${timestamp}_temp.${mediaType === 'image' ? 'jpg' : 'mp4'}`);
        const optimizedMediaPath = path.join(config.DOWNLOAD_FOLDER, `status_${timestamp}.${mediaType === 'image' ? 'jpg' : 'mp4'}`);
        
        // Save the media to file
        fs.writeFileSync(tempMediaPath, mediaBuffer);
        
        // If it's a video, optimize it for WhatsApp status
        if (mediaType === 'video') {
            try {
                await message.react('⏳', m, sock);
                await message.reply('Optimizing video for status...', m, sock);
                
                // Import the optimizeVideoForStatus function
                const { optimizeVideoForStatus } = await import('../Lib/Functions/Download_Functions/downloader.js');
                
                // Optimize the video specifically for status using the dedicated function
                await optimizeVideoForStatus(tempMediaPath, optimizedMediaPath);
                
                // Use the optimized video for posting
                if (fs.existsSync(tempMediaPath)) {
                    fs.unlinkSync(tempMediaPath); // Remove the temporary file
                }
            } catch (optError) {
                console.error('Error optimizing video for status:', optError);
                await message.reply('Error optimizing video. The video may not be compatible with WhatsApp status.', m, sock);
                return;
            }
        } else {
            // For images, just copy the file
            fs.copyFileSync(tempMediaPath, optimizedMediaPath);
            fs.unlinkSync(tempMediaPath);
        }
        
        // Read the media from the optimized file
        const statusMediaBuffer = fs.readFileSync(optimizedMediaPath);
        
        // Post the status
        await message.react('⏳', m, sock);
        
        try {
            if (mediaType === 'image') {
                await sock.sendMessage('status@broadcast', {
                    image: statusMediaBuffer,
                    caption: caption
                });
            } else {
                await sock.sendMessage('status@broadcast', {
                    video: statusMediaBuffer,
                    caption: caption
                });
            }
            
            // Clean up the file
            fs.unlinkSync(optimizedMediaPath);
            
            await message.react('✅', m, sock);
            await message.reply('Status posted successfully!', m, sock);
        } catch (postError) {
            console.error('Error posting to status:', postError);
            await message.react('❌', m, sock);
            await message.reply(`WhatsApp couldn't post this media to status: ${postError.message}`, m, sock);
        }
    } catch (error) {
        console.error('Error posting status:', error);
        await message.react('❌', m, sock);
        await message.reply(`Error posting status: ${error.message}`, m, sock);
    }
});
