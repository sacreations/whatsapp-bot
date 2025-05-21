import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import baileys from '@whiskeysockets/baileys';

const { downloadMediaMessage } = baileys;

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Maximum log entries to keep
const MAX_ENTRIES = 500;

// Create logs directory if it doesn't exist
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
}

// Chat logs file path
const chatLogsPath = path.join(logsDir, 'chat-logs.json');

// Initialize logs file if it doesn't exist
if (!fs.existsSync(chatLogsPath)) {
    fs.writeFileSync(chatLogsPath, JSON.stringify([]));
}

/**
 * Get message type description
 */
function getMessageTypeDescription(m) {
    if (m.message?.conversation) return 'text';
    if (m.message?.extendedTextMessage) return 'text';
    if (m.message?.imageMessage) return 'image';
    if (m.message?.videoMessage) return 'video';
    if (m.message?.audioMessage) return 'audio';
    if (m.message?.documentMessage) return 'document';
    if (m.message?.stickerMessage) return 'sticker';
    return 'other';
}

/**
 * Get message content
 */
function getMessageContent(m) {
    if (m.message?.conversation) {
        return m.message.conversation;
    } else if (m.message?.extendedTextMessage?.text) {
        return m.message.extendedTextMessage.text;
    } else if (m.message?.imageMessage?.caption) {
        return `[Image with caption]: ${m.message.imageMessage.caption}`;
    } else if (m.message?.videoMessage?.caption) {
        return `[Video with caption]: ${m.message.videoMessage.caption}`;
    } else if (m.message?.imageMessage) {
        return '[Image]';
    } else if (m.message?.videoMessage) {
        return '[Video]';
    } else if (m.message?.audioMessage) {
        return '[Audio]';
    } else if (m.message?.documentMessage) {
        return `[Document: ${m.message.documentMessage.fileName || 'file'}]`;
    } else if (m.message?.stickerMessage) {
        return '[Sticker]';
    }
    return '[Unknown message type]';
}

/**
 * Download and encode media as base64
 */
async function getMediaAsBase64(m) {
    try {
        if (!m.message) return null;
        
        const messageType = getMessageTypeDescription(m);
        
        // Only process media types, not text
        if (!['image', 'video', 'sticker'].includes(messageType)) {
            return null;
        }
        
        // Limit to images for now to avoid making logs too large
        // Can be expanded to other media types later
        if (messageType === 'image' || messageType === 'sticker') {
            const buffer = await downloadMediaMessage(
                m,
                'buffer',
                {},
            );
            
            // Convert buffer to base64
            const base64Data = buffer.toString('base64');
            
            // Determine mime type for properly displaying media
            let mimeType = 'image/jpeg'; // Default
            if (messageType === 'sticker') {
                mimeType = 'image/webp';
            } else if (m.message.imageMessage?.mimetype) {
                mimeType = m.message.imageMessage.mimetype;
            }
            
            return {
                data: base64Data,
                mimeType: mimeType,
                type: messageType
            };
        }
        
        // For videos, just return null for now to avoid making logs too large
        // Could implement thumbnail extraction in the future
        
        return null;
    } catch (error) {
        console.error('Error downloading media:', error);
        return null;
    }
}

/**
 * Log a chat message
 */
export async function logChatMessage(m, sock) {
    try {
        // Extract data from the message
        const sender = m.key.remoteJid;
        const fromMe = m.key.fromMe;
        const messageType = getMessageTypeDescription(m);
        const content = getMessageContent(m);
        const timestamp = new Date().toISOString();
        
        // Download and encode media if present
        const media = await getMediaAsBase64(m);
        
        // Try to get contact name if available
        let senderName = null;
        try {
            if (sender && !fromMe) {
                // Using pushName from the message instead of trying to fetch contact info
                senderName = m.pushName || null;
                
                // For group messages, try to get the name using appropriate methods
                if (sender.endsWith('@g.us') && m.key.participant) {
                    // In groups, the actual sender is in participant
                    const participantName = sock.contacts?.[m.key.participant]?.name || 
                                           sock.contacts?.[m.key.participant]?.notify ||
                                           m.key.participant.split('@')[0];
                    senderName = participantName;
                }
            }
        } catch (error) {
            console.error('Error getting sender name:', error);
        }
        
        // Create log entry
        const logEntry = {
            timestamp,
            sender,
            senderName,
            fromMe,
            messageType,
            content,
            isGroup: sender.endsWith('@g.us'),
            media: media // Add media data if available
        };
        
        // Read existing logs
        let logs = [];
        try {
            if (fs.existsSync(chatLogsPath)) {
                const logsData = fs.readFileSync(chatLogsPath, 'utf8');
                if (logsData.trim()) {
                    logs = JSON.parse(logsData);
                }
            }
        } catch (error) {
            console.error('Error reading logs file:', error);
            logs = []; // Reset if error
        }
        
        // Add new log and keep only the latest MAX_ENTRIES
        logs.unshift(logEntry); // Add at the beginning
        if (logs.length > MAX_ENTRIES) {
            logs = logs.slice(0, MAX_ENTRIES);
        }
        
        // Write back to file
        fs.writeFileSync(chatLogsPath, JSON.stringify(logs, null, 2));
        
    } catch (error) {
        console.error('Error logging chat message:', error);
    }
}

/**
 * Get chat logs
 */
export function getChatLogs(limit = 100) {
    try {
        if (!fs.existsSync(chatLogsPath)) {
            return [];
        }
        
        const logsData = fs.readFileSync(chatLogsPath, 'utf8');
        if (!logsData.trim()) {
            return [];
        }
        
        const logs = JSON.parse(logsData);
        return Array.isArray(logs) ? logs.slice(0, limit) : [];
    } catch (error) {
        console.error('Error reading logs:', error);
        return [];
    }
}
