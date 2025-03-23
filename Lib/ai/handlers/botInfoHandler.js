import config from '../../../Config.js';
import { listCommands } from '../../chat/commandHandler.js';

/**
 * Generate a comprehensive response about bot functionality
 * @returns {string} Formatted bot information
 */
export function generateBotInfo() {
    // Get all commands
    const commands = listCommands();
    
    let botInfo = `I'm ${config.BOT_NAME}, a WhatsApp assistant bot created by ${config.ADMIN_NAME || 'the admin'}. Here's what I can do:\n\n`;
    
    // Core capabilities
    botInfo += "📱 *My Capabilities*:\n";
    botInfo += "• Answer your questions using AI\n";
    botInfo += "• Download videos from social media platforms\n";
    botInfo += "• Process and convert media files\n";
    botInfo += "• Manage WhatsApp groups\n";
    botInfo += "• Handle WhatsApp statuses\n";
    botInfo += "• Save links for later downloading\n\n";
    
    // Command categories
    botInfo += "🔍 *Command Categories*:\n";
    botInfo += `• Social Media: ${config.PREFIX}yt, ${config.PREFIX}tiktok, ${config.PREFIX}ig, ${config.PREFIX}fb\n`;
    botInfo += `• Media Tools: ${config.PREFIX}save, ${config.PREFIX}convert, ${config.PREFIX}mediainfo\n`;
    botInfo += `• Status: ${config.PREFIX}poststatus, ${config.PREFIX}liststatus, ${config.PREFIX}autostatus\n`;
    botInfo += `• Groups: ${config.PREFIX}groupinfo, ${config.PREFIX}add, ${config.PREFIX}kick\n`;
    botInfo += `• Utilities: ${config.PREFIX}wallpaper, ${config.PREFIX}savedlinks\n\n`;
    
    // Example usages
    botInfo += "💡 *Popular Commands*:\n";
    botInfo += `• ${config.PREFIX}yt [URL] - Download YouTube videos\n`;
    botInfo += `• ${config.PREFIX}wallpaper [query] - Find wallpapers\n`;
    botInfo += `• ${config.PREFIX}convert [format] - Convert media files\n`;
    botInfo += `• ${config.PREFIX}menu - See all commands\n\n`;
    
    botInfo += `For a full list of commands, type ${config.PREFIX}menu\n`;
    botInfo += `For help with a specific command, type ${config.PREFIX}help [command]`;
    
    return botInfo;
}

/**
 * Generate information about a specific command category
 * @param {string} category - The command category
 * @returns {string} Formatted category information
 */
export function generateCategoryInfo(category) {
    const commands = listCommands();
    let categoryInfo = "";
    
    switch(category.toLowerCase()) {
        case "social":
        case "socialmedia":
        case "social media":
            categoryInfo = "📱 *Social Media Commands*:\n\n";
            categoryInfo += `• ${config.PREFIX}yt [URL] - Download YouTube videos/audio\n`;
            categoryInfo += `• ${config.PREFIX}tiktok [URL] - Download TikTok videos\n`;
            categoryInfo += `• ${config.PREFIX}ig [URL] - Download Instagram posts/reels\n`;
            categoryInfo += `• ${config.PREFIX}fb [URL] - Download Facebook videos\n`;
            categoryInfo += `• ${config.PREFIX}twitter [URL] - Download Twitter/X media\n\n`;
            
            categoryInfo += "*Examples*:\n";
            categoryInfo += `${config.PREFIX}yt https://youtube.com/watch?v=example\n`;
            categoryInfo += `${config.PREFIX}yt https://youtube.com/watch?v=example audio\n`;
            break;
            
        case "media":
        case "mediatools":
        case "media tools":
            categoryInfo = "🎬 *Media Tool Commands*:\n\n";
            categoryInfo += `• ${config.PREFIX}save - Save media from message\n`;
            categoryInfo += `• ${config.PREFIX}convert [format] - Convert media format\n`;
            categoryInfo += `• ${config.PREFIX}mediainfo - Get media information\n`;
            categoryInfo += `• ${config.PREFIX}statusready - Make video ready for status\n`;
            categoryInfo += `• ${config.PREFIX}wallpaper [query] - Search for wallpapers\n\n`;
            
            categoryInfo += "*Examples*:\n";
            categoryInfo += `Reply to media with ${config.PREFIX}save\n`;
            categoryInfo += `Reply to video with ${config.PREFIX}convert mp3\n`;
            break;
            
        case "status":
        case "statuses":
            categoryInfo = "📊 *Status Commands*:\n\n";
            categoryInfo += `• ${config.PREFIX}autostatus [on/off] - Toggle auto status view\n`;
            categoryInfo += `• ${config.PREFIX}liststatus - List saved statuses\n`;
            categoryInfo += `• ${config.PREFIX}contacts - Show saved contacts info\n`;
            categoryInfo += `• ${config.PREFIX}poststatus - Post media as status\n\n`;
            
            categoryInfo += "*Examples*:\n";
            categoryInfo += `${config.PREFIX}autostatus on\n`;
            categoryInfo += `Reply to image with ${config.PREFIX}poststatus\n`;
            break;
            
        case "group":
        case "groups":
            categoryInfo = "👥 *Group Management Commands*:\n\n";
            categoryInfo += `• ${config.PREFIX}groupinfo - Get group information\n`;
            categoryInfo += `• ${config.PREFIX}groupmembers - List all members\n`;
            categoryInfo += `• ${config.PREFIX}add [number] - Add user to group\n`;
            categoryInfo += `• ${config.PREFIX}kick - Remove user from group\n`;
            categoryInfo += `• ${config.PREFIX}promote - Promote user to admin\n`;
            categoryInfo += `• ${config.PREFIX}demote - Demote admin to regular user\n\n`;
            
            categoryInfo += "*Examples*:\n";
            categoryInfo += `${config.PREFIX}add 94123456789\n`;
            categoryInfo += `Reply to message with ${config.PREFIX}kick\n`;
            break;
            
        case "links":
        case "savedlinks":
        case "saved links":
            categoryInfo = "🔗 *Saved Links Commands*:\n\n";
            categoryInfo += `• ${config.PREFIX}savedlinks - List saved links\n`;
            categoryInfo += `• ${config.PREFIX}dllink [URL] - Download a saved link\n`;
            categoryInfo += `• ${config.PREFIX}dlall - Download all saved links\n`;
            categoryInfo += `• ${config.PREFIX}clearsaved - Clear all saved links\n\n`;
            
            categoryInfo += "*Examples*:\n";
            categoryInfo += `${config.PREFIX}savedlinks\n`;
            categoryInfo += `${config.PREFIX}dllink https://youtube.com/watch?v=example\n`;
            break;
            
        default:
            categoryInfo = `I don't have specific information about "${category}" commands. Please use ${config.PREFIX}menu to see all available command categories.`;
    }
    
    return categoryInfo;
}

