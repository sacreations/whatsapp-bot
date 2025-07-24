import config from '../../Config.js';
import message from './messageHandler.js';
import { jidDecode } from '@whiskeysockets/baileys';

// Store for commands
const commands = [];

/**
 * Register a new bot command
 */
export function bot(info, handler) {
    if (typeof info !== 'object' || typeof handler !== 'function') {
        throw new Error('Invalid command registration');
    }
    
    commands.push({
        ...info,
        handler
    });
}

/**
 * List all registered commands
 */
export function listCommands() {
    return [...commands];
}

/**
 * Main message handler
 */
export async function handleMessage(m, sock) {
    try {
        // Early return if the bot is paused (except for owner commands)
        if (config.BOT_PAUSED) {
            // Check if message is from owner
            const sender = m.key.remoteJid;
            if (sender !== config.OWNER_NUMBER && !sender.includes(config.OWNER_NUMBER)) {
                return false;
            }
        }
        
        // Get message text from various message types
        const messageText = (
            m.message?.conversation || 
            m.message?.extendedTextMessage?.text || 
            m.message?.imageMessage?.caption ||
            m.message?.videoMessage?.caption || 
            ''
        ).trim();
        
        // Check if the message starts with the command prefix
        if (!messageText.startsWith(config.PREFIX)) {
            return false;
        }
        
        // Extract command and args
        const [command, ...args] = messageText.slice(config.PREFIX.length).trim().split(' ');
        const fullArgs = args.join(' ');
        
        console.log(`Command detected: ${command}, Args: ${fullArgs}`);
        
        // Find matching command
        for (const cmd of commands) {
            // Check if pattern matches
            const pattern = cmd.pattern;
            let matches = false;
            
            if (typeof pattern === 'string' && pattern === command) {
                matches = true;
            } else if (pattern instanceof RegExp && pattern.test(command)) {
                matches = true;
            }
            
            if (!matches) continue;
            
            // Check if command is fromMe only
            if (cmd.fromMe) {
                const sender = m.key.remoteJid;
                if (sender !== config.OWNER_NUMBER && !sender.includes(config.OWNER_NUMBER)) {
                    await message.reply('This command is only available to the bot owner.', m, sock);
                    return true;
                }
            }
            
            // Check if in maintenance mode - only respond to owner commands
            if (config.MAINTENANCE_MODE && !cmd.fromMe) {
                await message.reply('Bot is currently in maintenance mode. Only owner commands are available.', m, sock);
                return true;
            }
            
            // Execute the command
            try {
                await cmd.handler(m, sock, fullArgs, { command });
                return true;
            } catch (error) {
                console.error(`Error executing command ${command}:`, error);
                await message.reply(`Error executing command: ${error.message}`, m, sock);
                return true;
            }
        }
        
        // No matching command found
        return false;
    } catch (error) {
        console.error('Error in message handler:', error);
        return false;
    }
}
}
