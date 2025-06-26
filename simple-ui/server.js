import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
// import config from '../Config.js';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const app = express();
const PORT = process.env.SIMPLE_UI_PORT || 3001;

// Middleware
app.use(express.static(__dirname));
app.use(express.json());

// CORS for development
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
    
    if (req.method === 'OPTIONS') {
        res.sendStatus(200);
    } else {
        next();
    }
});

// Authentication endpoint
app.post('/api/auth/login', (req, res) => {
    try {
        const { password } = req.body;
        
        if (!password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Password is required' 
            });
        }
        
        // Get admin password from config
        const configPath = path.join(__dirname, '..', 'config.env');
        
        if (!fs.existsSync(configPath)) {
            return res.status(500).json({ 
                success: false, 
                message: 'Configuration file not found' 
            });
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        let adminPassword = 'admin123'; // default password
        
        // Parse config to find admin password
        configContent.split('\n').forEach(line => {
            line = line.trim();
            if (line.startsWith('ADMIN_PASSWORD=')) {
                adminPassword = line.split('=')[1] || 'admin123';
            }
        });
        
        if (password === adminPassword) {
            console.log('Successful login attempt');
            res.json({ 
                success: true, 
                message: 'Login successful' 
            });
        } else {
            console.log('Failed login attempt with password:', password);
            res.status(401).json({ 
                success: false, 
                message: 'Invalid password' 
            });
        }
    } catch (error) {
        console.error('Authentication error:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Authentication error: ' + error.message 
        });
    }
});

// Middleware to check authentication for protected routes
function requireAuth(req, res, next) {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ 
            success: false, 
            message: 'Authentication required' 
        });
    }
    
    // For simplicity, we'll skip token validation for now
    // In a production environment, you should validate JWT tokens
    next();
}

// Serve the main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Get configuration
app.get('/api/config', (req, res) => {
    try {
        const configPath = path.join(__dirname, '..', 'config.env');
        
        if (!fs.existsSync(configPath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Configuration file not found' 
            });
        }
        
        const configContent = fs.readFileSync(configPath, 'utf8');
        const configData = {};
        
        // Parse config.env into a JS object
        configContent.split('\n').forEach(line => {
            if (line && !line.startsWith('#') && !line.startsWith('//') && line.includes('=')) {
                const firstEqualsIndex = line.indexOf('=');
                if (firstEqualsIndex > 0) {
                    const key = line.substring(0, firstEqualsIndex).trim();
                    const value = line.substring(firstEqualsIndex + 1).trim();
                    configData[key] = value;
                }
            }
        });
        
        // Set defaults for missing values
        const defaults = {
            PREFIX: '.',
            BOT_NAME: 'WhatsApp Bot',
            OWNER_NUMBER: '',
            ENABLE_AUTO_REPLY: 'false',
            ENABLE_SOCIAL_MEDIA_DOWNLOAD: 'true',
            ENABLE_AUTO_STATUS_VIEW: 'true',
            HIDE_ONLINE_STATUS: 'false',
            DISABLE_READ_RECEIPTS: 'false',
            BOT_PAUSED: 'false'
        };
        
        Object.keys(defaults).forEach(key => {
            if (configData[key] === undefined) {
                configData[key] = defaults[key];
            }
        });
        
        res.json({ success: true, config: configData });
    } catch (error) {
        console.error('Error reading config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to read configuration: ' + error.message 
        });
    }
});

// Update configuration
app.post('/api/config', (req, res) => {
    try {
        const { config: newConfig } = req.body;
        const configPath = path.join(__dirname, '..', 'config.env');
        
        if (!newConfig) {
            return res.status(400).json({ 
                success: false, 
                message: 'Configuration data is required' 
            });
        }
        
        // Read current config
        let configContent = '';
        if (fs.existsSync(configPath)) {
            configContent = fs.readFileSync(configPath, 'utf8');
        }
        
        let configLines = configContent.split('\n');
        let updatedKeys = [];
        
        // Update existing keys
        for (const [key, value] of Object.entries(newConfig)) {
            const keyRegex = new RegExp(`^${key}=.*`, 'gm');
            if (configContent.match(keyRegex)) {
                configContent = configContent.replace(keyRegex, `${key}=${value}`);
                updatedKeys.push(key);
            }
        }
        
        // Add new keys
        for (const [key, value] of Object.entries(newConfig)) {
            if (!updatedKeys.includes(key)) {
                const commentedKeyLine = configLines.findIndex(line => 
                    line.trim().startsWith(`# ${key}=`) || line.trim().startsWith(`// ${key}=`)
                );
                
                if (commentedKeyLine >= 0) {
                    configLines[commentedKeyLine] = `${key}=${value}`;
                    configContent = configLines.join('\n');
                } else {
                    configContent += `\n${key}=${value}`;
                }
            }
        }
        
        // Write back to config file
        fs.writeFileSync(configPath, configContent);
        
        console.log('Configuration updated successfully');
        res.json({ success: true, message: 'Configuration updated successfully' });
    } catch (error) {
        console.error('Error updating config:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to update configuration: ' + error.message 
        });
    }
});

