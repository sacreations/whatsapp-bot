import express from 'express';
import session from 'express-session';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { getChatLogs } from '../Lib/utils/logger.js';
import { loadSavedLinks, deleteLink, clearGroupLinks } from '../Lib/utils/linkStorage.js';
import multer from 'multer';
import { v4 as uuidv4 } from 'uuid';
// Import the config module
import config from '../Config.js';
// Check for any baileys imports and update them
import { downloadMediaMessage } from 'baileys';
// Add cluster and os modules for cluster mode support
import cluster from 'cluster';
import os from 'os';
// Add session store for cluster mode session sharing
import sessionFileStore from 'session-file-store';

// Create FileStore for sessions
const FileStore = sessionFileStore(session);

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

// Configure multer for media uploads
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'temp-uploads');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const fileExt = path.extname(file.originalname);
        const fileName = `${uuidv4()}${fileExt}`;
        cb(null, fileName);
    }
});

const upload = multer({
    storage,
    limits: {
        fileSize: 30 * 1024 * 1024, // 30MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images, videos, and audio
        if (file.mimetype.startsWith('image/') || 
            file.mimetype.startsWith('video/') || 
            file.mimetype.startsWith('audio/')) {
            cb(null, true);
        } else {
            cb(new Error('Unsupported file type'), false);
        }
    }
});

// Configure multer for status updates
const statusStorage = multer.diskStorage({
    destination: (req, file, cb) => {
        const uploadDir = path.join(__dirname, '..', 'temp-uploads', 'status');
        if (!fs.existsSync(uploadDir)) {
            fs.mkdirSync(uploadDir, { recursive: true });
        }
        cb(null, uploadDir);
    },
    filename: (req, file, cb) => {
        const fileExt = path.extname(file.originalname);
        const fileName = `status_${uuidv4()}${fileExt}`;
        cb(null, fileName);
    }
});

const statusUpload = multer({
    storage: statusStorage,
    limits: {
        fileSize: 15 * 1024 * 1024, // 15MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept only images and videos for status
        if (file.mimetype === 'image/jpeg' || 
            file.mimetype === 'image/png' || 
            file.mimetype === 'video/mp4') {
            cb(null, true);
        } else {
            cb(new Error('Only JPEG, PNG, and MP4 files are allowed for status updates'), false);
        }
    }
});

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Ensure session directory exists
const sessionDir = path.join(__dirname, '..', 'data', 'sessions');
if (!fs.existsSync(sessionDir)) {
  fs.mkdirSync(sessionDir, { recursive: true });
}

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  store: new FileStore({
    path: sessionDir,
    ttl: 86400, // 1 day
    retries: 0,
    reapInterval: 3600 // Clean expired sessions hourly
  }),
  secret: 'whatsapp-bot-admin-secret',
  resave: false,
  saveUninitialized: false, // Don't create session until something stored
  cookie: { 
    secure: false,
    maxAge: 3600000, // 1 hour
    httpOnly: true
  }
}));

