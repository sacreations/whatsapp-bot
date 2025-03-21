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

const app = express();
const PORT = process.env.ADMIN_PORT || 3000;
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(session({
  secret: 'whatsapp-bot-admin-secret',
  resave: false,
  saveUninitialized: true,
  cookie: { secure: false, maxAge: 3600000 } // 1 hour
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
    
    // Prevent password update through this API
    if (config.ADMIN_PASSWORD) {
      delete config.ADMIN_PASSWORD;
    }
    
    // Convert config object to string format
    let configContent = '';
    Object.entries(config).forEach(([key, value]) => {
      configContent += `${key}=${value}\n`;
    });
    
    // Check if ADMIN_PASSWORD already exists in the file, if so preserve it
    const existingContent = fs.readFileSync(configPath, 'utf8');
    const passwordLine = existingContent.split('\n').find(line => 
      line.trim().startsWith('ADMIN_PASSWORD=')
    );
    
    if (passwordLine) {
      configContent += `${passwordLine}\n`;
    }
    
    fs.writeFileSync(configPath, configContent);
    
    res.json({ success: true, message: 'Configuration updated successfully' });
  } catch (error) {
    console.error('Error updating config:', error);
    res.status(500).json({ success: false, message: 'Failed to update configuration' });
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
        
        // Get status data with metadata
        const statuses = files.map(file => {
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
            
            const isVideo = file.endsWith('.mp4');
            
            return {
                id: file,
                path: filePath,
                contactId: contactId,
                contactName: contactName || 'Unknown', // Always provide a name, default to 'Unknown'
                timestamp: timestamp || stats.mtimeMs,
                date: new Date(timestamp || stats.mtimeMs).toLocaleString(),
                type: isVideo ? 'video' : 'image',
                size: stats.size,
                url: `/api/statuses/${encodeURIComponent(file)}`
            };
        });
        
        // Sort statuses by date (newest first)
        statuses.sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ success: true, statuses });
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
        
        res.json({
            success: true,
            stats: {
                groupsCount,
                pluginsCount, 
                downloadsCount,
                uptime
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

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Server error:', err);
  res.status(500).json({ success: false, message: 'Server error: ' + err.message });
});

// Start server only if this file is run directly (not imported)
const startServer = () => {
  app.listen(PORT, () => {
    console.log(`Admin panel server running on http://localhost:${PORT}`);
  });
};

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
