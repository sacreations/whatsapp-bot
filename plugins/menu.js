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
    
    // Group commands by fromMe permission
    const userCommands = allCommands.filter(cmd => !cmd.fromMe);
    const ownerCommands = allCommands.filter(cmd => cmd.fromMe);
    
    let menuText = `🤖 *${config.BOT_NAME} MENU* 🤖\n\n`;
    
    // Add user commands section
    menuText += `📋 *User Commands*\n\n`;
    userCommands.forEach(cmd => {
        const pattern = typeof cmd.pattern === 'string' 
            ? `${config.PREFIX}${cmd.pattern}` 
            : `${config.PREFIX}${cmd.pattern.toString()}`;
        menuText += `➡️ ${pattern} - ${cmd.desc || 'No description'}\n`;
    });
    
    // Add owner commands section if user is owner
    const isOwner = m.key.fromMe;
    if (isOwner && ownerCommands.length > 0) {
        menuText += `\n👑 *Owner Commands*\n\n`;
        ownerCommands.forEach(cmd => {
            const pattern = typeof cmd.pattern === 'string' 
                ? `${config.PREFIX}${cmd.pattern}` 
                : `${config.PREFIX}${cmd.pattern.toString()}`;
            menuText += `➡️ ${pattern} - ${cmd.desc || 'No description'}\n`;
        });
    }
    
    menuText += `\n📱 Use ${config.PREFIX}help <command> for more details about a specific command.`;
    
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