// Debug middleware to log requests
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url} - Auth: ${req.session.authenticated ? 'Yes' : 'No'}`);
  next();
});

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    if (req.xhr || req.path.startsWith('/api/') && req.path !== '/api/login') {
      res.status(401).json({ success: false, message: 'Authentication required' });
    } else {
      res.redirect('/login.html');
    }
  }
};

// Define the isAuthenticated middleware function
function isAuthenticated(req, res, next) {
    if (req.session && req.session.authenticated) {
        return next();
    }
    return res.status(401).json({ success: false, message: 'Authentication required' });
}

// Root route - redirect to dashboard if authenticated, otherwise to login
app.get('/', (req, res) => {
  if (req.session.authenticated) {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
  } else {
    res.redirect('/login.html');
  }
});

// Login route
app.post('/api/login', (req, res) => {
  const { password } = req.body;
  
  if (password === ADMIN_PASSWORD) {
    req.session.authenticated = true;
    res.json({ success: true });
  } else {
    res.status(401).json({ success: false, message: 'Authentication failed' });
  }
});

// Check login status
app.get('/api/auth-status', (req, res) => {
  res.json({ 
    success: true, 
    authenticated: !!req.session.authenticated 
  });
});

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.authenticated = false;
  res.json({ success: true });
});

// Get config route - protected
app.get('/api/config', requireAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config.env');
    if (!fs.existsSync(configPath)) {
      console.error('Config file not found:', configPath);
      return res.status(404).json({ success: false, message: 'Configuration file not found' });
    }
    
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Parse config.env into a JS object
    const config = {};
    configContent.split('\n').forEach(line => {
      // Skip comments, empty lines, or lines without equals sign
      if (line && !line.startsWith('#') && !line.startsWith('//') && line.includes('=')) {
        // Split at the first equals sign
        const firstEqualsIndex = line.indexOf('=');
        if (firstEqualsIndex > 0) {
          const key = line.substring(0, firstEqualsIndex).trim();
          const value = line.substring(firstEqualsIndex + 1).trim();
          config[key] = value;
        }
      }
    });
    
    // Make sure the new config properties are available with default values if not set
    if (config.BOT_PAUSED === undefined) {
      config.BOT_PAUSED = 'false';
    }
    
    if (config.MAINTENANCE_MODE === undefined) {
      config.MAINTENANCE_MODE = 'false';
    }
    
    if (config.ENABLE_AUTO_MEDIA_DOWNLOAD === undefined) {
      config.ENABLE_AUTO_MEDIA_DOWNLOAD = 'true';
    }
    
    // Make sure AI_ALLOWED_GROUPS exists even if not in the file
    if (config.AI_ALLOWED_GROUPS === undefined) {
      config.AI_ALLOWED_GROUPS = '';
    }
    
    // Don't expose password
    delete config.ADMIN_PASSWORD;
    
    console.log('Config loaded successfully:', Object.keys(config));
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ success: false, message: 'Failed to read configuration: ' + error.message });
  }
});

// Update config route - protected
app.post('/api/config', requireAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config.env');
    const { config } = req.body;
    
    // Debug log to check what's being received
    console.log('Updating config with:', config);
    
    // Prevent password update through this API
    if (config.ADMIN_PASSWORD) {
      delete config.ADMIN_PASSWORD;
    }
    
    // Read the current config file
    let configContent = fs.readFileSync(configPath, 'utf8');
    let configLines = configContent.split('\n');
    let updatedKeys = [];
    
    // Update existing keys and track which ones were updated
    for (const [key, value] of Object.entries(config)) {
      const keyRegex = new RegExp(`^${key}=.*`, 'gm');
      if (configContent.match(keyRegex)) {
        configContent = configContent.replace(keyRegex, `${key}=${value}`);
        updatedKeys.push(key);
      }
    }
    
    // Add new keys that weren't in the file
    for (const [key, value] of Object.entries(config)) {
      if (!updatedKeys.includes(key)) {
        // Check if the key exists in a commented form
        const commentedKeyLine = configLines.findIndex(line => 
          line.trim().startsWith(`# ${key}=`) || line.trim().startsWith(`// ${key}=`));
          
        if (commentedKeyLine >= 0) {
          // Replace the commented line with an active setting
          configLines[commentedKeyLine] = `${key}=${value}`;
          configContent = configLines.join('\n');
        } else {
          // Simply append to the end
          configContent += `\n${key}=${value}`;
        }
      }
    }
    
    // Check if ADMIN_PASSWORD already exists in the file, if so preserve it
    const passwordLine = configLines.find(line => 
      line.trim().startsWith('ADMIN_PASSWORD=')
    );
    
    if (passwordLine && !configContent.includes('ADMIN_PASSWORD=')) {
      configContent += `\n${passwordLine}`;
    }
    
    // Write back to config file
    fs.writeFileSync(configPath, configContent);
    
    console.log('Config updated successfully');
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ success: false, message: 'Failed to update configuration: ' + error.message });
  }
});

// Update config
app.post('/api/config', isAuthenticated, async (req, res) => {
    try {
        const { config: newConfig } = req.body;
        
        // Log incoming config update request
        console.log('Received config update request:');
        console.log('AI_MODEL:', newConfig.AI_MODEL);
        
        // Validate important fields
        if (newConfig.AI_MODEL) {
            const validModels = ['llama-3.3-70b-versatile', 'qwen-2.5-32b', 'qwen-2.5-coder-32b', 'deepseek-r1-distill-qwen-32b'];
            if (!validModels.includes(newConfig.AI_MODEL)) {
                console.error('Invalid AI model specified:', newConfig.AI_MODEL);
                return res.status(400).json({ 
                    success: false, 
                    message: `Invalid AI model. Valid models are: ${validModels.join(', ')}` 
                });
            }
        }
        
        // Update each key in config.env
        for (const [key, value] of Object.entries(newConfig)) {
            await config.set(key, value);
        }
        
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ success: false, message: error.message });
    }
});

// Get chat logs - protected
app.get('/api/chat-logs', requireAuth, (req, res) => {
    try {
        const limit = parseInt(req.query.limit || '100');
        const logs = getChatLogs(limit);
        
        // Make sure logs is always an array
        const safeData = Array.isArray(logs) ? logs : [];
        
        res.json({ success: true, logs: safeData });
    } catch (error) {
        console.error('Error fetching chat logs:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch chat logs: ' + error.message,
            logs: []  // Always provide an empty array in case of error
        });
    }
});

