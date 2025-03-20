import express from 'express';
import session from 'express-session';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';
import { getChatLogs } from '../Lib/utils/logger.js';
import { loadSavedLinks, deleteLink, clearGroupLinks } from '../Lib/utils/linkStorage.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load .env file
dotenv.config({ path: path.join(__dirname, '..', 'config.env') });

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
                // Try multiple possible JID formats
                const possibleJids = [
                    `${contactId}@s.whatsapp.net`,
                    `${contactId}@c.us`,
                    `${contactId}@broadcast`
                ];
                
                for (const jid of possibleJids) {
                    if (contacts[jid]) {
                        contactName = contacts[jid].name || null;
                        console.log(`Found contact name: ${contactName} for ${jid}`);
                        break;
                    }
                }
            }
            
            const isVideo = file.endsWith('.mp4');
            
            return {
                id: file,
                path: filePath,
                contactId: contactId,
                contactName: contactName,
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
