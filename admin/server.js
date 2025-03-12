import express from 'express';
import session from 'express-session';
import fs from 'fs-extra';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import dotenv from 'dotenv';

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

// Authentication middleware
const requireAuth = (req, res, next) => {
  if (req.session.authenticated) {
    next();
  } else {
    res.redirect('/login.html');
  }
};

// Route to serve the admin panel (protected)
app.get('/', requireAuth, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
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

// Logout route
app.post('/api/logout', (req, res) => {
  req.session.authenticated = false;
  res.json({ success: true });
});

// Get config route
app.get('/api/config', requireAuth, (req, res) => {
  try {
    const configPath = path.join(__dirname, '..', 'config.env');
    const configContent = fs.readFileSync(configPath, 'utf8');
    
    // Parse config.env into a JS object
    const config = {};
    configContent.split('\n').forEach(line => {
      if (line && !line.startsWith('#') && !line.startsWith('//') && line.includes('=')) {
        const [key, value] = line.split('=').map(part => part.trim());
        config[key] = value;
      }
    });
    
    // Don't expose password
    delete config.ADMIN_PASSWORD;
    
    res.json({ success: true, config });
  } catch (error) {
    console.error('Error reading config:', error);
    res.status(500).json({ success: false, message: 'Failed to read configuration' });
  }
});

// Update config route
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

// Start server
app.listen(PORT, () => {
  console.log(`Admin panel server running on http://localhost:${PORT}`);
});
