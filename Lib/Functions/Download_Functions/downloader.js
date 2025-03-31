import axios from 'axios';
import fs from 'fs';
import path from 'path';
import config from '../../../Config.js';
import { downloadYouTubeVideo } from './ytDownloader.js';

// URL cache to prevent duplicate requests
const urlCache = new Map();
const CACHE_EXPIRATION = 10 * 60 * 1000; // 10 minutes in milliseconds
const activeDownloads = new Set(); // Track URLs currently being downloaded

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
 * Clean expired entries from URL cache
 */
function cleanUrlCache() {
    const now = Date.now();
    for (const [key, cacheEntry] of urlCache.entries()) {
        if (now - cacheEntry.timestamp > CACHE_EXPIRATION) {
            urlCache.delete(key);
        }
    }
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
 * Get direct media URL from TikTok using API
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
        
        if (isNewApiStructure) {
            console.log('Using new TikTok API response structure with direct media');
            
            const media = mediaData.meta.media[0];
            videoUrl = media.org;
            
            if (!videoUrl) {
                throw new Error('No valid video URL found in response');
            }
        }
        
        console.log('Retrieved direct TikTok URL:', videoUrl);
        return videoUrl;
    } catch (error) {
        console.error('TikTok URL retrieval error:', error);
        throw new Error(`Failed to retrieve TikTok video URL: ${error.message}`);
    }
}

/**
 * Get direct media URL from Instagram using API
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
        
        console.log('Retrieved direct Instagram URL:', mediaUrl);
        return mediaUrl;
    } catch (error) {
        console.error('Instagram URL retrieval error:', error);
        throw new Error(`Failed to retrieve Instagram media URL: ${error.message}`);
    }
}

/**
 * Get direct media URL from Facebook using API
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
        
        console.log('Retrieved direct Facebook URL:', videoUrl);
        return videoUrl;
    } catch (error) {
        console.error('Facebook URL retrieval error:', error);
        throw new Error(`Failed to retrieve Facebook video URL: ${error.message}`);
    }
}

/**
 * Get direct media URLs from various platforms
 * @param {string} url - Media URL
 * @param {string} platform - Platform name (YouTube, TikTok, etc.)
 * @param {Object} options - Download options
 * @returns {Promise<string>} - Direct URL to media
 */
export async function downloadMedia(url, platform, options = {}) {
    try {
        // Generate cache key using URL and platform
        const cacheKey = `${platform.toLowerCase()}:${url}`;
        
        // Normalize URL to prevent duplicates
        url = url.split('&')[0]; // Remove query parameters
        
        // Check if this URL is currently being downloaded
        if (activeDownloads.has(cacheKey)) {
            console.log(`Download already in progress for ${url}, waiting...`);
            // Wait for the existing download to complete
            while (activeDownloads.has(cacheKey)) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }
            
            // Check if the result is now in cache
            if (urlCache.has(cacheKey)) {
                const cachedResult = urlCache.get(cacheKey);
                console.log(`Using cached URL for ${platform}: ${cachedResult.url}`);
                return cachedResult.url;
            }
        }
        
        // Check if we have a cached result
        if (urlCache.has(cacheKey)) {
            const cachedResult = urlCache.get(cacheKey);
            console.log(`Using cached URL for ${platform}: ${cachedResult.url}`);
            return cachedResult.url;
        }
        
        // Clean expired cache entries
        cleanUrlCache();
        
        // Mark this URL as currently being downloaded
        activeDownloads.add(cacheKey);
        
        try {
            let directUrl;
            
            switch (platform.toLowerCase()) {
                case 'youtube':
                    directUrl = await downloadYouTubeVideo(url);
                    break;
                    
                case 'tiktok':
                    directUrl = await downloadFromTikTok(url);
                    break;
                    
                case 'instagram':
                    directUrl = await downloadFromInstagram(url);
                    break;
                    
                case 'facebook':
                    directUrl = await downloadFromFacebook(url);
                    break;
                    
                default:
                    throw new Error(`Unsupported platform: ${platform}`);
            }
            
            console.log(`Successfully retrieved direct media URL: ${directUrl}`);
            
            // Update cache with the actual result
            urlCache.set(cacheKey, {
                url: directUrl,
                timestamp: Date.now()
            });
            
            // Remove from active downloads
            activeDownloads.delete(cacheKey);
            
            return directUrl;
        } catch (error) {
            // Remove from active downloads on error
            activeDownloads.delete(cacheKey);
            throw error;
        }
    } catch (error) {
        console.error(`Error retrieving media URL:`, error);
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