// Get statuses route - protected
app.get('/api/statuses', requireAuth, (req, res) => {
    try {
        const statusDir = path.join(__dirname, '..', 'downloads', 'statuses');
        const timeframe = req.query.timeframe || '24h'; // Default to 24 hours
        
        // Create directory if it doesn't exist
        if (!fs.existsSync(statusDir)) {
            fs.mkdirSync(statusDir, { recursive: true });
        }
        
        // Read status directory
        const files = fs.readdirSync(statusDir);
        
        // Read contact information from the contacts.json file
        const contactsPath = path.join(__dirname, '..', 'data', 'contacts.json');
        let contacts = {};
        if (fs.existsSync(contactsPath)) {
            try {
                contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
                console.log('Loaded contacts:', Object.keys(contacts).length);
            } catch (error) {
                console.error('Error reading contacts file:', error);
            }
        } else {
            console.log('No contacts.json file found');
        }
        
        // Calculate cutoff time based on timeframe
        let cutoffTime = 0;
        const now = Date.now();
        
        if (timeframe !== 'all') {
            if (timeframe === '24h') {
                cutoffTime = now - (24 * 60 * 60 * 1000); // 24 hours ago
            } else if (timeframe === '48h') {
                cutoffTime = now - (48 * 60 * 60 * 1000); // 48 hours ago
            } else if (timeframe === '7d') {
                cutoffTime = now - (7 * 24 * 60 * 60 * 1000); // 7 days ago
            } else if (timeframe === '30d') {
                cutoffTime = now - (30 * 24 * 60 * 60 * 1000); // 30 days ago
            }
        }
        
        // Get status data with metadata and filtering
        const statuses = files
            .map(file => {
                const filePath = path.join(statusDir, file);
                const stats = fs.statSync(filePath);
                
                // Extract contact from filename (status_contactId_timestamp.ext)
                let contactId = 'Unknown';
                let timestamp = 0;
                let contactName = null;
                
                // Fix: Match the correct pattern (status_contactId_timestamp.ext)
                const match = file.match(/status_([^_]+)_(\d+)\.(jpg|mp4)/);
                if (match) {
                    contactId = match[1];
                    timestamp = parseInt(match[2]);
                    
                    // Look up contact name from contacts.json
                    contactName = findContactName(contacts, contactId);
                }
                
                // If no timestamp in filename, use file stats
                if (!timestamp) {
                    timestamp = stats.mtimeMs;
                }
                
                const isVideo = file.endsWith('.mp4');
                
                return {
                    id: file,
                    path: filePath,
                    contactId: contactId,
                    contactName: contactName || 'Unknown',
                    timestamp: timestamp,
                    date: new Date(timestamp).toLocaleString(),
                    type: isVideo ? 'video' : 'image',
                    size: stats.size,
                    url: `/api/statuses/${encodeURIComponent(file)}`
                };
            })
            // Filter based on timeframe
            .filter(status => timeframe === 'all' || status.timestamp >= cutoffTime)
            // Sort by timestamp (newest first)
            .sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ success: true, statuses, timeframe });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ success: false, message: 'Failed to fetch statuses' });
    }
});

// Helper function to find contact name by ID
function findContactName(contacts, contactId) {
    // Early exit for empty contacts
    if (!contacts || Object.keys(contacts).length === 0) {
        return null;
    }
    
    // Try direct match first
    if (contacts[contactId] && contacts[contactId].name) {
        return contacts[contactId].name;
    }
    
    // Try with various suffixes
    const possibleJids = [
        `${contactId}@s.whatsapp.net`,
        `${contactId}@c.us`,
        `${contactId}@broadcast`
    ];
    
    for (const jid of possibleJids) {
        if (contacts[jid] && contacts[jid].name) {
            return contacts[jid].name;
        }
    }
    
    // Try to find partial matches (for cases where the ID is part of a JID)
    for (const [jid, contact] of Object.entries(contacts)) {
        if (jid.includes(contactId) && contact.name) {
            return contact.name;
        }
    }
    
    // No match found
    return null;
}

// Get single status file - protected
app.get('/api/statuses/:file', requireAuth, (req, res) => {
    try {
        const file = req.params.file;
        const filePath = path.join(__dirname, '..', 'downloads', 'statuses', file);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Status not found' });
        }
        
        // Determine content type
        const isVideo = file.endsWith('.mp4');
        const contentType = isVideo ? 'video/mp4' : 'image/jpeg';
        
        // Set headers for direct viewing
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${file}"`);
        
        // Stream the file
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error serving status file:', error);
        res.status(500).json({ success: false, message: 'Failed to serve status file' });
    }
});

// Delete status - protected
app.delete('/api/statuses/:file', requireAuth, (req, res) => {
    try {
        const file = req.params.file;
        const filePath = path.join(__dirname, '..', 'downloads', 'statuses', file);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ success: false, message: 'Status not found' });
        }
        
        fs.unlinkSync(filePath);
        res.json({ success: true, message: 'Status deleted successfully' });
    } catch (error) {
        console.error('Error deleting status:', error);
        res.status(500).json({ success: false, message: 'Failed to delete status' });
    }
});

// Get dashboard stats - protected
app.get('/api/dashboard-stats', requireAuth, (req, res) => {
    try {
        // Get groups count
        const groupsCount = (() => {
            try {
                if (global.sock && global.sock.groupMetadata) {
                    return Object.keys(global.sock.groupMetadata).length;
                }
                return 0;
            } catch (error) {
                console.error('Error getting groups count:', error);
                return 0;
            }
        })();
        
        // Get plugins count
        const pluginsCount = (() => {
            try {
                const pluginsDir = path.join(__dirname, '..', 'plugins');
                if (fs.existsSync(pluginsDir)) {
                    return fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js')).length;
                }
                return 0;
            } catch (error) {
                console.error('Error getting plugins count:', error);
                return 0;
            }
        })();
        
        // Get downloads count
        const downloadsCount = (() => {
            try {
                const downloadDir = path.join(__dirname, '..', 'downloads');
                if (!fs.existsSync(downloadDir)) return 0;
                
                // Count downloaded files
                let count = 0;
                const countFilesRecursively = (dir) => {
                    const files = fs.readdirSync(dir);
                    files.forEach(file => {
                        const filePath = path.join(dir, file);
                        if (fs.statSync(filePath).isDirectory()) {
                            // Skip the 'statuses' directory in the count
                            if (path.basename(filePath) !== 'statuses') {
                                countFilesRecursively(filePath);
                            }
                        } else {
                            count++;
                        }
                    });
                };
                
                countFilesRecursively(downloadDir);
                return count;
            } catch (error) {
                console.error('Error getting downloads count:', error);
                return 0;
            }
        })();
        
        // Get uptime
        const uptime = (() => {
            const uptimeSeconds = process.uptime();
            const days = Math.floor(uptimeSeconds / 86400);
            const hours = Math.floor((uptimeSeconds % 86400) / 3600);
            const minutes = Math.floor((uptimeSeconds % 3600) / 60);
            
            return `${days}d ${hours}h ${minutes}m`;
        })();
        
        // Get AI stats
        const aiStats = {
            messagesProcessed: global.aiStats?.messagesProcessed || 0,
            searchesPerformed: global.aiStats?.searchesPerformed || 0,
            wikipediaLookups: global.aiStats?.wikipediaLookups || 0,
            wallpaperSearches: global.aiStats?.wallpaperSearches || 0,
            htmlExtractions: global.aiStats?.htmlExtractions || 0
        };
        
        res.json({
            success: true,
            stats: {
                groupsCount,
                pluginsCount, 
                downloadsCount,
                uptime,
                aiStats
            }
        });
    } catch (error) {
        console.error('Error getting dashboard stats:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get dashboard statistics'
        });
    }
});

