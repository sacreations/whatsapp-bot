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
        
        // Log status update
        console.log(`New status from ${sender}: ${statusType}`);
        
        // Save status update to logs
        await logStatusUpdate(status, sock);

        // Mark the status as read
        await viewStatus(status, sock);
        
        // Optionally download and save status media
        if (statusType !== 'text' && statusType !== 'unknown') {
            await saveStatusMedia(status, statusType);
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
async function saveStatusMedia(status, statusType) {
    try {
        // Skip if not media
        if (statusType === 'text' || statusType === 'unknown') return null;
        
        // Download status media
        const buffer = await downloadMediaMessage(
            status,
            'buffer',
            {},
        );
        
        // Generate filename with proper metadata
        const sender = status.key.remoteJid.split('@')[0];
        const timestamp = new Date().getTime();
        const extension = statusType === 'image' ? 'jpg' : 'mp4';
        
        // Format: status_contactId_timestamp.extension
        const filename = `status_${sender}_${timestamp}.${extension}`;
        const filepath = path.join(statusDir, filename);
        
        // Save file
        fs.writeFileSync(filepath, buffer);
        
        // Try to get contact info (can be enhanced later)
        let contactName = sender;
        try {
            // This will need to be adapted based on how you store contacts
            // This is just a placeholder
            if (global.store && global.store.contacts && global.store.contacts[status.key.remoteJid]) {
                contactName = global.store.contacts[status.key.remoteJid].name || sender;
            }
        } catch (error) {
            console.log('Could not get contact name:', error.message);
        }
        
        console.log(`Saved status media: ${filepath} from ${contactName}`);
        return {
            filepath,
            sender,
            contactName,
            timestamp,
            type: statusType
        };
    } catch (error) {
        console.error('Error saving status media:', error);
        return null;
    }
}
