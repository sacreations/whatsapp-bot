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
  
  get ENABLE_LINK_SAVING() { 
    return this.get('ENABLE_LINK_SAVING', 'true') === 'true'; 
  },
  
  // Privacy settings
  get HIDE_ONLINE_STATUS() {
    return this.get('HIDE_ONLINE_STATUS', 'false') === 'true';
  },
  
  get DISABLE_READ_RECEIPTS() {
    return this.get('DISABLE_READ_RECEIPTS', 'false') === 'true';
  },
  
  // New properties
  get BOT_PAUSED() {
    return this.get('BOT_PAUSED', 'false') === 'true';
  },
  
  get MAINTENANCE_MODE() {
    return this.get('MAINTENANCE_MODE', 'false') === 'true';
  },
  
  get ENABLE_AUTO_MEDIA_DOWNLOAD() {
    return this.get('ENABLE_AUTO_MEDIA_DOWNLOAD', 'true') === 'true';
  },

  get GROQ_API_KEY() {
    return this.get('GROQ_API_KEY', '');
  },

  get ENABLE_AI_AUTO_REPLY() {
    return this.get('ENABLE_AI_AUTO_REPLY', 'true') === 'true';
  },

  get ENABLE_AI_SEARCH() {
    return this.get('ENABLE_AI_SEARCH', 'true') === 'true';
  },

  get AI_ALLOWED_GROUPS() { 
    return this.get('AI_ALLOWED_GROUPS', '').split(',').filter(id => id.trim() !== ''); 
  },

  get ENABLE_AI_WIKIPEDIA() {
    return this.get('ENABLE_AI_WIKIPEDIA', 'true') === 'true';
  },

  get ENABLE_AI_WALLPAPERS() {
    return this.get('ENABLE_AI_WALLPAPERS', 'true') === 'true';
  },

  get AI_MODEL() {
    return this.get('AI_MODEL', 'llama-3.3-70b-versatile');
  },

  get AI_TEMPERATURE() {
    return this.get('AI_TEMPERATURE', '0.7');
  },

  get AI_CONTEXT_LENGTH() {
    return parseInt(this.get('AI_CONTEXT_LENGTH', '5'));
  },

  get ENABLE_AI_HTML_EXTRACT() {
    return this.get('ENABLE_AI_HTML_EXTRACT', 'true') === 'true';
  },

  // Admin information
  get ADMIN_NAME() {
    return this.get('ADMIN_NAME', 'Bot Admin');
  },

  get ADMIN_EMAIL() {
    return this.get('ADMIN_EMAIL', '');
  },

  get ADMIN_BIO() {
    return this.get('ADMIN_BIO', 'WhatsApp Bot Administrator');
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
      console.log(`Setting config value: ${key}=${value}`);
      
      // Read the current config file
      let configContent = fs.readFileSync(configPath, 'utf8');
      
      // Check if key exists
      const keyRegex = new RegExp(`^${key}=.*`, 'gm');
      if (configContent.match(keyRegex)) {
        // Update existing key
        configContent = configContent.replace(keyRegex, `${key}=${value}`);
        console.log(`Updated existing config key: ${key}`);
      } else {
        // Add new key
        configContent += `\n${key}=${value}`;
        console.log(`Added new config key: ${key}`);
      }
      
      // Write back to config file
      fs.writeFileSync(configPath, configContent);
      
      // Reload config
      reloadConfig();
      
      // Update the config object
      this[key] = value;
      
      // Ensure we're handling the new admin fields
      if (key === 'ADMIN_NAME' || key === 'ADMIN_EMAIL' || key === 'ADMIN_BIO') {
        console.log(`Updated admin information: ${key} = ${value}`);
      }
      
      return true;
    } catch (error) {
      console.error(`Error setting config value ${key}:`, error);
      return false;
    }
  }
};

// Add a new config option for FFmpeg processing
config.DISABLE_FFMPEG_PROCESSING = process.env.DISABLE_FFMPEG_PROCESSING === 'true';

// Initial load of config
reloadConfig();

export default config;
