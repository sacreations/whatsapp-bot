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
 * Re-mux media file to ensure compatibility and optimize file size
 * @param {string} inputPath - Path to input file
 * @param {string} outputFormat - Output format (mp4, mp3, etc.)
 * @param {object} options - Options for compression
 * @returns {string} - Path to re-muxed file
 */
async function remuxMedia(inputPath, outputFormat = 'mp4', options = {}) {
    try {
        // Create output path with proper extension
        const outputPath = inputPath.replace(/\.[^/.]+$/, '') + `_optimized.${outputFormat}`;
        
        console.log(`Optimizing ${inputPath} to ${outputPath}`);
        
        // Default compression options
        const compressionLevel = options.compressionLevel || 'medium'; // low, medium, high
        const maxResolution = options.maxResolution || 720; // Maximum vertical resolution (720p)
        const targetSize = options.targetSize || 0; // Target size in MB (0 = auto)
        
        // Select FFmpeg parameters based on format and compression level
        let ffmpegParams = '';
        
        if (outputFormat === 'mp4') {
            // For video files, apply different compression based on level
            switch(compressionLevel) {
                case 'low': // Very minor compression, preserve most quality
                    ffmpegParams = `-c:v libx264 -crf 23 -preset faster -c:a aac -b:a 128k`;
                    break;
                    
                case 'medium': // Default - good balance of quality and size
                    ffmpegParams = `-c:v libx264 -crf 28 -preset medium -c:a aac -b:a 96k`;
                    break;
                    
                case 'high': // Maximum compression, may reduce quality
                    ffmpegParams = `-c:v libx264 -crf 32 -preset medium -c:a aac -b:a 64k`;
                    break;
                    
                default: // Same as medium
                    ffmpegParams = `-c:v libx264 -crf 28 -preset medium -c:a aac -b:a 96k`;
            }
            
            // Add resolution control if requested
            if (maxResolution > 0) {
                // First get video info to check original resolution
                const { stdout } = await execAsync(`ffprobe -v error -select_streams v:0 -show_entries stream=width,height -of csv=p=0 "${inputPath}"`);
                const [width, height] = stdout.trim().split(',').map(Number);
                
                if (height > maxResolution) {
                    // Calculate new width to maintain aspect ratio
                    const newWidth = Math.round((width / height) * maxResolution);
                    ffmpegParams += ` -vf "scale=${newWidth}:${maxResolution}"`;
                    console.log(`Resizing video from ${width}x${height} to ${newWidth}x${maxResolution}`);
                }
            }
            
            // Execute FFmpeg command with the parameters
            await execAsync(`ffmpeg -i "${inputPath}" ${ffmpegParams} -movflags faststart "${outputPath}"`);
            
        } else if (outputFormat === 'mp3') {
            // For audio files, use different bitrates based on compression level
            let audioBitrate;
            switch(compressionLevel) {
                case 'low': audioBitrate = '192k'; break;
                case 'medium': audioBitrate = '128k'; break;
                case 'high': audioBitrate = '96k'; break;
                default: audioBitrate = '128k';
            }
            
            await execAsync(`ffmpeg -i "${inputPath}" -vn -c:a libmp3lame -b:a ${audioBitrate} "${outputPath}"`);
            
        } else if (outputFormat === 'jpg' || outputFormat === 'jpeg') {
            // For images, use different quality levels
            let quality;
            switch(compressionLevel) {
                case 'low': quality = 95; break;
                case 'medium': quality = 85; break;
                case 'high': quality = 75; break;
                default: quality = 85;
            }
            
            await execAsync(`ffmpeg -i "${inputPath}" -q:v ${quality} "${outputPath}"`);
            
        } else {
            // For other formats, just copy
            await execAsync(`ffmpeg -i "${inputPath}" -c copy "${outputPath}"`);
        }
        
        // Log size difference
        const originalSize = fs.statSync(inputPath).size;
        const newSize = fs.statSync(outputPath).size;
        const percentReduction = ((originalSize - newSize) / originalSize * 100).toFixed(2);
        
        console.log(`Optimization complete: ${formatSize(originalSize)} → ${formatSize(newSize)} (${percentReduction}% reduction)`);
        
        // Return the path to the optimized file
        return outputPath;
    } catch (error) {
        console.error('Error during media optimization:', error);
        // If optimization fails, return the original file path
        return inputPath;
    }
}

/**
 * Format file size to human-readable string
 * @param {number} bytes - Size in bytes
 * @returns {string} - Formatted size
 */
function formatSize(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
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
 * Download media from social media platforms with optimization
 * @param {string} url - Media URL
 * @param {string} platform - Platform name
 * @param {object} options - Download options
 * @returns {string} - Path to downloaded and optimized file
 */
export async function downloadMedia(url, platform, options = {}) {
    try {
        console.log(`Downloading media from ${platform}: ${url}`);
        
        let downloadedPath = '';
        
        // Set compression options based on platform or user preferences
        const compressionOptions = {
            compressionLevel: options.compressionLevel || getPlatformCompressionLevel(platform),
            maxResolution: options.maxResolution || 720,
            targetSize: options.targetSize || 0
        };
        
        console.log(`Using compression level: ${compressionOptions.compressionLevel}`);
        
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
        
        // Optimize the file based on format
        const outputFormat = options.isAudio ? 'mp3' : 'mp4';
        const optimizedPath = await remuxMedia(downloadedPath, outputFormat, compressionOptions);
        
        // Delete the original file if optimization was successful and created a new file
        if (optimizedPath !== downloadedPath && fs.existsSync(optimizedPath)) {
            fs.unlinkSync(downloadedPath);
        }
        
        return optimizedPath;
    } catch (error) {
        console.error(`Error downloading from ${platform}:`, error);
        throw error;
    }
}

/**
 * Get appropriate compression level for different platforms
 * @param {string} platform - Social media platform
 * @returns {string} - Compression level
 */
function getPlatformCompressionLevel(platform) {
    switch(platform) {
        case 'YouTube': return 'medium'; // YouTube already has good compression
        case 'TikTok': return 'medium';  // TikTok videos are usually small already
        case 'Instagram': return 'medium'; // Instagram needs decent quality
        case 'Facebook': return 'medium'; // Facebook videos can be large
        case 'Twitter': return 'medium';  // Twitter media is usually compressed already
        default: return 'medium';
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