// Get saved statuses
app.get('/api/statuses', (req, res) => {
    try {
        const statusDir = path.join(__dirname, '..', 'downloads', 'statuses');
        const timeframe = req.query.timeframe || '24h';
        
        if (!fs.existsSync(statusDir)) {
            fs.mkdirSync(statusDir, { recursive: true });
        }
        
        const files = fs.readdirSync(statusDir);
        
        // Read contact information
        const contactsPath = path.join(__dirname, '..', 'data', 'contacts.json');
        let contacts = {};
        if (fs.existsSync(contactsPath)) {
            try {
                contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
            } catch (error) {
                console.error('Error reading contacts file:', error);
            }
        }
        
        // Calculate cutoff time
        const cutoffTime = getCutoffTime(timeframe);
        
        const statuses = files
            .filter(file => {
                const filePath = path.join(statusDir, file);
                const stats = fs.statSync(filePath);
                return stats.mtime.getTime() > cutoffTime;
            })
            .map(file => {
                const filePath = path.join(statusDir, file);
                const stats = fs.statSync(filePath);
                
                // Extract contact info from filename (status_contactId_timestamp.ext)
                const match = file.match(/status_([^_]+)_(\d+)\./);
                let contactName = 'Unknown';
                let contactId = '';
                
                if (match) {
                    contactId = match[1];
                    contactName = contacts[contactId] || contacts[`${contactId}@s.whatsapp.net`] || contactId;
                }
                
                const extension = path.extname(file).toLowerCase();
                const isVideo = ['.mp4', '.avi', '.mov', '.mkv'].includes(extension);
                const type = isVideo ? 'video' : 'image';
                
                return {
                    id: file,
                    filename: file,
                    contactName: contactName,
                    contactId: contactId,
                    timestamp: stats.mtime.getTime(),
                    type: type,
                    size: stats.size
                };
            })
            .sort((a, b) => b.timestamp - a.timestamp);
        
        res.json({ success: true, statuses: statuses });
    } catch (error) {
        console.error('Error fetching statuses:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch statuses: ' + error.message,
            statuses: []
        });
    }
});

// Serve status files
app.get('/api/statuses/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', 'downloads', 'statuses', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Status file not found' 
            });
        }
        
        // Determine content type
        const extension = path.extname(filename).toLowerCase();
        let contentType = 'application/octet-stream';
        
        if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(extension)) {
            contentType = `image/${extension.slice(1)}`;
            if (extension === '.jpg') contentType = 'image/jpeg';
        } else if (['.mp4', '.avi', '.mov', '.mkv'].includes(extension)) {
            contentType = 'video/mp4';
        }
        
        res.setHeader('Content-Type', contentType);
        res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
        
        const fileStream = fs.createReadStream(filePath);
        fileStream.pipe(res);
    } catch (error) {
        console.error('Error serving status file:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to serve status file' 
        });
    }
});

// Delete status
app.delete('/api/statuses/:filename', (req, res) => {
    try {
        const filename = req.params.filename;
        const filePath = path.join(__dirname, '..', 'downloads', 'statuses', filename);
        
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({ 
                success: false, 
                message: 'Status file not found' 
            });
        }
        
        fs.unlinkSync(filePath);
        console.log(`Deleted status file: ${filename}`);
        
        res.json({ 
            success: true, 
            message: 'Status deleted successfully' 
        });
    } catch (error) {
        console.error('Error deleting status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete status' 
        });
    }
});

// Utility function to get cutoff time based on timeframe
function getCutoffTime(timeframe) {
    const now = Date.now();
    
    switch (timeframe) {
        case '24h':
            return now - (24 * 60 * 60 * 1000);
        case '48h':
            return now - (48 * 60 * 60 * 1000);
        case '7d':
            return now - (7 * 24 * 60 * 60 * 1000);
        case '30d':
            return now - (30 * 24 * 60 * 60 * 1000);
        case 'all':
        default:
            return 0;
    }
}

// Error handling middleware
app.use((err, req, res, next) => {
    console.error('Server error:', err);
    res.status(500).json({ 
        success: false, 
        message: 'Server error: ' + err.message 
    });
});

// Start server
const startSimpleServer = () => {
    app.listen(PORT, () => {
        console.log(`✅ Simple UI server running on http://localhost:${PORT}`);
        console.log(`📱 Access your bot settings at: http://localhost:${PORT}`);
    });
};

// Export for use in other modules
export { app, startSimpleServer };

// Start server if this file is run directly
if (import.meta.url === `file://${process.argv[1]}` || process.argv[1].endsWith('simple-ui/server.js')) {
    startSimpleServer();
}
