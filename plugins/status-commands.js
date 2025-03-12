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
