import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';

// Get group metadata
bot({
    pattern: 'groupinfo',
    fromMe: false,
    desc: 'Get information about the current group'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
        const participants = groupMetadata.participants;
        
        // Count admins and members
        const adminCount = participants.filter(p => p.admin).length;
        const memberCount = participants.length;
        
        // Create group info text
        let infoText = `📋 *Group Information*\n\n`;
        infoText += `• Name: ${groupMetadata.subject}\n`;
        infoText += `• ID: ${groupMetadata.id}\n`;
        infoText += `• Creation: ${new Date(groupMetadata.creation * 1000).toLocaleString()}\n`;
        infoText += `• Creator: ${groupMetadata.owner || 'Unknown'}\n`;
        infoText += `• Description: ${groupMetadata.desc || 'None'}\n`;
        infoText += `• Participants: ${memberCount} (${adminCount} admins)\n`;
        infoText += `• Ephemeral: ${groupMetadata.ephemeralDuration ? `${groupMetadata.ephemeralDuration/86400} day(s)` : 'Off'}\n`;
        
        return await message.reply(infoText, m, sock);
    } catch (error) {
        console.error('Error in groupinfo command:', error);
        return await message.reply(`Error getting group info: ${error.message}`, m, sock);
    }
});

// List all group participants
bot({
    pattern: 'groupmembers',
    fromMe: false,
    desc: 'List all members in the group'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        const groupMetadata = await sock.groupMetadata(m.key.remoteJid);
        const participants = groupMetadata.participants;
        
        // Sort participants (admins first)
        const sortedParticipants = [
            ...participants.filter(p => p.admin),
            ...participants.filter(p => !p.admin)
        ];
        
        let memberList = `👥 *Group Members*\n`;
        memberList += `Group: ${groupMetadata.subject}\n`;
        memberList += `Total: ${participants.length} members\n\n`;
        
        for (let i = 0; i < sortedParticipants.length; i++) {
            const p = sortedParticipants[i];
            const contact = await sock.getContactInfo(p.id);
            const name = contact?.name || p.id.split('@')[0];
            
            memberList += `${i+1}. ${name}`;
            if (p.admin) memberList += ` (${p.admin})`;
            memberList += `\n`;
            
            // Send in chunks if list gets too long
            if (i > 0 && i % 50 === 0) {
                await message.reply(memberList, m, sock);
                memberList = '';
            }
        }
        
        if (memberList) {
            await message.reply(memberList, m, sock);
        }
        
    } catch (error) {
        console.error('Error in groupmembers command:', error);
        return await message.reply(`Error listing group members: ${error.message}`, m, sock);
    }
});

// Admin command to add/remove users from groups
bot({
    pattern: 'add',
    fromMe: true,
    desc: 'Add a user to the group',
    usage: '<number> [number2] [number3]...'
}, async (m, sock, args) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        if (!args) {
            return await message.reply(`Please provide at least one phone number to add.\nExample: ${config.PREFIX}add 1234567890`, m, sock);
        }
        
        // Extract numbers
        const numbers = args.split(' ').map(num => {
            // Format number to international format with WhatsApp suffix
            let formatted = num.replace(/[^0-9]/g, '');
            // Add WhatsApp suffix if not present
            if (!formatted.includes('@')) {
                formatted = `${formatted}@s.whatsapp.net`;
            }
            return formatted;
        });
        
        await message.react('⏳', m, sock);
        await sock.groupParticipantsUpdate(
            m.key.remoteJid,
            numbers,
            'add'
        );
        
        await message.react('✅', m, sock);
        return await message.reply(`Successfully attempted to add ${numbers.length} participant(s) to the group.`, m, sock);
    } catch (error) {
        console.error('Error in add command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error adding users: ${error.message}`, m, sock);
    }
});

// Admin command to remove users from groups
bot({
    pattern: 'kick',
    fromMe: true,
    desc: 'Remove a user from the group',
    usage: '<@mention or reply to message>'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        // Get user to kick (from mention or reply)
        let userToKick = '';
        if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.participant) {
            // From reply
            userToKick = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.mentionedJid?.length > 0) {
            // From mention
            userToKick = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            return await message.reply(`Please mention a user or reply to their message to kick them.`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        await sock.groupParticipantsUpdate(
            m.key.remoteJid,
            [userToKick],
            'remove'
        );
        
        await message.react('✅', m, sock);
        return await message.reply(`User has been kicked from the group.`, m, sock);
    } catch (error) {
        console.error('Error in kick command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error kicking user: ${error.message}`, m, sock);
    }
});

// Admin command to promote user to admin
bot({
    pattern: 'promote',
    fromMe: true,
    desc: 'Promote a user to admin',
    usage: '<@mention or reply to message>'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        // Get user to promote (from mention or reply)
        let userToPromote = '';
        if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.participant) {
            // From reply
            userToPromote = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.mentionedJid?.length > 0) {
            // From mention
            userToPromote = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            return await message.reply(`Please mention a user or reply to their message to promote them.`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        await sock.groupParticipantsUpdate(
            m.key.remoteJid,
            [userToPromote],
            'promote'
        );
        
        await message.react('✅', m, sock);
        return await message.reply(`User has been promoted to admin.`, m, sock);
    } catch (error) {
        console.error('Error in promote command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error promoting user: ${error.message}`, m, sock);
    }
});

// Admin command to demote admin to regular user
bot({
    pattern: 'demote',
    fromMe: true,
    desc: 'Demote an admin to regular user',
    usage: '<@mention or reply to message>'
}, async (m, sock) => {
    try {
        // Check if in group
        if (!m.key.remoteJid.endsWith('@g.us')) {
            return await message.reply('This command can only be used in a group!', m, sock);
        }
        
        // Get admin to demote (from mention or reply)
        let userToDemote = '';
        if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.participant) {
            // From reply
            userToDemote = m.message.extendedTextMessage.contextInfo.participant;
        } else if (m.message.extendedTextMessage && m.message.extendedTextMessage.contextInfo?.mentionedJid?.length > 0) {
            // From mention
            userToDemote = m.message.extendedTextMessage.contextInfo.mentionedJid[0];
        } else {
            return await message.reply(`Please mention an admin or reply to their message to demote them.`, m, sock);
        }
        
        await message.react('⏳', m, sock);
        await sock.groupParticipantsUpdate(
            m.key.remoteJid,
            [userToDemote],
            'demote'
        );
        
        await message.react('✅', m, sock);
        return await message.reply(`Admin has been demoted to regular user.`, m, sock);
    } catch (error) {
        console.error('Error in demote command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error demoting admin: ${error.message}`, m, sock);
    }
});
