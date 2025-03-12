import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from '../../../Config.js';
import { downloadYoutubeVideo, downloadYoutubeAudio } from './ytDownloader.js';
import { exec } from 'child_process';
import { promisify } from 'util';

// Ensure download directory exists
const downloadDir = path.resolve(config.DOWNLOAD_FOLDER);
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

// API Endpoints for social media platforms
const Tiktok_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/tiktok?url=';
const Instagram_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/instagram?url=';
const Facebook_apiEndpoint = 'https://delirius-apiofc.vercel.app/download/facebook?url=';

// Execute shell commands asynchronously
const execAsync = promisify(exec);

/**
 * Generate a random filename
 */
function generateFilename(platform, extension) {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return path.join(downloadDir, `${platform.toLowerCase()}_${timestamp}_${random}.${extension}`);
}

/**
 * Re-mux media file to ensure compatibility
 * @param {string} inputPath - Path to input file
 * @param {string} outputFormat - Output format (mp4, mp3, etc.)
 * @returns {string} - Path to re-muxed file
 */
async function remuxMedia(inputPath, outputFormat = 'mp4') {
    try {
        // Create output path with proper extension
        const outputPath = inputPath.replace(/\.[^/.]+$/, '') + `_remuxed.${outputFormat}`;
        
        console.log(`Re-muxing ${inputPath} to ${outputPath}`);
        
        // Execute FFmpeg command to re-mux without re-encoding
        if (outputFormat === 'mp4') {
            // For video files: preserve both audio and video streams
            await execAsync(`ffmpeg -i "${inputPath}" -c copy -movflags faststart "${outputPath}"`);
        } else if (outputFormat === 'mp3') {
            // For audio files: extract audio stream only
            await execAsync(`ffmpeg -i "${inputPath}" -vn -c:a libmp3lame -q:a 4 "${outputPath}"`);
        } else {
            // For other formats: general copy
            await execAsync(`ffmpeg -i "${inputPath}" -c copy "${outputPath}"`);
        }
        
        console.log(`Re-muxing completed successfully: ${outputPath}`);
        
        // Return the path to the remuxed file
        return outputPath;
    } catch (error) {
        console.error('Error during re-muxing:', error);
        // If re-muxing fails, return the original file path
        return inputPath;
    }
}

/**
 * Download media from YouTube using RapidAPI approach
 */
async function downloadFromYouTube(url, isAudio = false) {
    try {
        console.log(`Attempting to download YouTube ${isAudio ? 'audio' : 'video'}: ${url}`);
        
        // Generate filename based on media type
        const extension = isAudio ? 'mp3' : 'mp4';
        const filename = generateFilename('YouTube', extension);
        
        try {
            // Use our RapidAPI downloader
            if (isAudio) {
                await downloadYoutubeAudio(url, filename);
                console.log(`YouTube audio downloaded successfully: ${filename}`);
            } else {
                await downloadYoutubeVideo(url, filename, '720p'); 
                console.log(`YouTube video downloaded successfully: ${filename}`);
            }
            
            return filename;
        } catch (downloadError) {
            console.error('YouTube download error:', downloadError);
            throw new Error(`Failed to download: ${downloadError.message}`);
        }
    } catch (error) {
        console.error('YouTube download error:', error);
        throw new Error(`Failed to download YouTube ${isAudio ? 'audio' : 'video'}: ${error.message}`);
    }
}

/**
 * Download media from TikTok using API
 */
async function downloadFromTikTok(url) {
    try {
        const response = await axios.get(Tiktok_apiEndpoint + url);
        if (!response.data || !response.data.data || !response.data.data.meta || !response.data.data.meta.media) {
            throw new Error('Invalid API response structure');
        }
        
        const media = response.data.data.meta.media[0];
        const videoUrl = media.hd || media.org;
        
        if (!videoUrl) {
            throw new Error('No valid video URL found in response');
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
            writeStream.on('finish', () => resolve(filename));
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
        
        // Determine if it's a video or image based on URL
        const isVideo = true; // Placeholder - you'd need to implement a proper check here
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
            // Get HD version if available
            if (response.data.urls[0].hd) {
                videoUrl = response.data.urls[0].hd;
            } 
            // Fallback to SD if HD isn't available
            else if (response.data.urls[0].sd) {
                videoUrl = response.data.urls[0].sd;
            } else {
                throw new Error('No valid video URL found in response');
            }
        } else if (response.data.urls && response.data.urls.length > 0 && response.data.urls[0].sd) {
            // If HD is not available, use SD
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
 * Download media from Twitter using API
 */
async function downloadFromTwitter(url) {
    try {
        // This is just a placeholder - you'd need to implement an actual Twitter downloader
        // Either using a third-party API or a library
        const apiUrl = `https://api-example.com/twitter?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl);
        const mediaUrl = response.data.media_url;
        const isVideo = response.data.is_video;
        
        if (!mediaUrl) {
            throw new Error('Could not extract media URL');
        }
        
        // Download the media
        const extension = isVideo ? 'mp4' : 'jpg';
        const filename = generateFilename('Twitter', extension);
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
        console.error('Twitter download error:', error);
        throw new Error(`Failed to download Twitter media: ${error.message}`);
    }
}

/**
 * Download media from social media platforms
 * @param {string} url - Media URL
 * @param {string} platform - Platform name
 * @param {object} options - Download options
 * @returns {string} - Path to downloaded and re-muxed file
 */
export async function downloadMedia(url, platform, options = {}) {
    try {
        console.log(`Downloading media from ${platform}: ${url}`);
        
        let downloadedPath = '';
        let shouldRemux = true;
        
        switch(platform) {
            case 'YouTube':
                // Use YouTube downloader with isAudio option
                downloadedPath = await (options.isAudio 
                    ? downloadYoutubeAudio(url, generateFilename('youtube', 'mp3'))
                    : downloadYoutubeVideo(url, generateFilename('youtube', 'mp4')));
                break;
                
            case 'TikTok':
                downloadedPath = await downloadFromTikTok(url);
                break;
                
            case 'Instagram':
                downloadedPath = await downloadFromInstagram(url);
                break;
                
            case 'Facebook':
                downloadedPath = await downloadFromFacebook(url);
                break;
                
            case 'Twitter':
                downloadedPath = await downloadFromTwitter(url);
                break;
                
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        // Check if downloaded path is an object (some downloaders return object with filepath)
        if (typeof downloadedPath === 'object' && downloadedPath.filePath) {
            downloadedPath = downloadedPath.filePath;
        }
        
        // Re-mux the downloaded file for better compatibility
        if (shouldRemux) {
            const outputFormat = options.isAudio ? 'mp3' : 'mp4';
            const remuxedPath = await remuxMedia(downloadedPath, outputFormat);
            
            // Delete the original file if re-muxing was successful and created a new file
            if (remuxedPath !== downloadedPath && fs.existsSync(remuxedPath)) {
                fs.unlinkSync(downloadedPath);
            }
            
            return remuxedPath;
        }
        
        return downloadedPath;
    } catch (error) {
        console.error(`Error downloading from ${platform}:`, error);
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
            
            // Delete files older than maxAgeInHours
            if ((now - stats.mtime.getTime()) > (maxAgeInHours * 3600 * 1000)) {
                fs.unlinkSync(filePath);
                console.log(`Deleted old file: ${filePath}`);
            }
        }
    } catch (error) {
        console.error('Error cleaning up downloads:', error);
    }
}
