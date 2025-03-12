import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, 'config.env') });

const config = {
  // Bot settings
  PREFIX: process.env.PREFIX || '.',
  BOT_NAME: process.env.BOT_NAME || 'WhatsAppBot',
  OWNER_NUMBER: process.env.OWNER_NUMBER || '',
  
  // Session settings
  SESSION_ID: process.env.SESSION_ID || 'bot_session',
  
  // Feature toggles
  ENABLE_AUTO_REPLY: process.env.ENABLE_AUTO_REPLY === 'true',
  ENABLE_SOCIAL_MEDIA_DOWNLOAD: process.env.ENABLE_SOCIAL_MEDIA_DOWNLOAD === 'true',
  ENABLE_AUTO_STATUS_VIEW: process.env.ENABLE_AUTO_STATUS_VIEW === 'true',
  
  // Paths
  DOWNLOAD_FOLDER: process.env.DOWNLOAD_FOLDER || './downloads',
  
  // Group settings
  ALLOWED_DOWNLOAD_GROUPS: (process.env.ALLOWED_DOWNLOAD_GROUPS || '').split(',').filter(id => id.trim() !== ''),
  
  // Create required directories
  createDirectories: () => {
    const dirs = [config.DOWNLOAD_FOLDER];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  }
};

export default config;
