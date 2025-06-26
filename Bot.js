import pino from 'pino';
import { Boom } from '@hapi/boom';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { handleMessage } from './Lib/chat/commandHandler.js';
import { handleAutoReply } from './Lib/chat/autoReply.js';
import { handleStatus } from './Lib/handlers/statusHandler.js';
import config from './Config.js';
import { cleanupDownloads } from './Lib/Functions/Download_Functions/downloader.js';
import { logChatMessage } from './Lib/utils/logger.js';
import { makeWASocket, useMultiFileAuthState, DisconnectReason, downloadMediaMessage } from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Create session directory if it doesn't exist
const sessionDir = path.join(__dirname, 'sessions');
if (!fs.existsSync(sessionDir)) {
    fs.mkdirSync(sessionDir, { recursive: true });
}

// Initialize logger
const logger = pino({
    level: 'warn',
    transport: {
        target: 'pino-pretty',
        options: {
            colorize: true
        }
    }
});

/**
 * Load plugins from the plugins directory
 */
async function loadPlugins() {
    try {
        const pluginsDir = path.join(__dirname, 'plugins');
        if (!fs.existsSync(pluginsDir)) {
            fs.mkdirSync(pluginsDir, { recursive: true });
            console.log('Created plugins directory');
            return;
        }
        
        const pluginFiles = fs.readdirSync(pluginsDir).filter(file => file.endsWith('.js'));
        console.log(`Found ${pluginFiles.length} plugins`);
        
        for (const file of pluginFiles) {
            try {
                const filePath = `file://${path.join(pluginsDir, file)}`;
                await import(filePath);
                console.log(`Loaded plugin: ${file}`);
            } catch (error) {
                console.error(`Failed to load plugin ${file}:`, error);
            }
        }
    } catch (error) {
        console.error('Error loading plugins:', error);
    }
}

/**
 * Connect to WhatsApp
 */
async function connectToWhatsApp() {
    const { state, saveCreds } = await useMultiFileAuthState(
        path.join(sessionDir, config.SESSION_ID)
    );
    
    // Create a new instance of the WhatsApp socket
    const sock = makeWASocket({
        auth: state,
        logger,
        browser: ['WhatsAppBot', 'Chrome', '103.0.5060.114'],
        downloadHistory: true,
        syncFullHistory: true,
        markOnlineOnConnect: true, // Set to always show online
        readReceipts: !config.DISABLE_READ_RECEIPTS // Disable read receipts if configured
    });
    
    // Make socket available globally
    global.sock = sock;
    
    // Save session credentials on updates
    sock.ev.on('creds.update', saveCreds);
    
    // Handle connection events
    sock.ev.on('connection.update', async (update) => {
        const { connection, lastDisconnect, qr } = update;
        
        // Handle QR code display
        if (qr) {
            console.log('QR Code received, scan to connect:');
            qrcode.generate(qr, { small: true });
        }
        
        if (connection === 'close') {
            const shouldReconnect = 
                (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            // Check if it's a 401 error (session expired/invalid)
            if (lastDisconnect.error instanceof Boom && lastDisconnect.error.output?.statusCode === 401) {
                console.log('Session expired or invalid. Clearing session and requiring new QR scan...');
                
                // Clear the session directory
                const sessionPath = path.join(sessionDir, config.SESSION_ID);
                if (fs.existsSync(sessionPath)) {
                    try {
                        fs.rmSync(sessionPath, { recursive: true, force: true });
                        console.log('Session cleared successfully');
                    } catch (error) {
                        console.error('Error clearing session:', error);
                    }
                }
                
                // Wait a bit before reconnecting to avoid immediate retry
                setTimeout(() => {
                    console.log('Reconnecting with fresh session...');
                    connectToWhatsApp();
                }, 3000);
                return;
            }
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                // Add exponential backoff for reconnection
                setTimeout(() => {
                    connectToWhatsApp();
                }, 5000);
            }
        } else if (connection === 'open') {
            console.log('✅ Connection opened successfully');
            // Load plugins after connection is established
            await loadPlugins();
            
            // Start cleanup interval
            setInterval(cleanupDownloads, 3600 * 1000); // Cleanup every hour
        } else if (connection === 'connecting') {
            console.log('🔄 Connecting to WhatsApp...');
        }
    });
    
    // Handle messages
    sock.ev.on('messages.upsert', async ({ messages }) => {
        for (const m of messages) {
            // Skip status messages if they should be handled by status handler
            if (m.key.remoteJid === 'status@broadcast') {
                // Handle as a status update
                await handleStatus(m, sock);
                continue;
            }
            
            try {
                // Log the message
                await logChatMessage(m, sock);
                
                // Process commands first
                const isCommand = await handleMessage(m, sock);
                
                // If not a command and auto-reply is enabled, try auto-reply
                if (!isCommand) {
                    await handleAutoReply(m, sock);
                }
            } catch (error) {
                console.error('Error processing message:', error);
            }
        }
    });
    
    // Add more event handlers as needed
    sock.ev.on('group-participants.update', async (update) => {
        const { id, participants, action } = update;
        console.log(`Group ${id} participants ${action}: ${participants}`);
        // Handle group participant updates if needed
    });
    
    return sock;
}

export { connectToWhatsApp };