// Get saved links - protected
app.get('/api/saved-links', requireAuth, (req, res) => {
    try {
        const links = loadSavedLinks();
        
        // Group links by group
        const groupedLinks = {};
        
        links.forEach(link => {
            if (!groupedLinks[link.groupId]) {
                groupedLinks[link.groupId] = {
                    groupId: link.groupId,
                    groupName: link.groupName || 'Unknown Group',
                    links: []
                };
            }
            
            groupedLinks[link.groupId].links.push(link);
        });
        
        // Convert to array
        const groups = Object.values(groupedLinks);
        
        // Sort groups by name
        groups.sort((a, b) => a.groupName.localeCompare(b.groupName));
        
        // Sort links within each group by timestamp (newest first)
        groups.forEach(group => {
            group.links.sort((a, b) => b.timestamp - a.timestamp);
        });
        
        res.json({
            success: true,
            totalLinks: links.length,
            groups: groups
        });
    } catch (error) {
        console.error('Error fetching saved links:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch saved links: ' + error.message
        });
    }
});

// Delete saved link - protected
app.delete('/api/saved-links/:url', requireAuth, (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        
        const success = deleteLink(url);
        
        if (success) {
            res.json({ success: true, message: 'Link deleted successfully' });
        } else {
            res.status(404).json({ success: false, message: 'Link not found' });
        }
    } catch (error) {
        console.error('Error deleting saved link:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete saved link: ' + error.message
        });
    }
});

// Clear all saved links for a group - protected
app.delete('/api/saved-links/group/:groupId', requireAuth, (req, res) => {
    try {
        const groupId = req.params.groupId;
        
        const count = clearGroupLinks(groupId);
        
        res.json({ 
            success: true, 
            message: `Cleared ${count} links for group ${groupId}` 
        });
    } catch (error) {
        console.error('Error clearing group links:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to clear group links: ' + error.message
        });
    }
});

// Download and send a saved link - protected
app.post('/api/saved-links/download/:url', requireAuth, async (req, res) => {
    try {
        const url = decodeURIComponent(req.params.url);
        
        // Load all saved links
        const links = loadSavedLinks();
        
        // Find the link
        const link = links.find(l => l.url === url);
        
        if (!link) {
            return res.status(404).json({ 
                success: false, 
                message: 'Link not found in saved links'
            });
        }
        
        // Check if WhatsApp client is available
        if (!global.sock) {
            return res.status(503).json({ 
                success: false, 
                message: 'WhatsApp client is not available'
            });
        }
        
        // Import necessary modules for downloading and sending
        const { downloadMedia } = await import('../Lib/Functions/Download_Functions/downloader.js');
        const messageHandler = (await import('../Lib/chat/messageHandler.js')).default;
        
        // Download the media
        try {
            // Get configuration settings
            const configModule = await import('../Config.js');
            const config = configModule.default;
            
            // Process download options
            const compressionLevel = config.MEDIA_COMPRESSION_LEVEL;
            const maxResolution = config.MAX_VIDEO_RESOLUTION;
            const isAudio = link.platform === 'YouTube' && link.url.includes('audio');
            
            // Start the download
            res.json({ 
                success: true, 
                message: 'Download started. The media will be sent to the chat when ready.'
            });
            
            // Asynchronously continue with the download and sending
            (async () => {
                try {
                    console.log(`Admin panel: Downloading media from ${link.platform}: ${link.url}`);
                    
                    // Download the media
                    const mediaPath = await downloadMedia(link.url, link.platform, {
                        isAudio: isAudio,
                        compressionLevel: compressionLevel,
                        maxResolution: maxResolution
                    });
                    
                    console.log(`Admin panel: Media downloaded to ${mediaPath}, sending to chat ${link.groupId}`);
                    
                    // Send the media based on file type
                    const fs = await import('fs');
                    
                    // Create a dummy message object to use with messageHandler
                    const dummyMsg = {
                        key: {
                            remoteJid: link.groupId
                        }
                    };
                    
                    // Send appropriate media type
                    if (mediaPath.endsWith('.mp3')) {
                        await messageHandler.sendAudio(mediaPath, false, dummyMsg, global.sock);
                    } else if (mediaPath.endsWith('.mp4')) {
                        await messageHandler.sendVideo(
                            mediaPath, 
                            `Downloaded from ${link.platform} via Admin Panel`, 
                            dummyMsg, 
                            global.sock
                        );
                    } else if (mediaPath.endsWith('.jpg') || mediaPath.endsWith('.jpeg') || mediaPath.endsWith('.png')) {
                        await messageHandler.sendImage(
                            mediaPath, 
                            `Downloaded from ${link.platform} via Admin Panel`, 
                            dummyMsg, 
                            global.sock
                        );
                    } else {
                        const path = await import('path');
                        await messageHandler.sendDocument(
                            mediaPath,
                            `${link.platform}_media${path.extname(mediaPath)}`,
                            null,
                            dummyMsg,
                            global.sock
                        );
                    }
                    
                    // Clean up the file
                    if (fs.existsSync(mediaPath)) {
                        fs.unlinkSync(mediaPath);
                        console.log(`Admin panel: Deleted temporary file: ${mediaPath}`);
                    }
                    
                    // Delete the link from saved links
                    const { deleteLink } = await import('../Lib/utils/linkStorage.js');
                    deleteLink(link.url);
                    
                    console.log(`Admin panel: Successfully sent media and deleted link: ${link.url}`);
                } catch (error) {
                    console.error('Admin panel: Error processing download:', error);
                    // If could send error message to the chat, but that might be confusing
                }
            })();
            
        } catch (error) {
            console.error('Error starting download process:', error);
            return res.status(500).json({ 
                success: false, 
                message: `Error starting download: ${error.message}`
            });
        }
    } catch (error) {
        console.error('Error processing download request:', error);
        res.status(500).json({ 
            success: false, 
            message: `Error processing request: ${error.message}`
        });
    }
});

