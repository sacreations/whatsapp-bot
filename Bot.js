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
// Corrected import for makeWASocket
import Baileys, {
    useMultiFileAuthState,
    DisconnectReason,
    Browsers
} from '@whiskeysockets/baileys';
import qrcode from 'qrcode-terminal';

const makeWASocket = Baileys.default;

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

// Add connection retry state tracking
let reconnectAttempts = 0;
const MAX_RECONNECT_ATTEMPTS = 10;
const BASE_RECONNECT_DELAY = 2000; // 2 seconds

/**
 * Calculate exponential backoff delay with jitter
 */
function getReconnectDelay(attempt) {
    const delay = Math.min(BASE_RECONNECT_DELAY * Math.pow(2, attempt), 60000); // Max 60 seconds
    const jitter = Math.random() * 1000; // Add up to 1 second jitter
    return delay + jitter;
}

/**
 * Check network connectivity before attempting reconnection
 */
async function checkNetworkConnectivity() {
    try {
        const { default: axios } = await import('axios');
        await axios.get('https://www.google.com', { timeout: 5000 });
        return true;
    } catch (error) {
        console.log('Network connectivity check failed:', error.message);
        return false;
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
    // The makeWASocket function is the default export
    const sock = makeWASocket({
        auth: state,
        logger,
        browser: Browsers.ubuntu(config.BOT_NAME),
        printQRInTerminal: true,
        downloadHistory: true,
        syncFullHistory: true,
        markOnlineOnConnect: !config.HIDE_ONLINE_STATUS, // Respect hide online status setting
        getMessage: async (key) => {
            // This helps with message retries and poll vote decryption
            try {
                // You could implement a message store here if needed
                return null;
            } catch (error) {
                return null;
            }
        }
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
            // Reset reconnect attempts on new QR
            reconnectAttempts = 0;
        }
        
        if (connection === 'close') {
            const error = lastDisconnect.error;
            const shouldReconnect = !(error instanceof Boom && error.output?.statusCode === DisconnectReason.loggedOut);
            
            console.log('Connection closed due to:', error?.message || error, ', reconnecting:', shouldReconnect);
            
            // Handle specific error codes
            if (error instanceof Boom) {
                const statusCode = error.output?.statusCode;
                const errorData = error.data;
                
                console.log(`Error details - Status: ${statusCode}, Data:`, errorData);
                
                // Handle different error scenarios
                switch (statusCode) {
                    case 401:
                        console.log('🔑 Session expired or invalid. Clearing session...');
                        await clearSessionAndReconnect();
                        return;
                        
                    case 405:
                        // Method Not Allowed - connection issues
                        if (errorData?.reason === 'frc' || errorData?.reason === 'cco') {
                            console.log('🚫 WhatsApp server rejected connection. Implementing backoff...');
                            reconnectAttempts++;
                            
                            if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                                console.log('❌ Maximum reconnection attempts reached. Clearing session...');
                                await clearSessionAndReconnect();
                                return;
                            }
                            
                            // Check network connectivity before retrying
                            const hasNetwork = await checkNetworkConnectivity();
                            if (!hasNetwork) {
                                console.log('🌐 No network connectivity. Waiting longer before retry...');
                                setTimeout(async () => {
                                    if (await checkNetworkConnectivity()) {
                                        connectToWhatsApp();
                                    } else {
                                        console.log('🌐 Still no network. Will retry again...');
                                        setTimeout(connectToWhatsApp, 30000); // Wait 30 seconds
                                    }
                                }, 10000); // Wait 10 seconds first
                                return;
                            }
                            
                            const delay = getReconnectDelay(reconnectAttempts - 1);
                            console.log(`⏳ Attempting reconnection ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS} in ${Math.round(delay/1000)}s...`);
                            
                            setTimeout(() => {
                                connectToWhatsApp();
                            }, delay);
                            return;
                        }
                        break;
                        
                    case 409:
                        // Conflict - another device might be connected
                        console.log('⚠️ Conflict detected. Another device might be using this session.');
                        break;
                        
                    case 428:
                        // Precondition Required - need to scan QR again
                        console.log('📱 Need to scan QR code again.');
                        await clearSessionAndReconnect();
                        return;
                }
            }
            
            // Reconnect if not logged out
            if (shouldReconnect) {
                reconnectAttempts++;
                
                if (reconnectAttempts >= MAX_RECONNECT_ATTEMPTS) {
                    console.log('❌ Too many reconnection attempts. Clearing session...');
                    await clearSessionAndReconnect();
                    return;
                }
                
                const delay = getReconnectDelay(reconnectAttempts - 1);
                console.log(`🔄 Reconnecting in ${Math.round(delay/1000)}s (attempt ${reconnectAttempts}/${MAX_RECONNECT_ATTEMPTS})...`);
                
                setTimeout(() => {
                    connectToWhatsApp();
                }, delay);
            }
        } else if (connection === 'open') {
            console.log('✅ Connection opened successfully');
            // Reset reconnect attempts on successful connection
            reconnectAttempts = 0;
            
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

/**
 * Clear session and reconnect with fresh state
 */
async function clearSessionAndReconnect() {
    try {
        console.log('🧹 Clearing session data...');
        
        const sessionPath = path.join(sessionDir, config.SESSION_ID);
        if (fs.existsSync(sessionPath)) {
            fs.rmSync(sessionPath, { recursive: true, force: true });
            console.log('✅ Session cleared successfully');
        }
        
        // Reset reconnect attempts
        reconnectAttempts = 0;
        
        // Wait before reconnecting with fresh session
        setTimeout(() => {
            console.log('🔄 Starting fresh connection...');
            connectToWhatsApp();
        }, 3000);
    } catch (error) {
        console.error('❌ Error clearing session:', error);
        // Still try to reconnect even if clearing fails
        setTimeout(connectToWhatsApp, 5000);
    }
}

export { connectToWhatsApp };