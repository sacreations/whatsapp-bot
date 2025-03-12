import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import { listCommands } from '../Lib/chat/commandHandler.js';

// Menu command
bot({
    pattern: 'menu',
    fromMe: false,
    desc: 'Display available commands'
}, async (m, sock) => {
    const allCommands = listCommands();
    
    // Group commands by category
    const categories = {
        'basic': { emoji: '📋', title: 'Basic Commands', commands: [] },
        'media': { emoji: '🖼️', title: 'Media Commands', commands: [] },
        'downloader': { emoji: '📥', title: 'Downloader Commands', commands: [] },
        'group': { emoji: '👥', title: 'Group Commands', commands: [] },
        'tools': { emoji: '🛠️', title: 'Tools & Utilities', commands: [] },
        'owner': { emoji: '👑', title: 'Owner Commands', commands: [] }
    };
    
    // Categorize commands
    allCommands.forEach(cmd => {
        if (cmd.fromMe) {
            categories.owner.commands.push(cmd);
        } else if (cmd.pattern.toString().includes('convert') || 
                  cmd.pattern.toString().includes('sticker') || 
                  cmd.pattern.toString().includes('media')) {
            categories.media.commands.push(cmd);
        } else if (cmd.pattern.toString().includes('yt') || 
                  cmd.pattern.toString().includes('tiktok') || 
                  cmd.pattern.toString().includes('ig') || 
                  cmd.pattern.toString().includes('fb') || 
                  cmd.pattern.toString().includes('twitter')) {
            categories.downloader.commands.push(cmd);
        } else if (cmd.pattern.toString().includes('group')) {
            categories.group.commands.push(cmd);
        } else if (cmd.pattern.toString().includes('test') || 
                  cmd.pattern.toString().includes('stat') || 
                  cmd.pattern.toString().includes('ping') || 
                  cmd.pattern.toString().includes('info') || 
                  cmd.pattern.toString().includes('sysinfo') ||
                  cmd.pattern.toString().includes('time') ||
                  cmd.pattern.toString().includes('date')) {
            categories.tools.commands.push(cmd);
        } else {
            categories.basic.commands.push(cmd);
        }
    });
    
    // Get current Sri Lanka time
    const now = new Date();
    // Sri Lanka is UTC+5:30
    const sriLankaTime = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Colombo',
        dateStyle: 'full',
        timeStyle: 'medium'
    }).format(now);
    
    // Build the menu text with better styling
    let menuText = `┌─────────────────────┐\n`;
    menuText += `│    *${config.BOT_NAME}*    │\n`;
    menuText += `└─────────────────────┘\n\n`;
    
    // Add date and time
    menuText += `📆 *Date & Time (Sri Lanka)*\n`;
    menuText += `${sriLankaTime}\n\n`;
    
    // Add each category
    Object.values(categories).forEach(category => {
        if (category.commands.length > 0) {
            if (category.title === 'Owner Commands' && !m.key.fromMe) {
                return; // Skip owner commands for non-owners
            }
            
            menuText += `╭─❯ ${category.emoji} *${category.title}* ❮─\n`;
            
            category.commands.forEach(cmd => {
                const pattern = typeof cmd.pattern === 'string' 
                    ? `${config.PREFIX}${cmd.pattern}` 
                    : `${config.PREFIX}${cmd.pattern.toString().replace(/\//g, '').substring(0, 15)}`;
                
                const description = cmd.desc || 'No description';
                menuText += `│ • ${pattern}\n│   ${description}\n`;
            });
            
            menuText += `╰────────────────\n\n`;
        }
    });
    
    // Add footer
    menuText += `┌─────────────────────┐\n`;
    menuText += `│ 📱 *HOW TO USE* 📱 │\n`;
    menuText += `└─────────────────────┘\n`;
    menuText += `Type ${config.PREFIX}help <command> for detailed info on specific commands.\n\n`;
    menuText += `🤖 *Bot Status:* Online\n`;
    menuText += `⚡ *Prefix:* ${config.PREFIX}\n`;
    menuText += `🧩 *Commands:* ${allCommands.length}\n`;
    
    // Send the menu
    return await message.reply(menuText, m, sock);
});

// Help command
bot({
    pattern: 'help',
    fromMe: false,
    desc: 'Get help for a specific command'
}, async (m, sock, args) => {
    if (!args) {
        return await message.reply(`Please specify a command to get help for. Example: ${config.PREFIX}help menu`, m, sock);
    }
    
    const allCommands = listCommands();
    const commandName = args.trim().toLowerCase();
    const command = allCommands.find(cmd => 
        typeof cmd.pattern === 'string' ? cmd.pattern === commandName : cmd.pattern.toString().includes(commandName)
    );
    
    if (!command) {
        return await message.reply(`Command '${commandName}' not found. Use ${config.PREFIX}menu to see all commands.`, m, sock);
    }
    
    // Check permission
    if (command.fromMe && !m.key.fromMe) {
        return await message.reply(`You don't have permission to use this command.`, m, sock);
    }
    
    let helpText = `📖 *Command Help: ${commandName}* 📖\n\n`;
    helpText += `🔹 Description: ${command.desc || 'No description available'}\n`;
    helpText += `🔹 Usage: ${config.PREFIX}${command.pattern} ${command.usage || ''}\n`;
    helpText += `🔹 Owner Only: ${command.fromMe ? 'Yes' : 'No'}\n`;
    
    if (command.example) {
        helpText += `🔹 Example: ${command.example}\n`;
    }
    
    return await message.reply(helpText, m, sock);
});

// Info command
bot({
    pattern: 'info',
    fromMe: false,
    desc: 'Show bot information'
}, async (m, sock) => {
    let infoText = `🤖 *${config.BOT_NAME} Information* 🤖\n\n`;
    
    infoText += `📝 *Bot Details*\n`;
    infoText += `• Name: ${config.BOT_NAME}\n`;
    infoText += `• Prefix: ${config.PREFIX}\n`;
    infoText += `• Auto-Reply: ${config.ENABLE_AUTO_REPLY ? 'Enabled' : 'Disabled'}\n`;
    infoText += `• Media Download: ${config.ENABLE_SOCIAL_MEDIA_DOWNLOAD ? 'Enabled' : 'Disabled'}\n\n`;
    
    infoText += `🔧 *Technical Info*\n`;
    infoText += `• Library: @whiskeysockets/baileys\n`;
    infoText += `• Platform: ${process.platform}\n`;
    infoText += `• Node.js: ${process.version}\n`;
    infoText += `• Commands Loaded: ${listCommands().length}\n\n`;
    
    infoText += `📱 Use ${config.PREFIX}menu to see available commands.`;
    
    return await message.reply(infoText, m, sock);
});