/**
 * Handle bot command inquiries for AI responses
 * @param {string} query - User's query
 * @returns {string} Information about commands
 */
export function handleCommandInquiry(query) {
    // Clean and normalize the query
    const cleanQuery = query.toLowerCase().trim();
    
    // Check for specific command inquiries
    if (cleanQuery.includes('youtube') || cleanQuery.includes('yt command')) {
        return `*YouTube Download Command*\n\n` +
               `Command: ${config.PREFIX}yt [URL] [options]\n\n` +
               `Options:\n` +
               `• audio - Download audio only\n` +
               `• hq - High quality video\n` +
               `• lq - Low quality/smaller file\n\n` +
               `Examples:\n` +
               `${config.PREFIX}yt https://youtube.com/watch?v=example\n` +
               `${config.PREFIX}yt https://youtu.be/example audio\n` +
               `${config.PREFIX}yt https://youtube.com/watch?v=example hq`;
    }
    
    if (cleanQuery.includes('instagram') || cleanQuery.includes('ig command')) {
        return `*Instagram Download Command*\n\n` +
               `Command: ${config.PREFIX}ig [URL]\n\n` +
               `Use this command to download posts, reels, and stories from Instagram.\n\n` +
               `Example:\n` +
               `${config.PREFIX}ig https://www.instagram.com/p/example/\n` +
               `${config.PREFIX}ig https://www.instagram.com/reel/example/`;
    }
    
    if (cleanQuery.includes('tiktok') || cleanQuery.includes('tiktok command')) {
        return `*TikTok Download Command*\n\n` +
               `Command: ${config.PREFIX}tiktok [URL]\n\n` +
               `Use this command to download videos from TikTok.\n\n` +
               `Example:\n` +
               `${config.PREFIX}tiktok https://www.tiktok.com/@username/video/1234567890`;
    }
    
    if (cleanQuery.includes('wallpaper') || cleanQuery.includes('wallpaper command')) {
        return `*Wallpaper Search Command*\n\n` +
               `Command: ${config.PREFIX}wallpaper [query]\n\n` +
               `Use this command to search and download wallpapers.\n\n` +
               `Examples:\n` +
               `${config.PREFIX}wallpaper nature\n` +
               `${config.PREFIX}wallpaper cute cats\n` +
               `${config.PREFIX}wallpaper mountains sunset`;
    }
    
    if (cleanQuery.includes('convert') || cleanQuery.includes('conversion')) {
        return `*Media Conversion Command*\n\n` +
               `Command: ${config.PREFIX}convert [format]\n\n` +
               `Formats: mp3, mp4, gif, webp, jpg, png\n\n` +
               `Reply to any media with this command to convert it to your desired format.\n\n` +
               `Examples:\n` +
               `Reply to video with ${config.PREFIX}convert mp3\n` +
               `Reply to image with ${config.PREFIX}convert webp`;
    }
    
    // Generic request for command information
    return generateBotInfo();
}
