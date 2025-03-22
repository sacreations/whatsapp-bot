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

## Setup

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

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

### Running the Admin Dashboard

```bash
npm run admin
```

The admin dashboard will be available at `http://localhost:3000`

## AI Features

### AI Auto-Reply

The bot uses Groq AI to provide intelligent responses to user messages. To enable:

1. Get a Groq API key from [groq.com](https://groq.com)
2. Add your API key to the `config.env` file:
   ```
   GROQ_API_KEY=your_groq_api_key_here
   ENABLE_AI_AUTO_REPLY=true
   ```

### Real-Time Search

The bot can search the web for current information when answering questions:

## Acknowledgments

Special thanks to darlyn1234 for providing the free public API used in this project.