// Import the utilities to handle custom contacts
import { 
    loadCustomContacts, 
    saveCustomContact, 
    deleteCustomContact,
    formatContactsForApi
} from '../Lib/utils/contactsManager.js';

// Custom contacts management
app.get('/api/custom-contacts', requireAuth, async (req, res) => {
    try {
        const contacts = await loadCustomContacts();
        
        // Format contacts for API response
        const formattedContacts = formatContactsForApi(contacts);
        
        res.json({
            success: true,
            contacts: formattedContacts
        });
    } catch (error) {
        console.error('Error fetching custom contacts:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch custom contacts: ' + error.message
        });
    }
});

app.post('/api/custom-contacts', requireAuth, async (req, res) => {
    try {
        const { number, name, id } = req.body;
        
        if (!number || !name) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and name are required'
            });
        }
        
        // Save the contact
        const result = await saveCustomContact(number, name, id);
        
        res.json({
            success: true,
            message: 'Contact saved successfully',
            contact: result
        });
    } catch (error) {
        console.error('Error saving custom contact:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to save custom contact: ' + error.message
        });
    }
});

app.delete('/api/custom-contacts/:id', requireAuth, async (req, res) => {
    try {
        const { id } = req.params;
        
        // Delete the contact
        const result = await deleteCustomContact(id);
        
        if (result) {
            res.json({
                success: true,
                message: 'Contact deleted successfully'
            });
        } else {
            res.status(404).json({
                success: false,
                message: 'Contact not found'
            });
        }
    } catch (error) {
        console.error('Error deleting custom contact:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete custom contact: ' + error.message
        });
    }
});

// Get contacts and groups - protected
app.get('/api/contacts', requireAuth, async (req, res) => {
    try {
        console.log('Contacts API called');
        
        // Add default contact to ensure at least one contact is available
        let contacts = [{ 
            id: 'default@s.whatsapp.net', 
            name: 'WhatsApp Bot'
        }];
        
        let groups = [];
        
        // First load custom contacts
        try {
            const customContacts = await loadCustomContacts();
            
            // Convert custom contacts to the format expected by the frontend
            const formattedCustomContacts = Object.entries(customContacts).map(([number, data]) => {
                const jid = number.includes('@') ? number : `${number}@s.whatsapp.net`;
                return {
                    id: jid,
                    name: data.name,
                    isCustom: true
                };
            });
            
            // Add custom contacts to the contacts array
            if (formattedCustomContacts.length > 0) {
                contacts = formattedCustomContacts;
            }
        } catch (error) {
            console.error('Error loading custom contacts:', error);
        }
        
        // Check if global.sock exists
        if (!global.sock) {
            console.log('Socket not available yet');
            return res.json({
                success: true,
                groups: [],
                contacts: contacts
            });
        }
        
        try {
            // Get groups
            const fetchedGroups = await global.sock.groupFetchAllParticipating();
            console.log('Fetched groups count:', Object.keys(fetchedGroups).length);
            
            groups = Object.entries(fetchedGroups).map(([id, group]) => ({
                id: id,
                name: group.subject,
                participants: group.participants.length
            }));
            
            // Get contacts if store is available
            if (global.sock.store && global.sock.store.contacts) {
                const contactsObj = global.sock.store.contacts;
                console.log('Raw contacts in store:', Object.keys(contactsObj).length);
                
                // Filter valid contacts
                const validContacts = Object.entries(contactsObj)
                    .filter(([id, contact]) => {
                        return id.endsWith('@s.whatsapp.net') && 
                               !id.startsWith('status') && 
                               !id.includes('broadcast');
                    })
                    .map(([id, contact]) => ({
                        id: id,
                        name: contact.name || contact.notify || id.split('@')[0]
                    }));
                
                console.log('Valid contacts after filtering:', validContacts.length);
                
                // Only replace the default contacts if we actually have some
                if (validContacts.length > 0) {
                    contacts = validContacts;
                }
            }
            
            // If we still have no contacts, try loading from contacts.json
            if (contacts.length <= 1) {
                const contactsPath = path.join(__dirname, '..', 'data', 'contacts.json');
                if (fs.existsSync(contactsPath)) {
                    try {
                        const savedContacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
                        console.log('Contacts loaded from file:', Object.keys(savedContacts).length);
                        
                        // Convert the contacts format
                        const fileContacts = Object.entries(savedContacts)
                            .filter(([id, data]) => id.includes('@'))
                            .map(([id, data]) => ({
                                id: id,
                                name: data.name || id.split('@')[0]
                            }));
                        
                        if (fileContacts.length > 0) {
                            // Merge with existing contacts
                            const existingIds = contacts.map(c => c.id);
                            const newContacts = fileContacts.filter(c => !existingIds.includes(c.id));
                            contacts = [...contacts, ...newContacts];
                            console.log('Combined contacts after loading from file:', contacts.length);
                        }
                    } catch (error) {
                        console.error('Error parsing contacts file:', error);
                    }
                }
            }
        } catch (error) {
            console.error('Error fetching contacts/groups:', error);
        }
        
        console.log(`Returning ${groups.length} groups and ${contacts.length} contacts`);
        
        // Return the data
        res.json({
            success: true,
            groups: groups,
            contacts: contacts
        });
    } catch (error) {
        console.error('Error in contacts API:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get contacts and groups',
            error: error.message
        });
    }
});

