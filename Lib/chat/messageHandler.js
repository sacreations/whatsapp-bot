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
            return await sock.sendMessage(m.key.remoteJid, { text }, { quoted: m });
        } catch (error) {
            console.error("Error in reply:", error);
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
            
            return await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    image, 
                    caption,
                    mimetype: 'image/jpeg' 
                }, 
                { quoted: m }
            );
        } catch (error) {
            console.error("Error in sendImage:", error);
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
            
            return await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    video, 
                    caption,
                    mimetype: 'video/mp4' 
                }, 
                { quoted: m }
            );
        } catch (error) {
            console.error("Error in sendVideo:", error);
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
            
            return await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    audio,
                    mimetype: 'audio/mpeg',
                    ptt: isPtt 
                }, 
                { quoted: m }
            );
        } catch (error) {
            console.error("Error in sendAudio:", error);
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
            
            return await sock.sendMessage(
                m.key.remoteJid, 
                { 
                    document,
                    mimetype: mimetype || 'application/octet-stream',
                    fileName: filename || 'file' 
                }, 
                { quoted: m }
            );
        } catch (error) {
            console.error("Error in sendDocument:", error);
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
            
            return await sock.sendMessage(
                m.key.remoteJid, 
                { sticker }, 
                { quoted: m }
            );
        } catch (error) {
            console.error("Error in sendSticker:", error);
        }
    }
};

export default message;
