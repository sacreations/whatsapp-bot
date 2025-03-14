import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import fs from 'fs';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Config file path
const configPath = join(__dirname, 'config.env');

// Function to reload environment variables from config file
function reloadConfig() {
  // Clear the environment cache
  Object.keys(process.env).forEach(key => {
    if (!key.startsWith('_') && key !== 'NODE_ENV') {
      delete process.env[key];
    }
  });
  
  // Load fresh environment variables
  dotenv.config({ path: configPath, override: true });
}

const config = {
  // Get config value with dynamic loading
  get: function(key, defaultValue = null) {
    // Reload config from file each time
    reloadConfig();
    return process.env[key] || defaultValue;
  },
  
  // Get all config as an object
  getAll: function() {
    // Reload config from file
    reloadConfig();
    
    return {
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
    };
  },

  // Access specific config properties dynamically via getters
  get PREFIX() { 
    return this.get('PREFIX', '.'); 
  },
  
  get BOT_NAME() { 
    return this.get('BOT_NAME', 'WhatsAppBot'); 
  },
  
  get OWNER_NUMBER() { 
    return this.get('OWNER_NUMBER', ''); 
  },
  
  get SESSION_ID() { 
    return this.get('SESSION_ID', 'bot_session'); 
  },
  
  get ENABLE_AUTO_REPLY() { 
    return this.get('ENABLE_AUTO_REPLY') === 'true'; 
  },
  
  get ENABLE_SOCIAL_MEDIA_DOWNLOAD() { 
    return this.get('ENABLE_SOCIAL_MEDIA_DOWNLOAD') === 'true'; 
  },
  
  get ENABLE_AUTO_STATUS_VIEW() { 
    return this.get('ENABLE_AUTO_STATUS_VIEW') === 'true'; 
  },
  
  get DOWNLOAD_FOLDER() { 
    return this.get('DOWNLOAD_FOLDER', './downloads'); 
  },
  
  get ALLOWED_DOWNLOAD_GROUPS() { 
    return this.get('ALLOWED_DOWNLOAD_GROUPS', '').split(',').filter(id => id.trim() !== ''); 
  },

  get MEDIA_COMPRESSION_LEVEL() { 
    return this.get('MEDIA_COMPRESSION_LEVEL', 'medium'); 
  },
  
  get MAX_VIDEO_RESOLUTION() { 
    return parseInt(this.get('MAX_VIDEO_RESOLUTION', '720')); 
  },
  
  // Create required directories
  createDirectories: () => {
    const dirs = [config.DOWNLOAD_FOLDER];
    
    for (const dir of dirs) {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
        console.log(`Created directory: ${dir}`);
      }
    }
  },
  
  // Save config value to config.env file
  set: function(key, value) {
    try {
      // Read the current config file
      let configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check if key exists
      const keyRegex = new RegExp(`^${key}=.*`, 'gm');
      if (configContent.match(keyRegex)) {
        // Update existing key
        configContent = configContent.replace(keyRegex, `${key}=${value}`);
      } else {
        // Add new key
        configContent += `\n${key}=${value}`;
      }
      
      // Write back to config file
      fs.writeFileSync(configPath, configContent);
      
      // Reload config
      reloadConfig();
      
      return true;
    } catch (error) {
      console.error(`Error setting config value ${key}:`, error);
      return false;
    }
  }
};

// Initial load of config
reloadConfig();

export default config;
