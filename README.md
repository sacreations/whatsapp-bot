# WhatsApp Bot

A modular WhatsApp bot built with Node.js and the @whiskeysockets/baileys library, featuring plugin-based command system, media handling, auto-replies, and social media downloaders.

## Features

- 🔌 Modular plugin-based command system
- 🖼️ Media handling (images, videos, audio, documents, stickers)
- 📥 Social media downloading (YouTube, TikTok, Instagram, Facebook, Twitter)
- 🤖 Auto-reply system with customizable patterns
- 👥 Group management tools
- 🛠️ Utility commands and media conversion

## Installation

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- FFmpeg (for media conversion)

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/sacreations/whatsapp-bot.git
   cd whatsapp-bot
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Configure the bot by copying `config.env.example` to `config.env`:
   ```bash
   cp config.env.example config.env
   ```

4. Edit `config.env` with your settings:
   ```
   PREFIX=.
   OWNER_NUMBER=1234567890
   BOT_NAME=MyWhatsAppBot
   ALLOWED_DOWNLOAD_GROUPS=123456789-1234567,987654321-1234567
   ```

5. Start the bot:
   ```bash
   npm start
   ```

6. Scan the QR code with your WhatsApp account.

## Configuration

The bot can be configured using the `config.env` file:

- `PREFIX` - Command prefix (default: `.`)
- `OWNER_NUMBER` - Your WhatsApp number for owner commands
- `BOT_NAME` - Name of your bot
- `SESSION_ID` - ID for the WhatsApp session
- `ENABLE_AUTO_REPLY` - Enable/disable auto-replies (true/false)
- `ENABLE_SOCIAL_MEDIA_DOWNLOAD` - Enable/disable social media downloaders (true/false)
- `DOWNLOAD_FOLDER` - Path to save downloaded files
- `ALLOWED_DOWNLOAD_GROUPS` - Comma-separated list of group IDs where auto-downloading is allowed

## Available Commands

### User Commands

- `.menu` - Display available commands
- `.help <command>` - Get help for a specific command
- `.info` - Show bot information
- `.ping` - Check if bot is online and measure response time
- `.echo <text>` - Repeat the given text
- `.sticker` - Convert image to sticker
- `.status` - Check bot status and uptime
- `.save` - Save media from message
- `.convert <format>` - Convert media to different format
- `.mediainfo` - Get information about media
- `.yt <URL>` - Download YouTube videos
- `.tiktok <URL>` - Download TikTok videos
- `.ig <URL>` - Download Instagram posts/reels
- `.fb <URL>` - Download Facebook videos
- `.twitter <URL>` - Download Twitter/X media
- `.x <URL>` - Alias for twitter command
- `.groupinfo` - Get information about the current group
- `.groupmembers` - List all members in the group

### Owner Commands

- `.getgroups` - Get the list of all group IDs
- `.sysinfo` - Get detailed system information
- `.testall` - Test all message types
- `.netstat` - Test network connectivity and latency
- `.add <number>` - Add a user to the group
- `.kick <@mention>` - Remove a user from the group
- `.promote <@mention>` - Promote a user to admin
- `.demote <@mention>` - Demote an admin to regular user

## Automatic Features

The bot includes automatic functionality:

1. **Social Media Auto-Download**:
   - Automatically detects links from YouTube, TikTok, Instagram, Facebook, and Twitter
   - Downloads media and sends it in the chat (works only in allowed groups)

2. **Auto-Replies**:
   - Responds to common greetings
   - Can be expanded with custom patterns

## Plugin System

The bot uses a modular plugin system for easy extension:

### Creating a Plugin

1. Create a new .js file in the `plugins` directory:

```javascript
// plugins/myplugin.js
import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import config from '../Config.js';

bot({
    pattern: 'hello',
    fromMe: false,
    desc: 'Says hello to the user'
}, async (m, sock) => {
    return await message.reply('Hello, world!', m, sock);
});
```

2. The bot will automatically load your plugin on startup or reconnection.

### Plugin Structure

Each plugin should export one or more commands using the `bot()` function:

```javascript
bot({
    pattern: 'commandname',    // Command pattern (e.g., 'hello')
    fromMe: false,             // Whether command can only be used by the bot owner
    desc: 'Description',       // Command description for help
    usage: '<arguments>'       // Usage example
}, async (m, sock, args) => {
    // Command implementation
    return await message.reply('Response text', m, sock);
});
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the ISC License.