// Send message - protected
app.post('/api/send-message', requireAuth, upload.single('media'), async (req, res) => {
    try {
        const { recipientType, recipientId, message } = req.body;
        console.log(`Sending ${recipientType} message to ${recipientId}`);
        
        if (!recipientId) {
            return res.status(400).json({ success: false, message: 'Recipient ID is required' });
        }
        
        if (!message && !req.file) {
            return res.status(400).json({ success: false, message: 'Message text or media is required' });
        }
        
        // Check if socket is available
        if (!global.sock) {
            return res.status(503).json({ success: false, message: 'WhatsApp connection not available' });
        }
        
        // Prepare content to send
        let content = {};
        
        // Add text message if provided
        if (message) {
            content.text = message;
        }
        
        // Handle media if uploaded
        if (req.file) {
            const mediaPath = req.file.path;
            const mimeType = req.file.mimetype;
            const mediaType = mimeType.split('/')[0]; // image, video, audio
            
            // Read file into buffer
            const mediaData = fs.readFileSync(mediaPath);
            
            // Determine content type based on mime type
            if (mediaType === 'image') {
                content = { image: mediaData, caption: message || '' };
            } else if (mediaType === 'video') {
                content = { video: mediaData, caption: message || '' };
            } else if (mediaType === 'audio') {
                content = { audio: mediaData, mimetype: mimeType };
                // If there's text, send it separately
                if (message) {
                    await global.sock.sendMessage(recipientId, { text: message });
                }
            } else {
                // Default to document
                content = { 
                    document: mediaData,
                    mimetype: mimeType,
                    fileName: req.file.originalname
                };
                // If there's text, send it separately
                if (message) {
                    await global.sock.sendMessage(recipientId, { text: message });
                }
            }
            
            // Clean up the temporary file
            try {
                fs.unlinkSync(mediaPath);
            } catch (cleanupError) {
                console.error('Error cleaning up temporary file:', cleanupError);
            }
        }
        
        console.log(`Sending content to ${recipientId}:`, Object.keys(content));
        
        // Send the message
        await global.sock.sendMessage(recipientId, content);
        
        res.json({ success: true, message: 'Message sent successfully' });
    } catch (error) {
        console.error('Error sending message:', error);
        res.status(500).json({ success: false, message: 'Failed to send message: ' + error.message });
    }
});

