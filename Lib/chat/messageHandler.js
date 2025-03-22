import fs from 'fs';
import axios from 'axios';
import { Readable } from 'stream';
import config from '../../Config.js';

const message = {
    /**
     * Send a text reply to a message
     */
    reply: async (text, m, sock) => {
        try {
            await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
            // Clear typing indicator after sending message
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in reply:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return false;
        }
    },
    
    /**
     * Add a reaction to a message
     */
    react: async (emoji, m, sock) => {
        try {
            return await sock.sendMessage(m.key.remoteJid, { 
                react: { 
                    text: emoji, 
                    key: m.key 
                } 
            });
        } catch (error) {
            console.error("Error in react:", error);
        }
    },
    
    /**
     * Send an image as a reply
     */
    sendImage: async (source, caption = '', m, sock) => {
        try {
            let image;
            
            if (source.startsWith('http')) {
                console.log(`Fetching image from URL: ${source}`);
                
                try {
                    // Using axios to get image with timeout and retries
                    const response = await axios.get(source, {
                        timeout: 10000, // 10 seconds timeout
                        responseType: 'arraybuffer',
                        maxContentLength: 10 * 1024 * 1024, // 10MB max size
                        validateStatus: status => status >= 200 && status < 300
                    });
                    
                    // Extract image from response
                    image = Buffer.from(response.data);
                    console.log(`Successfully fetched image (${image.length} bytes)`);
                } catch (fetchError) {
                    console.error(`Error fetching image from URL: ${fetchError.message}`);
                    throw new Error(`Could not fetch image: ${fetchError.message}`);
                }
            } else if (fs.existsSync(source)) {
                // From local file
                image = fs.readFileSync(source);
            } else {
                throw new Error('Invalid image source');
            }
            
            // Send image with better error handling
            console.log(`Sending image (${image.length} bytes) with caption: ${caption}`);
            
            await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    image, 
                    caption,
                    mimetype: 'image/jpeg' 
                }, 
                { quoted: m }
            );
            
            // Clear typing indicator after sending image
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in sendImage:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            throw error; // Re-throw to allow caller to handle
        }
    },
    
    /**
     * Send a video as a reply
     */
    sendVideo: async (source, caption = '', m, sock) => {
        try {
            let video;
            
            if (source.startsWith('http')) {
                // From URL
                video = { url: source };
            } else if (fs.existsSync(source)) {
                // From local file
                video = fs.readFileSync(source);
            } else {
                throw new Error('Invalid video source');
            }
            
            await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    video, 
                    caption,
                    mimetype: 'video/mp4' 
                }, 
                { quoted: m }
            );
            
            // Clear typing indicator after sending video
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in sendVideo:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return false;
        }
    },
    
    /**
     * Send an audio file as a reply
     */
    sendAudio: async (source, isPtt = false, m, sock) => {
        try {
            let audio;
            
            if (source.startsWith('http')) {
                audio = { url: source };
            } else if (fs.existsSync(source)) {
                audio = fs.readFileSync(source);
            } else {
                throw new Error('Invalid audio source');
            }
            
            await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    audio,
                    mimetype: 'audio/mpeg',
                    ptt: isPtt 
                }, 
                { quoted: m }
            );
            
            // Clear typing indicator after sending audio
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in sendAudio:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return false;
        }
    },
    
    /**
     * Send a document file as a reply
     */
    sendDocument: async (source, filename, mimetype, m, sock) => {
        try {
            let document;
            
            if (source.startsWith('http')) {
                document = { url: source };
            } else if (fs.existsSync(source)) {
                document = fs.readFileSync(source);
            } else {
                throw new Error('Invalid document source');
            }
            
            await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    document,
                    mimetype: mimetype || 'application/octet-stream',
                    fileName: filename || 'file' 
                }, 
                { quoted: m }
            );
            
            // Clear typing indicator after sending document
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in sendDocument:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return false;
        }
    },
    
    /**
     * Send a sticker as a reply
     */
    sendSticker: async (source, m, sock) => {
        try {
            let sticker;
            
            if (source.startsWith('http')) {
                sticker = { url: source };
            } else if (fs.existsSync(source)) {
                sticker = fs.readFileSync(source);
            } else {
                throw new Error('Invalid sticker source');
            }
            
            await sock.sendMessage(
                m.key.remoteJid, 
                { sticker }, 
                { quoted: m }
            );
            
            // Clear typing indicator after sending sticker
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return true;
        } catch (error) {
            console.error("Error in sendSticker:", error);
            // Clear typing indicator on error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            return false;
        }
    }
};

export default message;
