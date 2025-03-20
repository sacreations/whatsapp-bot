import config from '../../Config.js';
import { logChatMessage } from '../utils/logger.js';
import fs from 'fs';
import path from 'path';
import { downloadMediaMessage } from '@whiskeysockets/baileys';

// Status directory for saving statuses if needed
const statusDir = path.join(process.cwd(), 'downloads', 'statuses');

// Create status directory if it doesn't exist
if (!fs.existsSync(statusDir)) {
    fs.mkdirSync(statusDir, { recursive: true });
}

// Data directory for storing contact information
const dataDir = path.join(process.cwd(), 'data');
if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
}

// Contacts file path
const contactsPath = path.join(dataDir, 'contacts.json');

// Load existing contacts
let contacts = {};
if (fs.existsSync(contactsPath)) {
    try {
        contacts = JSON.parse(fs.readFileSync(contactsPath, 'utf8'));
    } catch (error) {
        console.error('Error reading contacts file:', error);
    }
}

/**
 * Save contact information to contacts.json
 * @param {string} jid - WhatsApp JID
 * @param {string} name - Contact name
 */
function saveContactInfo(jid, name) {
    if (!jid || !name) return;
    
    try {
        // Clean up the name (remove extra whitespace and newlines)
        const cleanName = name.replace(/\s+/g, ' ').trim();
        if (!cleanName) return; // Skip if name is empty after cleaning
        
        console.log(`Saving contact: ${cleanName} (${jid})`);
        
        // Update the contacts object with the full JID
        contacts[jid] = {
            name: cleanName,
            updatedAt: new Date().toISOString()
        };
        
        // Also save a simplified version with just the number part
        // This helps with matching when only the number is available
        const simplifiedJid = jid.split('@')[0];
        if (simplifiedJid && simplifiedJid !== jid) {
            contacts[simplifiedJid] = {
                name: cleanName,
                updatedAt: new Date().toISOString()
            };
        }
        
        // Write to file
        fs.writeFileSync(contactsPath, JSON.stringify(contacts, null, 2));
        console.log(`Contact saved: ${cleanName} (${jid})`);
    } catch (error) {
        console.error('Error saving contact info:', error);
    }
}

/**
 * Handle incoming status updates
 * @param {Object} status - Status update object
 * @param {Object} sock - Socket connection
 */
export async function handleStatus(status, sock) {
    try {
        // Skip if auto status view is disabled - dynamically check config
        if (!config.ENABLE_AUTO_STATUS_VIEW) return;

        // Extract status details
        const sender = status.key.remoteJid;
        const statusType = getStatusType(status);
        
        // Try to get contact name
        let contactName = null;
        try {
            // Different ways to get contact name based on what's available
            if (sock.contacts && sock.contacts[sender]) {
                contactName = sock.contacts[sender].name || sock.contacts[sender].notify;
            } else if (status.pushName) {
                contactName = status.pushName;
            } else if (sock.store && sock.store.contacts && sock.store.contacts[sender]) {
                contactName = sock.store.contacts[sender].name || sock.store.contacts[sender].notify;
            }
            
            // If we found a name, save it
            if (contactName) {
                saveContactInfo(sender, contactName);
                console.log(`Found contact name for ${sender}: ${contactName}`);
            }
        } catch (error) {
            console.error('Error getting contact name:', error);
        }
        
        // Log status update
        console.log(`New status from ${contactName || sender}: ${statusType}`);
        
        // Save status update to logs
        await logStatusUpdate(status, sock);

        // Mark the status as read
        await viewStatus(status, sock);
        
        // Optionally download and save status media
        if (statusType !== 'text' && statusType !== 'unknown') {
            await saveStatusMedia(status, statusType, contactName);
        }
    } catch (error) {
        console.error('Error handling status update:', error);
    }
}

/**
 * View status update (mark as seen)
 */
async function viewStatus(status, sock) {
    try {
        await sock.readMessages([status.key]);
        console.log(`Viewed status from ${status.key.remoteJid}`);
        return true;
    } catch (error) {
        console.error('Error viewing status:', error);
        return false;
    }
}

/**
 * Get status update type
 */
function getStatusType(status) {
    if (status.message?.imageMessage) return 'image';
    if (status.message?.videoMessage) return 'video';
    if (status.message?.conversation || status.message?.extendedTextMessage?.text) return 'text';
    return 'unknown';
}

/**
 * Log status update to chat logs
 */
async function logStatusUpdate(status, sock) {
    try {
        // Add a custom flag to indicate this is a status update
        status._isStatusUpdate = true;
        
        // Use existing logger
        await logChatMessage(status, sock);
    } catch (error) {
        console.error('Error logging status update:', error);
    }
}

/**
 * Save status media to downloads/statuses folder
 */
async function saveStatusMedia(status, statusType, contactName) {
    try {
        // Skip if not media
        if (statusType === 'text' || statusType === 'unknown') return null;
        
        // Download status media
        const buffer = await downloadMediaMessage(
            status,
            'buffer',
            {},
        );
        
        // Get the raw JID and extract the sender ID correctly
        const rawJid = status.key.remoteJid;
        const sender = rawJid.split('@')[0];
        const timestamp = new Date().getTime();
        const extension = statusType === 'image' ? 'jpg' : 'mp4';
        
        // Format: status_contactId_timestamp.extension
        const filename = `status_${sender}_${timestamp}.${extension}`;
        const filepath = path.join(statusDir, filename);
        
        // Save file
        fs.writeFileSync(filepath, buffer);
        
        // Log with more details for debugging
        const displayName = contactName || 'Unknown';
        console.log(`Saved status media: ${filepath} from ${displayName} (JID: ${rawJid})`);
        
        return {
            filepath,
            sender,
            contactName: displayName,
            timestamp,
            type: statusType
        };
    } catch (error) {
        console.error('Error saving status media:', error);
        return null;
    }
}
