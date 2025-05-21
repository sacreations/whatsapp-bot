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
import * as baileysAll from '@whiskeysockets/baileys';

console.log('BaileysAll:', baileysAll);
console.log('Baileys keys:', Object.keys(baileysAll));
console.log('typeof makeWASocket:', typeof baileysAll.makeWASocket);

process.exit(1); // Stop execution after logging

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

const { makeWASocket, useMultiFileAuthState, DisconnectReason } = baileysAll;

console.log('Baileys keys:', Object.keys(baileysAll));
console.log('typeof makeWASocket:', typeof makeWASocket);

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
        printQRInTerminal: true,
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
        const { connection, lastDisconnect } = update;
        
        if (connection === 'close') {
            const shouldReconnect = 
                (lastDisconnect.error instanceof Boom)?.output?.statusCode !== DisconnectReason.loggedOut;
            
            console.log('Connection closed due to ', lastDisconnect.error, ', reconnecting ', shouldReconnect);
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                connectToWhatsApp();
            }
        } else if (connection === 'open') {
            console.log('Connection opened');
            // Load plugins after connection is established
            await loadPlugins();
            
            // Start cleanup interval
            setInterval(cleanupDownloads, 3600 * 1000); // Cleanup every hour
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
