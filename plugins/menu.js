import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';
import { listCommands } from '../Lib/chat/commandHandler.js';

// Main menu command - shows all commands with categories
bot({
    pattern: 'menu',
    fromMe: false,
    desc: 'Show all available commands'
}, async (m, sock, args) => {
    try {
        // Get all commands
        const commands = listCommands();
        
        // Define command categories
        const categories = {
            'Social Media': ['yt', 'tiktok', 'ig', 'fb', 'twitter', 'x'],
            'Media Tools': ['save', 'convert', 'mediainfo', 'statusready', 'wallpaper'],
            'Status Management': ['autostatus', 'liststatus', 'poststatus', 'contacts'],
            'Group Management': ['groupinfo', 'groupmembers', 'add', 'kick', 'promote', 'demote', 'allowedgroups', 'addallowedgroup', 'removeallowedgroup', 'checkgroup'],
            'Saved Links': ['savedlinks', 'dllink', 'dlall', 'clearsaved'],
            'Admin Tools': ['sysinfo', 'netstat', 'compression', 'maxresolution'],
            'Basic Commands': ['test', 'time', 'date', 'menu', 'help']
        };
        
        // Start building menu text
        let menuText = `🤖 *${config.BOT_NAME} Command Menu* 🤖\n\n`;
        menuText += `Prefix: ${config.PREFIX}\n\n`;
        
        // Add commands by category
        for (const [category, categoryCommands] of Object.entries(categories)) {
            const matchedCommands = commands.filter(cmd => 
                typeof cmd.pattern === 'string' && categoryCommands.includes(cmd.pattern)
            );
            
            if (matchedCommands.length > 0) {
                menuText += `*⭐ ${category} ⭐*\n`;
                
                for (const cmd of matchedCommands) {
                    const usage = cmd.usage ? ` ${cmd.usage}` : '';
                    menuText += `• ${config.PREFIX}${cmd.pattern}${usage}\n`;
                    if (cmd.desc) menuText += `  ${cmd.desc}\n`;
                }
                
                menuText += '\n';
            }
        }
        
        // Add footer
        menuText += `💡 For detailed help on a command, use: ${config.PREFIX}help <command>\n`;
        menuText += `Example: ${config.PREFIX}help yt\n\n`;
        menuText += `Created by ${config.ADMIN_NAME || 'Admin'} ❤️`;
        
        // Send the menu
        return await message.reply(menuText, m, sock);
    } catch (error) {
        console.error('Error in menu command:', error);
        return await message.reply(`Error generating menu: ${error.message}`, m, sock);
    }
});

