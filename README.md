# WhatsApp Bot

An advanced WhatsApp bot with plugin-based commands, social media downloaders, group management, and AI-powered features.

## Features

- **AI-Powered Assistant** - Intelligent responses to user messages powered by advanced AI capabilities:
  - **Auto-Reply**: Responds to user queries using natural language understanding
  - **Real-time Search**: Fetches current information from the web
  - **Wikipedia Integration**: Retrieves factual information from Wikipedia
  - **Wallpaper Search**: Finds and sends wallpapers on request
  - **HTML Extraction**: Analyzes webpage content and provides insights
  
- **Social Media Downloaders**
  - YouTube videos and audio
  - TikTok videos
  - Instagram posts and reels
  - Facebook videos
  - Twitter/X media

- **Group Management**
  - Admin tools
  - Anti-spam features
  - Welcome messages

- **Status Viewing**
  - Automatic status viewing
  - Status saving

- **Admin Dashboard**
  - Web interface for management
  - Configuration controls
  - Message sending
  - Statistics and logs

- **Advanced Connection Management**
  - Automatic session recovery
  - Exponential backoff for reconnections
  - Network connectivity checks
  - Intelligent error handling

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)
- Stable internet connection

### Installation

1. Clone the repository
   ```bash
   git clone https://github.com/yourusername/whatsapp-bot.git
   cd whatsapp-bot
   ```

2. Install dependencies
   ```bash
   npm install
   ```

3. Set up configuration
   - Copy `config.env.example` to `config.env`
   - Edit `config.env` with your settings:
     ```
     PREFIX=.
     OWNER_NUMBER=1234567890
     BOT_NAME=WhatsAppBot
     SESSION_ID=bot_session
     ADMIN_PASSWORD=your_secure_password
     GROQ_API_KEY=your_groq_api_key_here
     ```

4. Run the bot
   ```bash
   npm start
   ```

5. Scan the QR code with WhatsApp to authenticate

### Session Management

- The bot automatically handles session management with intelligent recovery
- Sessions are stored in the `sessions/` directory
- If connection issues persist, the bot will automatically clear invalid sessions
- The bot uses exponential backoff to avoid overwhelming WhatsApp servers
- Network connectivity is checked before attempting reconnections

### Running the Admin Dashboard

```bash
npm run admin
```

The admin dashboard will be available at `http://localhost:3000`

## AI Features

### AI Auto-Reply

The bot uses Google Gemini AI to provide intelligent responses to user messages. It is designed to give direct, confident answers for factual and real-time queries, using web search or Wikipedia when needed. The bot avoids unnecessary disclaimers and provides the best available answer based on current information.

To enable:

1. Get a Gemini API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Add your API key to the `config.env` file:
   ```
   GEMINI_API_KEY=your_gemini_api_key_here
   ENABLE_AI_AUTO_REPLY=true
   ```

### Real-Time Search

The bot can search the web for current information when answering questions. It will use the most relevant facts found and state answers directly and confidently.

## Troubleshooting

### Connection Issues

- **405 Method Not Allowed (Connection Failure)**: 
  - This indicates WhatsApp servers are rejecting the connection
  - The bot automatically implements exponential backoff (2s, 4s, 8s, 16s, etc.)
  - After 10 failed attempts, the session is automatically cleared
  - Check your internet connection and try again
  - If persistent, wait 15-30 minutes before restarting

- **401 Unauthorized**: 
  - Session expired or invalid
  - Bot automatically clears session and shows new QR code
  - Simply scan the new QR code to reconnect

- **409 Conflict**: 
  - Another device is using the same WhatsApp account
  - Log out from other devices or use a different account

- **428 Precondition Required**: 
  - WhatsApp requires QR code scan
  - Bot will automatically clear session and show QR code

### Network and Performance Issues

- **Connection timeouts**: 
  - Check your internet connection stability
  - Ensure firewall isn't blocking the connection
  - The bot automatically checks network connectivity before reconnecting

- **QR code not appearing**: 
  - Ensure terminal supports QR code display
  - Check console logs for any errors
  - Try restarting the bot

### Session Problems

- **Persistent connection failures**:
  1. Stop the bot (Ctrl+C)
  2. Delete the `sessions/` directory manually
  3. Restart the bot
  4. Scan the new QR code

- **Bot stuck in reconnection loop**:
  1. Check your internet connection
  2. Wait for the automatic session clearing (after 10 attempts)
  3. If needed, manually restart the bot

### Performance Optimization

- **High memory usage**: The bot includes automatic memory monitoring
- **Multiple failed requests**: API key rotation is implemented for better reliability
- **Slow responses**: Response caching reduces repeated processing

## Best Practices

- **Stable Internet**: Ensure a stable internet connection for best performance
- **Regular Monitoring**: Check logs regularly for any connection issues
- **Session Backup**: The bot handles session management automatically
- **Resource Management**: The bot includes built-in memory and performance monitoring

## Acknowledgments

Special thanks to darlyn1234 for providing the free public API used in this project.