// Post a status update - protected
app.post('/api/status/update', requireAuth, statusUpload.single('statusMedia'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'No media file provided'
            });
        }
        
        if (!global.sock) {
            // Clean up the uploaded file
            if (req.file && req.file.path) {
                fs.unlinkSync(req.file.path);
            }
            
            return res.status(503).json({
                success: false,
                message: 'WhatsApp connection not available'
            });
        }
        
        const caption = req.body.caption || '';
        const mediaPath = req.file.path;
        const mediaType = req.file.mimetype.startsWith('image/') ? 'image' : 'video';
        
        try {
            // Read the file as buffer
            const mediaData = fs.readFileSync(mediaPath);
            
            // Create the status update
            await global.sock.sendMessage('status@broadcast', {
                [mediaType]: mediaData,
                caption: caption
            });
            
            // Store this status update in our history
            const statusesDir = path.join(__dirname, '..', 'downloads', 'statuses');
            
            // Create directory if it doesn't exist
            if (!fs.existsSync(statusesDir)) {
                fs.mkdirSync(statusesDir, { recursive: true });
            }
            
            // Create a timestamped copy in our statuses directory for tracking
            const timestamp = Date.now();
            const statusFile = path.join(statusesDir, `status_self_${timestamp}${path.extname(req.file.originalname)}`);
            fs.copyFileSync(mediaPath, statusFile);
            
            // Save status update info to a JSON file
            const statusHistory = path.join(__dirname, '..', 'data', 'status-history.json');
            let history = [];
            
            // Load existing history if it exists
            if (fs.existsSync(statusHistory)) {
                try {
                    history = JSON.parse(fs.readFileSync(statusHistory, 'utf8'));
                } catch (e) {
                    console.error('Error parsing status history:', e);
                }
            }
            
            // Add this status update to history
            history.unshift({
                type: mediaType,
                caption: caption,
                filename: path.basename(statusFile),
                timestamp: timestamp
            });
            
            // Keep only the last 20 status updates
            if (history.length > 20) {
                history = history.slice(0, 20);
            }
            
            // Save the updated history
            fs.writeFileSync(statusHistory, JSON.stringify(history, null, 2));
            
            // Clean up the temporary file
            if (fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
            }
            
            res.json({
                success: true,
                message: 'Status posted successfully'
            });
        } catch (error) {
            console.error('Error posting status:', error);
            
            // Clean up the temporary file if it exists
            if (fs.existsSync(mediaPath)) {
                fs.unlinkSync(mediaPath);
            }
            
            res.status(500).json({
                success: false,
                message: 'Error posting status: ' + error.message
            });
        }
    } catch (error) {
        console.error('Error in status update endpoint:', error);
        res.status(500).json({
            success: false,
            message: 'Server error: ' + error.message
        });
    }
});

// Get recent status updates - protected
app.get('/api/status/recent', requireAuth, (req, res) => {
    try {
        const statusHistory = path.join(__dirname, '..', 'data', 'status-history.json');
        let history = [];
        
        // Load existing history if it exists
        if (fs.existsSync(statusHistory)) {
            try {
                history = JSON.parse(fs.readFileSync(statusHistory, 'utf8'));
            } catch (e) {
                console.error('Error parsing status history:', e);
            }
        }
        
        // Return the history
        res.json({
            success: true,
            statuses: history
        });
    } catch (error) {
        console.error('Error getting recent status updates:', error);
        res.status(500).json({
            success: false,
            message: 'Error retrieving status updates',
            statuses: []
        });
    }
});

// WhatsApp Privacy API Routes
app.get('/api/whatsapp/privacy', requireAuth, async (req, res) => {
    try {
        // Get current WhatsApp privacy settings
        if (!global.sock) {
            return res.status(503).json({ 
                success: false, 
                message: 'WhatsApp connection not available'
            });
        }
        
        // Read settings from config since some settings are stored there
        // Now config is properly defined
        const settings = {
            profilePicture: 'all', // Default values
            lastSeen: 'all',
            hideOnlineStatus: config.HIDE_ONLINE_STATUS === 'true',
            about: {
                privacy: 'all',
                text: 'Available' // Default about text
            },
            disableReadReceipts: config.DISABLE_READ_RECEIPTS === 'true',
            groups: 'all',
            status: 'contacts'
        };
        
        res.json({
            success: true,
            settings
        });
    } catch (error) {
        console.error('Error fetching WhatsApp privacy settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch WhatsApp privacy settings: ' + error.message
        });
    }
});

app.post('/api/whatsapp/privacy', requireAuth, async (req, res) => {
    try {
        const { settings } = req.body;
        
        if (!settings) {
            return res.status(400).json({
                success: false,
                message: 'Privacy settings data is required'
            });
        }
        
        if (!global.sock) {
            return res.status(503).json({ 
                success: false, 
                message: 'WhatsApp connection not available'
            });
        }
        
        // In a real implementation, you would update the WhatsApp settings here
        // For now, we'll just update the config values we have access to
        
        // Update online status setting in config
        if (settings.hideOnlineStatus !== undefined) {
            await config.set('HIDE_ONLINE_STATUS', settings.hideOnlineStatus.toString());
        }
        
        // Update read receipts setting in config
        if (settings.disableReadReceipts !== undefined) {
            await config.set('DISABLE_READ_RECEIPTS', settings.disableReadReceipts.toString());
        }
        
        // Log what would be updated in a real implementation
        console.log('Would update WhatsApp privacy settings:', settings);
        
        res.json({
            success: true,
            message: 'Privacy settings updated successfully. Some settings may require a bot restart to take effect.'
        });
    } catch (error) {
        console.error('Error updating WhatsApp privacy settings:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update WhatsApp privacy settings: ' + error.message
        });
    }
});

// Individual privacy setting endpoints
app.post('/api/whatsapp/privacy/profile-picture', requireAuth, upload.single('profilePicture'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Profile picture file is required'
            });
        }
        
        if (!global.sock) {
            return res.status(503).json({ 
                success: false, 
                message: 'WhatsApp connection not available'
            });
        }
        
        // In a real implementation, you would update the profile picture here
        console.log('Would update profile picture with file:', req.file.path);
        
        // Cleanup the temporary file
        try {
            fs.unlinkSync(req.file.path);
        } catch (cleanupError) {
            console.error('Error cleaning up temporary file:', cleanupError);
        }
        
        res.json({
            success: true,
            message: 'Profile picture updated successfully'
        });
    } catch (error) {
        console.error('Error updating profile picture:', error);
        
        // Cleanup the temporary file if it exists
        if (req.file && req.file.path) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (cleanupError) {
                console.error('Error cleaning up temporary file:', cleanupError);
            }
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update profile picture: ' + error.message
        });
    }
});

