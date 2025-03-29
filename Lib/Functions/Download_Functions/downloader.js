import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from '../../../Config.js';
import { downloadYouTubeVideo } from './ytDownloader.js';

// Ensure download directory exists
const downloadDir = path.resolve(config.DOWNLOAD_FOLDER);

// Centralized directory creation
function ensureDownloadDir() {
    if (!fs.existsSync(downloadDir)) {
        fs.mkdirSync(downloadDir, { recursive: true });
    }
}

// Call this at the start of your script
ensureDownloadDir();

// API Endpoints for social media platforms
const Tiktok_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/tiktok?url=';
const Instagram_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/instagram?url=';
const Facebook_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/facebook?url=';


/**
 * Generate a random filename
 */
function generateFilename(platform, extension) {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return path.join(downloadDir, `${platform.toLowerCase()}_${timestamp}_${random}.${extension}`);
}

/**
 * Download media from TikTok using API
 */
async function downloadFromTikTok(url) {
    try {
        const response = await axios.get(Tiktok_apiEndpoint + url);
        if (!response.data || !response.data.data) {
            throw new Error('Invalid API response structure');
        }
        
        const mediaData = response.data.data;
        const isNewApiStructure = mediaData.meta && mediaData.meta.media && mediaData.meta.media.length > 0;
        
        let videoUrl;
        let isPreOptimized = false; // Flag to indicate if the video is already optimized
        
        if (isNewApiStructure) {
            console.log('Using new TikTok API response structure with direct media');
            
            const media = mediaData.meta.media[0];
            
            if (media.org) {
                console.log('Using pre-optimized "org" version from TikTok API');
                videoUrl = media.org;
                isPreOptimized = true;  // Mark as pre-optimized to skip FFMPEG later
            } else if (media.hd) {
                videoUrl = media.hd;
            } else if (media.wm) {
                videoUrl = media.wm;
            } else {
                throw new Error('No valid video URL found in response');
            }
        } else {
            if (!response.data.data.meta || !response.data.data.meta.media) {
                throw new Error('Invalid API response structure');
            }
            
            const media = response.data.data.meta.media[0];
            videoUrl = media.hd || media.org;
            
            if (!videoUrl) {
                throw new Error('No valid video URL found in response');
            }
        }
        
        const filename = generateFilename('TikTok', 'mp4');
        const writeStream = fs.createWriteStream(filename);
        
        const videoResponse = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream'
        });
        
        videoResponse.data.pipe(writeStream);
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => {
                resolve({ path: filename, isPreOptimized });
            });
            writeStream.on('error', reject);
        });
    } catch (error) {
        console.error('TikTok download error:', error);
        throw new Error(`Failed to download TikTok video: ${error.message}`);
    }
}

/**
 * Download media from Instagram using API
 */
async function downloadFromInstagram(url) {
    try {
        const response = await axios.get(Instagram_apiEndpoint + url);
        if (!response.data || !response.data.data || !response.data.data[0]) {
            throw new Error('Invalid API response structure');
        }
        
        const media = response.data.data[0];
        const mediaUrl = media.url;
        
        if (!mediaUrl) {
            throw new Error('No media URL found in response');
        }
        
        const isVideo = true; // Placeholder - implement a proper check if needed
        const extension = isVideo ? 'mp4' : 'jpg';
        
        const filename = generateFilename('Instagram', extension);
        const writeStream = fs.createWriteStream(filename);
        
        const mediaResponse = await axios({
            method: 'get',
            url: mediaUrl,
            responseType: 'stream'
        });
        
        mediaResponse.data.pipe(writeStream);
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(filename));
            writeStream.on('error', reject);
        });
    } catch (error) {
        console.error('Instagram download error:', error);
        throw new Error(`Failed to download Instagram media: ${error.message}`);
    }
}

/**
 * Download media from Facebook using API
 */
async function downloadFromFacebook(url) {
    try {
        const response = await axios.get(Facebook_apiEndpoint + url);
        if (!response.data) {
            throw new Error('Invalid API response');
        }
        
        let videoUrl;
        
        if (response.data.isHdAvailable && response.data.urls && response.data.urls.length > 0) {
            if (response.data.urls[0].hd) {
                videoUrl = response.data.urls[0].hd;
            } else if (response.data.urls[0].sd) {
                videoUrl = response.data.urls[0].sd;
            } else {
                throw new Error('No valid video URL found in response');
            }
        } else if (response.data.urls && response.data.urls.length > 0 && response.data.urls[0].sd) {
            videoUrl = response.data.urls[0].sd;
        } else {
            throw new Error('No valid video URL found in response');
        }
        
        if (!videoUrl) {
            throw new Error('Could not extract video URL');
        }
        
        const filename = generateFilename('Facebook', 'mp4');
        const writeStream = fs.createWriteStream(filename);
        
        const videoResponse = await axios({
            method: 'get',
            url: videoUrl,
            responseType: 'stream'
        });
        
        videoResponse.data.pipe(writeStream);
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(filename));
            writeStream.on('error', reject);
        });
    } catch (error) {
        console.error('Facebook download error:', error);
        throw new Error(`Failed to download Facebook video: ${error.message}`);
    }
}

/**
 * Download and process media from various platforms
 * @param {string} url - Media URL
 * @param {string} platform - Platform name (YouTube, TikTok, etc.)
 * @param {Object} options - Download options
 * @returns {Promise<string>} - Path to downloaded media
 */
export async function downloadMedia(url, platform, options = {}) {
    try {
        // Parse options
        const isAudio = options.isAudio || false;
        
        // Generate unique filename
        const timestamp = new Date().getTime();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = isAudio ? 'mp3' : 'mp4';
        const filename = `${platform}_${timestamp}_${randomString}.${extension}`;
        const outputPath = path.join(downloadDir, filename);
        
        let downloadedPath;
        
        const skipFfmpeg = config.DISABLE_FFMPEG_PROCESSING === true || config.DISABLE_FFMPEG_PROCESSING === 'true';
        
        switch (platform.toLowerCase()) {
            case 'youtube':
                downloadedPath = await downloadYouTubeVideo(url);
                break;
                
            case 'tiktok':
                downloadedPath = await downloadFromTikTok(url);
                break;
                
            case 'instagram':
                downloadedPath = await downloadFromInstagram(url);
                break;
                
            case 'facebook':
                downloadedPath = await downloadFromFacebook(url);
                break;
                
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        console.log(`Successfully downloaded media: ${downloadedPath}`);
        // convert download path to string 
        downloadedPath = downloadedPath.toString();
        return downloadedPath;
    } catch (error) {
        console.error(`Error downloading media:`, error);
        throw error;
    }
}

/**
 * Clean up old downloaded files
 */
export function cleanupDownloads(maxAgeInHours = 24) {
    try {
        const files = fs.readdirSync(downloadDir);
        const now = new Date().getTime();
        
        for (const file of files) {
            const filePath = path.join(downloadDir, file);
            const stats = fs.statSync(filePath);
            
            if ((now - stats.mtime.getTime()) > (maxAgeInHours * 3600 * 1000)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old file: ${filePath}`);
            }
        }
    } catch (error) {
        console.error('Error cleaning up downloads:', error);
    }
}
