import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import config from '../../../Config.js';
import youtubedl from 'youtubedl-core';

const execAsync = promisify(exec);

// Ensure download directory exists
const downloadDir = path.resolve(config.DOWNLOAD_FOLDER);
if (!fs.existsSync(downloadDir)) {
    fs.mkdirSync(downloadDir, { recursive: true });
}

/**
 * Generate a random filename
 */
function generateFilename(platform, extension) {
    const timestamp = new Date().getTime();
    const random = Math.floor(Math.random() * 1000);
    return path.join(downloadDir, `${platform.toLowerCase()}_${timestamp}_${random}.${extension}`);
}

/**
 * Download media from YouTube
 */
async function downloadFromYouTube(url) {
    try {
        const info = await youtubedl.getInfo(url);
        const format = youtubedl.chooseFormat(info.formats, { quality: '18' }); // 360p MP4
        
        if (!format) {
            throw new Error('No suitable format found');
        }
        
        const filename = generateFilename('YouTube', 'mp4');
        const writeStream = fs.createWriteStream(filename);
        
        const response = await axios({
            method: 'get',
            url: format.url,
            responseType: 'stream'
        });
        
        response.data.pipe(writeStream);
        
        return new Promise((resolve, reject) => {
            writeStream.on('finish', () => resolve(filename));
            writeStream.on('error', reject);
        });
    } catch (error) {
        console.error('YouTube download error:', error);
        throw new Error(`Failed to download YouTube video: ${error.message}`);
    }
}

/**
 * Download media from TikTok using API
 */
async function downloadFromTikTok(url) {
    try {
        // This is just a placeholder - you'd need to implement an actual TikTok downloader
        // Either using a third-party API or a library
        const apiUrl = `https://api-example.com/tiktok?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl);
        const videoUrl = response.data.video_url;
        
        if (!videoUrl) {
            throw new Error('Could not extract video URL');
        }
        
        // Download the video
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
        // This is just a placeholder - you'd need to implement an actual Instagram downloader
        // Either using a third-party API or a library
        const apiUrl = `https://api-example.com/instagram?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl);
        const mediaUrl = response.data.media_url;
        const isVideo = response.data.is_video;
        
        if (!mediaUrl) {
            throw new Error('Could not extract media URL');
        }
        
        // Download the media
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
        // This is just a placeholder - you'd need to implement an actual Facebook downloader
        // Either using a third-party API or a library
        const apiUrl = `https://api-example.com/facebook?url=${encodeURIComponent(url)}`;
        
        const response = await axios.get(apiUrl);
        const videoUrl = response.data.video_url;
        
        if (!videoUrl) {
            throw new Error('Could not extract video URL');
        }
        
        // Download the video
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
 * General media download function
 */
export async function downloadMedia(url, platform) {
    try {
        let downloadedFilePath;
        
        switch (platform) {
            case 'YouTube':
                downloadedFilePath = await downloadFromYouTube(url);
                break;
            case 'TikTok':
                downloadedFilePath = await downloadFromTikTok(url);
                break;
            case 'Instagram':
                downloadedFilePath = await downloadFromInstagram(url);
                break;
            case 'Facebook':
                downloadedFilePath = await downloadFromFacebook(url);
                break;
            case 'Twitter':
                downloadedFilePath = await downloadFromTwitter(url);
                break;
            default:
                throw new Error('Unsupported platform');
        }
        
        return downloadedFilePath;
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