// Help command - shows detailed help for a specific command
bot({
    pattern: 'help',
    fromMe: false,
    desc: 'Get detailed help for a command',
    usage: '<command>'
}, async (m, sock, args) => {
    try {
        if (!args) {
            return await message.reply(`Please specify a command to get help for.\nExample: ${config.PREFIX}help yt`, m, sock);
        }
        
        // Get all commands
        const commands = listCommands();
        
        // Find the requested command
        const command = commands.find(cmd => 
            typeof cmd.pattern === 'string' && cmd.pattern === args.trim().toLowerCase()
        );
        
        if (!command) {
            return await message.reply(`Command not found: ${args}\nUse ${config.PREFIX}menu to see all available commands.`, m, sock);
        }
        
        // Build help text
        let helpText = `📚 *Help: ${config.PREFIX}${command.pattern}* 📚\n\n`;
        
        // Add description
        if (command.desc) {
            helpText += `*Description:*\n${command.desc}\n\n`;
        }
        
        // Add usage
        helpText += `*Usage:*\n${config.PREFIX}${command.pattern}`;
        if (command.usage) {
            helpText += ` ${command.usage}`;
        }
        helpText += '\n\n';
        
        // Add examples based on the command
        helpText += '*Examples:*\n';
        
        switch (command.pattern) {
            case 'yt':
                helpText += `${config.PREFIX}yt https://www.youtube.com/watch?v=dQw4w9WgXcQ\n`;
                helpText += `${config.PREFIX}yt https://youtu.be/dQw4w9WgXcQ audio\n`;
                helpText += `${config.PREFIX}yt https://www.youtube.com/watch?v=dQw4w9WgXcQ hq\n`;
                break;
                
            case 'tiktok':
                helpText += `${config.PREFIX}tiktok https://www.tiktok.com/@username/video/1234567890123456789\n`;
                break;
                
            case 'ig':
                helpText += `${config.PREFIX}ig https://www.instagram.com/p/CAbCdEfGhIj/\n`;
                helpText += `${config.PREFIX}ig https://www.instagram.com/reel/CAbCdEfGhIj/\n`;
                break;
                
            case 'fb':
                helpText += `${config.PREFIX}fb https://www.facebook.com/watch?v=1234567890\n`;
                helpText += `${config.PREFIX}fb https://fb.watch/abcdef123/\n`;
                break;
                
            case 'save':
                helpText += `Reply to any media with ${config.PREFIX}save\n`;
                break;
                
            case 'convert':
                helpText += `Reply to media with ${config.PREFIX}convert mp3\n`;
                helpText += `Reply to media with ${config.PREFIX}convert gif\n`;
                break;
                
            case 'wallpaper':
                helpText += `${config.PREFIX}wallpaper nature\n`;
                helpText += `${config.PREFIX}wallpaper cute cats\n`;
                break;
                
            case 'mediainfo':
                helpText += `Reply to any media with ${config.PREFIX}mediainfo\n`;
                break;
                
            case 'add':
                helpText += `${config.PREFIX}add 94123456789\n`;
                helpText += `${config.PREFIX}add 94123456789 94987654321\n`;
                break;
                
            case 'kick':
                helpText += `Reply to someone's message with ${config.PREFIX}kick\n`;
                helpText += `${config.PREFIX}kick @mention\n`;
                break;
                
            case 'poststatus':
                helpText += `Send an image/video with caption ${config.PREFIX}poststatus\n`;
                helpText += `Reply to an image/video with ${config.PREFIX}poststatus\n`;
                break;
                
            case 'statusready':
                helpText += `Reply to a video with ${config.PREFIX}statusready\n`;
                helpText += `${config.PREFIX}statusready https://example.com/video.mp4\n`;
                break;
                
            case 'dllink':
                helpText += `${config.PREFIX}dllink https://www.youtube.com/watch?v=dQw4w9WgXcQ\n`;
                break;
                
            case 'compression':
                helpText += `${config.PREFIX}compression low\n`;
                helpText += `${config.PREFIX}compression medium\n`;
                helpText += `${config.PREFIX}compression high\n`;
                break;
                
            default:
                helpText += `${config.PREFIX}${command.pattern}`;
                if (command.usage) {
                    helpText += ` ${command.usage}`;
                }
                helpText += '\n';
        }
        
        // Add notes for special commands
        if (['yt', 'tiktok', 'ig', 'fb', 'twitter'].includes(command.pattern)) {
            helpText += '\n*Options:*\n';
            if (command.pattern === 'yt') {
                helpText += '• audio - Download audio only\n';
                helpText += '• hq - High quality video\n';
                helpText += '• lq - Low quality/smaller file\n';
            }
            helpText += '\n*Note:* Downloaded files are optimized for WhatsApp sharing.\n';
        }
        
        // Send the help text
        return await message.reply(helpText, m, sock);
    } catch (error) {
        console.error('Error in help command:', error);
        return await message.reply(`Error generating help: ${error.message}`, m, sock);
    }
});

// Command to show bot information
bot({
    pattern: 'about',
    fromMe: false,
    desc: 'Show information about the bot'
}, async (m, sock) => {
    try {
        let aboutText = `🤖 *About ${config.BOT_NAME}* 🤖\n\n`;
        
        // Basic information
        aboutText += `*Version:* ${process.env.npm_package_version || '1.0.0'}\n`;
        aboutText += `*Created by:* ${config.ADMIN_NAME || 'Admin'}\n`;
        aboutText += `*Prefix:* ${config.PREFIX}\n\n`;
        
        // Features
        aboutText += `*Key Features:*\n`;
        aboutText += `• Social media downloads (YouTube, TikTok, IG, FB, Twitter)\n`;
        aboutText += `• Advanced media conversion tools\n`;
        aboutText += `• Group management capabilities\n`;
        aboutText += `• WhatsApp status management\n`;
        aboutText += `• AI-powered conversations\n`;
        aboutText += `• Saved links management\n\n`;
        
        // Commands count
        const commands = listCommands();
        aboutText += `*Total Commands:* ${commands.length}\n\n`;
        
        // Footer
        aboutText += `Type ${config.PREFIX}menu to see all available commands.\n`;
        aboutText += `Type ${config.PREFIX}help <command> for detailed help on a specific command.`;
        
        return await message.reply(aboutText, m, sock);
    } catch (error) {
        console.error('Error in about command:', error);
        return await message.reply(`Error generating about info: ${error.message}`, m, sock);
    }
});
