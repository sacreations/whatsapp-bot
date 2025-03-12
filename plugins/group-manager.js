import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import fs from 'fs';
import path from 'path';

// Command to list all allowed download groups
bot({
    pattern: 'allowedgroups',
    fromMe: true,
    desc: 'List all groups allowed for social media downloads'
}, async (m, sock) => {
    try {
        // Get allowed groups (dynamically from config)
        const allowedGroups = config.ALLOWED_DOWNLOAD_GROUPS;
        
        if (!allowedGroups || allowedGroups.length === 0) {
            return await message.reply('No groups are currently allowed for social media downloads.', m, sock);
        }
        
        let responseText = '*Allowed Download Groups*\n\n';
        
        // Get info for each group
        for (let i = 0; i < allowedGroups.length; i++) {
            const groupId = allowedGroups[i];
            
            try {
                // Try to get group metadata to show name
                const groupMetadata = await sock.groupMetadata(groupId);
                responseText += `${i+1}. ${groupMetadata.subject}\n   ID: ${groupId}\n\n`;
            } catch (error) {
                // If group metadata can't be fetched, just show ID
                responseText += `${i+1}. Unknown Group\n   ID: ${groupId}\n\n`;
            }
        }
        
        responseText += 'Use .addallowedgroup or .removeallowedgroup to modify this list.';
        
        return await message.reply(responseText, m, sock);
    } catch (error) {
        console.error('Error in allowedgroups command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to add a group to allowed downloads list
bot({
    pattern: 'addallowedgroup',
    fromMe: true,
    desc: 'Add a group to allowed downloads list',
    usage: '<group ID or "current">'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply(
                'Please provide a group ID or use "current" to add the current group.\n' +
                `Example: ${config.PREFIX}addallowedgroup current`,
                m, sock
            );
        }
        
        // Get group ID (either from args or current group)
        let groupId;
        if (args.toLowerCase() === 'current') {
            if (!m.key.remoteJid.endsWith('@g.us')) {
                return await message.reply('This command must be used in a group when using "current" parameter.', m, sock);
            }
            groupId = m.key.remoteJid;
        } else {
            groupId = args.trim();
            // Ensure group ID has the right format
            if (!groupId.endsWith('@g.us')) {
                groupId += '@g.us';
            }
        }
        
        // Get current allowed groups
        const currentAllowedGroups = config.ALLOWED_DOWNLOAD_GROUPS;
        
        // Check if group is already in the list
        if (currentAllowedGroups.includes(groupId)) {
            return await message.reply('This group is already in the allowed downloads list!', m, sock);
        }
        
        // Add to list
        const newAllowedGroups = [...currentAllowedGroups, groupId];
        
        // Update config
        config.set('ALLOWED_DOWNLOAD_GROUPS', newAllowedGroups.join(','));
        
        // Get group info if possible
        let groupName = 'Unknown Group';
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            groupName = groupMetadata.subject;
        } catch (error) {
            console.log('Could not fetch group metadata:', error.message);
        }
        
        return await message.reply(`Successfully added group "${groupName}" (${groupId}) to allowed downloads list!`, m, sock);
    } catch (error) {
        console.error('Error in addallowedgroup command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to remove a group from allowed downloads list
bot({
    pattern: 'removeallowedgroup',
    fromMe: true,
    desc: 'Remove a group from allowed downloads list',
    usage: '<index or "current">'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply(
                'Please provide the index number from .allowedgroups list or use "current" to remove the current group.\n' +
                `Example: ${config.PREFIX}removeallowedgroup 1`,
                m, sock
            );
        }
        
        // Get current allowed groups
        const currentAllowedGroups = config.ALLOWED_DOWNLOAD_GROUPS;
        
        if (currentAllowedGroups.length === 0) {
            return await message.reply('The allowed downloads list is already empty!', m, sock);
        }
        
        let indexToRemove = -1;
        
        if (args.toLowerCase() === 'current') {
            // Check if in group
            if (!m.key.remoteJid.endsWith('@g.us')) {
                return await message.reply('This command must be used in a group when using "current" parameter.', m, sock);
            }
            
            // Find index of current group
            indexToRemove = currentAllowedGroups.findIndex(g => g === m.key.remoteJid);
            
            if (indexToRemove === -1) {
                return await message.reply('Current group is not in the allowed downloads list!', m, sock);
            }
        } else {
            // Parse index (1-based in the command, convert to 0-based)
            indexToRemove = parseInt(args) - 1;
            
            if (isNaN(indexToRemove) || indexToRemove < 0 || indexToRemove >= currentAllowedGroups.length) {
                return await message.reply(
                    `Invalid index! Please use a number between 1 and ${currentAllowedGroups.length}.\n` +
                    `Use ${config.PREFIX}allowedgroups to see the list.`,
                    m, sock
                );
            }
        }
        
        // Get the group being removed
        const removedGroupId = currentAllowedGroups[indexToRemove];
        
        // Get group info if possible
        let removedGroupName = 'Unknown Group';
        try {
            const groupMetadata = await sock.groupMetadata(removedGroupId);
            removedGroupName = groupMetadata.subject;
        } catch (error) {
            console.log('Could not fetch group metadata:', error.message);
        }
        
        // Create new array without the removed group
        const newAllowedGroups = currentAllowedGroups.filter((_, index) => index !== indexToRemove);
        
        // Update config
        config.set('ALLOWED_DOWNLOAD_GROUPS', newAllowedGroups.join(','));
        
        return await message.reply(`Successfully removed group "${removedGroupName}" (${removedGroupId}) from allowed downloads list!`, m, sock);
    } catch (error) {
        console.error('Error in removeallowedgroup command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});

// Command to check if current group is allowed for downloads
bot({
    pattern: 'checkgroup',
    fromMe: false,
    desc: 'Check if current group is allowed for social media downloads'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        const groupId = m.key.remoteJid;
        const allowedGroups = config.ALLOWED_DOWNLOAD_GROUPS;
        
        // Get group metadata
        let groupName = 'Unknown Group';
        try {
            const groupMetadata = await sock.groupMetadata(groupId);
            groupName = groupMetadata.subject;
        } catch (error) {
            console.log('Could not fetch group metadata:', error.message);
        }
        
        if (allowedGroups.includes(groupId)) {
            return await message.reply(`✅ Group "${groupName}" is allowed for automatic social media downloads!`, m, sock);
        } else {
            return await message.reply(`❌ Group "${groupName}" is NOT allowed for automatic social media downloads.`, m, sock);
        }
    } catch (error) {
        console.error('Error in checkgroup command:', error);
        return await message.reply(`Error: ${error.message}`, m, sock);
    }
});