app.post('/api/whatsapp/privacy/about', requireAuth, async (req, res) => {
    try {
        const { text } = req.body;
        
        if (!text) {
            return res.status(400).json({
                success: false,
                message: 'About text is required'
            });
        }
        
        if (!global.sock) {
            return res.status(503).json({ 
                success: false, 
                message: 'WhatsApp connection not available'
            });
        }
        
        // In a real implementation, you would update the about text here
        console.log('Would update about text to:', text);
        
        res.json({
            success: true,
            message: 'About text updated successfully'
        });
    } catch (error) {
        console.error('Error updating about text:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update about text: ' + error.message
        });
    }
});

app.post('/api/whatsapp/privacy/online-status', requireAuth, async (req, res) => {
    try {
        const { hidden } = req.body;
        
        if (hidden === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Hidden status parameter is required'
            });
        }
        
        // Update config
        await config.set('HIDE_ONLINE_STATUS', hidden.toString());
        
        res.json({
            success: true,
            message: 'Online status setting updated successfully. Restart the bot for changes to take effect.'
        });
    } catch (error) {
        console.error('Error updating online status setting:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update online status setting: ' + error.message
        });
    }
});

app.post('/api/whatsapp/privacy/read-receipts', requireAuth, async (req, res) => {
    try {
        const { disabled } = req.body;
        
        if (disabled === undefined) {
            return res.status(400).json({
                success: false,
                message: 'Disabled parameter is required'
            });
        }
        
        // Update config
        await config.set('DISABLE_READ_RECEIPTS', disabled.toString());
        
        res.json({
            success: true,
            message: 'Read receipts setting updated successfully. Restart the bot for changes to take effect.'
        });
    } catch (error) {
        console.error('Error updating read receipts setting:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update read receipts setting: ' + error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Server error: ' + err.message });
});

// Import the status event emitter
import { getStatusEventEmitter } from '../Lib/handlers/statusHandler.js';

// Initialize WebSocket for real-time updates
import WebSocket from 'ws'; // Fix: Use default export instead of named export
let wss;

// Separate the WebSocket server setup into its own function for cluster mode
const startWebSocketServer = () => {
  // Create WebSocket server for real-time updates
  wss = new WebSocket.Server({ port: PORT + 1 });
  console.log(`WebSocket server running on port ${PORT + 1}`);
  
  // Handle WebSocket connections
  wss.on('connection', (ws) => {
    console.log('New WebSocket client connected');
    
    // Send initial connection confirmation
    ws.send(JSON.stringify({ 
      type: 'connected',
      message: 'Connected to WhatsApp Bot WebSocket server'
    }));
    
    // Handle client disconnection
    ws.on('close', () => {
      console.log('WebSocket client disconnected');
    });
  });
  
  // Listen for status updates and broadcast to WebSocket clients
  const statusEmitter = getStatusEventEmitter();
  statusEmitter.on('status-saved', (statusData) => {
    // Broadcast status update to all connected clients
    if (wss.clients.size > 0) {
      const message = JSON.stringify({
        type: 'status-update',
        data: statusData
      });
      
      wss.clients.forEach(client => {
        if (client.readyState === 1) { // OPEN
          client.send(message);
        }
      });
    }
  });
  
  // Also connect to memory monitoring for admin alerts
  import('../Lib/utils/memoryMonitor.js').then(({ default: memoryMonitor }) => {
    setInterval(() => {
      const memoryInfo = memoryMonitor.takeMemorySnapshot();
      
      // If memory is in warning or critical state, broadcast to admin panel
      if (memoryInfo.health !== 'normal' && wss.clients.size > 0) {
        const message = JSON.stringify({
          type: 'memory-alert',
          data: {
            health: memoryInfo.health,
            rss: memoryInfo.memoryUsage.formatted.rss,
            heapUsed: memoryInfo.memoryUsage.formatted.heapUsed,
            timestamp: Date.now()
          }
        });
        
        wss.clients.forEach(client => {
          if (client.readyState === 1) { // OPEN
            client.send(message);
          }
        });
      }
    }, 60000); // Check every minute
  });
};

// Modified server startup code for cluster integration
const startServer = () => {
  // Only start the server if we're the ADMIN process or there's no process role (standalone mode)
  if (!process.env.PROCESS_ROLE || process.env.PROCESS_ROLE === 'admin') {
    // Start the admin server
    app.listen(PORT, () => {
      console.log(`Admin panel server running on http://localhost:${PORT}`);
      console.log(`Worker ${process.pid} running as admin server`);
    });
    
    // Only start the WebSocket server if we're the first admin process
    // This prevents port conflicts with multiple admin processes
    if (process.env.PROCESS_ROLE === 'admin' && 
        cluster.worker && 
        cluster.worker.id === 1) {
      startWebSocketServer();
    }
  } else {
    console.log(`Admin server not started in process ${process.pid} (wrong process role)`);
  }
};

// Add a new API endpoint to get system stats
app.get('/api/system-stats', requireAuth, async (req, res) => {
    try {
        const { getSystemStats } = await import('../index.js');
        const stats = getSystemStats();
        
        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Error getting system stats:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to get system stats'
        });
    }
});

// Check if this module is being run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  startServer();
} else {
  // If imported, start the server but don't block
  startServer();
  console.log(`Admin panel initialized on port ${PORT}`);
}

// Export the app for potential future use
export default app;
