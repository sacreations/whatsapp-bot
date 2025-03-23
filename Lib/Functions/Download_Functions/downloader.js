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
        if (!response.data || !response.data.data) {
            throw new Error('Invalid API response structure');
        }
        
        // Check if we have the expected meta data structure
        const mediaData = response.data.data;
        const isNewApiStructure = mediaData.meta && mediaData.meta.media && mediaData.meta.media.length > 0;
        
        let videoUrl;
        let isPreOptimized = false; // Flag to indicate if the video is already optimized
        
        if (isNewApiStructure) {
            console.log('Using new TikTok API response structure with direct media');
            
            const media = mediaData.meta.media[0];
            
            // Check if org version is available and use it directly (already optimized)
            if (media.org) {
                console.log('Using pre-optimized "org" version from TikTok API');
                videoUrl = media.org;
                isPreOptimized = true;  // Mark as pre-optimized to skip FFMPEG later
            } 
            // Fall back to HD if available
            else if (media.hd) {
                videoUrl = media.hd;
            } 
            // Last resort, use watermarked version
            else if (media.wm) {
                videoUrl = media.wm;
            } else {
                throw new Error('No valid video URL found in response');
            }
        } else {
            // Handle old API structure if needed
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
                // Return both the filename and the pre-optimized flag
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
 * Optimize video for WhatsApp compatibility
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for optimized output video
 * @param {Object} options - Options for optimization
 * @returns {Promise<string>} - Path to optimized video
 */
async function optimizeVideoForWhatsApp(inputPath, outputPath, options = {}) {
    try {
        console.log(`Optimizing video for WhatsApp compatibility: ${inputPath}`);
        
        const {
            maxDuration = 30, // WhatsApp status max duration in seconds
            maxWidth = 1280,  // Max width for good compatibility
            maxHeight = 720,  // Max height for good compatibility
            targetFileSize = 15 * 1024 * 1024, // 15MB target (WhatsApp limit is 16MB)
            forStatus = false // Special flag for status videos
        } = options;
        
        // Get video information
        const videoInfo = await getVideoInfo(inputPath);
        console.log('Video info:', videoInfo);
        
        // Determine output parameters based on input video
        const duration = videoInfo.duration || 0;
        const width = videoInfo.width || 1280;
        const height = videoInfo.height || 720;
        const fileSize = videoInfo.size || 0;
        
        // Calculate target bitrate to achieve desired file size
        // Formula: (target size in bits) / (duration in seconds)
        let targetBitrate = Math.floor((targetFileSize * 8) / duration);
        
        // Cap bitrate for very short videos to avoid quality issues
        if (duration < 5) {
            targetBitrate = Math.min(targetBitrate, 4000000); // 4Mbps max for short videos
        }
        
        // Determine resolution scaling
        let vfParams = [];
        if (width > maxWidth || height > maxHeight) {
            vfParams.push(`scale=min(${maxWidth},iw):min(${maxHeight},ih):force_original_aspect_ratio=decrease`);
        }
        
        // Add status-specific optimizations if needed
        if (forStatus) {
            // WhatsApp status requires specific encoding parameters
            vfParams.push('format=yuv420p'); // Ensure YUV 4:2:0 pixel format compatibility
        }
        
        // Build the filter string
        const vfString = vfParams.length > 0 ? `-vf "${vfParams.join(',')}"` : '';
        
        // Trim video if it's longer than maxDuration and forStatus is true
        const trimParams = (forStatus && duration > maxDuration) ? 
            `-t ${maxDuration}` : '';
        
        // Build ffmpeg command with optimized parameters for WhatsApp
        const ffmpegCmd = `ffmpeg -i "${inputPath}" ${trimParams} ${vfString} ` +
            `-c:v libx264 -profile:v baseline -level 3.0 ` +
            `-preset medium -crf 23 -maxrate ${targetBitrate} -bufsize ${targetBitrate * 2} ` +
            `-c:a aac -b:a 128k -ar 44100 -strict experimental ` +
            `-movflags +faststart -pix_fmt yuv420p "${outputPath}" -y`;
        
        console.log(`Running FFMPEG command: ${ffmpegCmd}`);
        
        // Execute the command
        const { stdout, stderr } = await execAsync(ffmpegCmd);
        
        // Check if output file exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFMPEG failed to create output file');
        }
        
        // Get optimized video info
        const optimizedInfo = await getVideoInfo(outputPath);
        console.log('Optimized video info:', optimizedInfo);
        
        return outputPath;
    } catch (error) {
        console.error('Error optimizing video for WhatsApp:', error);
        throw error;
    }
}

/**
 * Get video information using ffprobe
 * @param {string} videoPath - Path to video file
 * @returns {Promise<Object>} - Video information
 */
async function getVideoInfo(videoPath) {
    try {
        // Get file size
        const stats = fs.statSync(videoPath);
        const fileSizeInBytes = stats.size;
        
        // Get video metadata with ffprobe
        const ffprobeCmd = `ffprobe -v error -select_streams v:0 -show_entries stream=width,height,duration,codec_name -show_entries format=duration -of json "${videoPath}"`;
        const { stdout } = await execAsync(ffprobeCmd);
        
        const data = JSON.parse(stdout);
        const stream = data.streams && data.streams[0] ? data.streams[0] : {};
        const format = data.format || {};
        
        return {
            width: stream.width,
            height: stream.height,
            // Use stream duration if available, fall back to format duration, or default to 0
            duration: parseFloat(stream.duration || format.duration || 0),
            codec: stream.codec_name,
            size: fileSizeInBytes
        };
    } catch (error) {
        console.error('Error getting video info:', error);
        return { width: 0, height: 0, duration: 0, codec: null, size: 0 };
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
        // Create download directory if it doesn't exist
        const downloadDir = path.join(process.cwd(), config.DOWNLOAD_FOLDER || 'downloads');
        if (!fs.existsSync(downloadDir)) {
            fs.mkdirSync(downloadDir, { recursive: true });
        }
        
        // Parse options
        const isAudio = options.isAudio || false;
        
        // Generate unique filename
        const timestamp = new Date().getTime();
        const randomString = Math.random().toString(36).substring(2, 8);
        const extension = isAudio ? 'mp3' : 'mp4';
        const filename = `${platform}_${timestamp}_${randomString}.${extension}`;
        const outputPath = path.join(downloadDir, filename);
        
        console.log(`Starting ${platform} download: ${url} => ${outputPath}`);
        
        let downloadedPath;
        
        // Check if FFmpeg processing is disabled
        const skipFfmpeg = config.DISABLE_FFMPEG_PROCESSING === true;
        
        if (skipFfmpeg) {
            console.log('FFmpeg processing is disabled, using direct download');
        }
        
        switch (platform.toLowerCase()) {
            case 'youtube':
                if (skipFfmpeg) {
                    // Direct download without FFmpeg
                    downloadedPath = await downloadFromYouTube(url, isAudio); // Corrected function name
                } else {
                    // Normal download with FFmpeg processing
                    downloadedPath = await downloadFromYouTube(url, isAudio); // Corrected function name
                }
                break;
                
            case 'tiktok':
                // Fix function name - use downloadFromTikTok instead of downloadTikTok
                downloadedPath = await downloadFromTikTok(url);
                
                // Apply FFmpeg only if not disabled and not pre-optimized
                if (!skipFfmpeg && downloadedPath && !downloadedPath.isPreOptimized) {
                    console.log('Applying FFmpeg processing to TikTok video');
                    const processedPath = await optimizeVideoForUniversalCompatibility(
                        downloadedPath.path || downloadedPath, 
                        outputPath.replace('.mp4', '_optimized.mp4')
                    );
                    downloadedPath = processedPath;
                } else if (downloadedPath && downloadedPath.path) {
                    // If it's an object with path property, extract just the path
                    downloadedPath = downloadedPath.path;
                }
                break;
                
            case 'instagram':
                downloadedPath = await downloadFromInstagram(url); // Corrected function name
                // Apply FFmpeg only if not disabled
                if (!skipFfmpeg && downloadedPath) {
                    console.log('Applying FFmpeg processing to Instagram media');
                    const processedPath = await optimizeVideoForUniversalCompatibility(
                        downloadedPath, 
                        outputPath.replace('.mp4', '_optimized.mp4')
                    );
                    downloadedPath = processedPath;
                }
                break;
                
            case 'facebook':
                downloadedPath = await downloadFromFacebook(url); // Corrected function name
                // Apply FFmpeg only if not disabled
                if (!skipFfmpeg && downloadedPath) {
                    console.log('Applying FFmpeg processing to Facebook video');
                    const processedPath = await optimizeVideoForUniversalCompatibility(
                        downloadedPath, 
                        outputPath.replace('.mp4', '_optimized.mp4')
                    );
                    downloadedPath = processedPath;
                }
                break;
                
            // Add more platforms as needed
                
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        console.log(`Successfully downloaded media: ${downloadedPath}`);
        return downloadedPath;
    } catch (error) {
        console.error(`Error downloading media:`, error);
        throw error;
    }
}

/**
 * Optimize video for universal compatibility (WhatsApp status + all devices)
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for optimized output video
 * @returns {Promise<string>} - Path to optimized video
 */
async function optimizeVideoForUniversalCompatibility(inputPath, outputPath) {
    try {
        console.log(`Optimizing video for universal compatibility: ${inputPath}`);
        
        // Get video information
        const videoInfo = await getVideoInfo(inputPath);
        console.log('Original video info:', videoInfo);
        
        // Determine output parameters based on input video
        const duration = videoInfo.duration || 0;
        const width = videoInfo.width || 1280;
        const height = videoInfo.height || 720;
        const fileSize = videoInfo.size || 0;
        
        // Calculate target size with higher limits (5-15MB range is okay)
        // Use higher target sizes for better quality
        let targetFileSize;
        if (duration <= 15) {
            // Short videos can have higher quality
            targetFileSize = 15 * 1024 * 1024; // 15MB for short videos
        } else if (duration <= 30) {
            // Standard status videos
            targetFileSize = 13 * 1024 * 1024; // 13MB
        } else if (duration <= 60) {
            // Medium-length videos
            targetFileSize = 11 * 1024 * 1024; // 11MB
        } else {
            // Long videos
            targetFileSize = 9 * 1024 * 1024; // 9MB per minute, max 30MB
            // Cap at 30MB for very long videos
            targetFileSize = Math.min(30 * 1024 * 1024, targetFileSize * (Math.ceil(duration / 60)));
        }
        
        // Use original file size to determine compression strategy
        const compressionRatio = targetFileSize / fileSize;
        
        // Determine adaptive CRF (quality) based on compression needed
        // Higher quality (lower CRF) since we're allowing larger files
        let crf;
        if (compressionRatio >= 0.8) {
            crf = 20; // Minimal compression needed - very good quality
        } else if (compressionRatio >= 0.5) {
            crf = 22; // Moderate compression - good quality
        } else if (compressionRatio >= 0.3) {
            crf = 24; // Higher compression - decent quality
        } else {
            crf = 26; // Major compression - acceptable quality
        }
        
        console.log(`Using CRF ${crf} based on compression ratio ${compressionRatio.toFixed(2)}`);
        
        // Scale down resolution only if it's significantly larger than needed
        let maxHeight = 720; // Default to 720p
        
        if (compressionRatio < 0.2 && height > 720) {
            maxHeight = 480; // Only scale to 480p for very large files
            console.log(`Scaling down to 480p for better compression`);
        }
        
        // Calculate matching width while maintaining aspect ratio
        const maxWidth = Math.floor((width / height) * maxHeight);
        
        // Set up video filter parameters
        let vfParams = [];
        
        // Scale video to target resolution if needed
        if (height > maxHeight) {
            vfParams.push(`scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease`);
        }
        
        // Ensure YUV 4:2:0 pixel format for maximum compatibility
        vfParams.push('format=yuv420p');
        
        // Build the filter string
        const vfString = vfParams.length > 0 ? `-vf "${vfParams.join(',')}"` : '';
        
        // Adjust audio bitrate based on content type
        // Higher quality audio for better experience
        let audioBitrate = '96k'; // Default to decent quality for most videos
        
        // Use 'fast' preset for quicker processing without much quality loss
        let ffmpegCmd = `ffmpeg -i "${inputPath}" ${vfString} ` +
            `-c:v libx264 -profile:v baseline -level 3.0 ` +
            `-preset fast -crf ${crf} ` + // Use fast preset for speed
            `-c:a aac -b:a ${audioBitrate} -ar 44100 ` + // Keep stereo audio for better quality
            `-movflags +faststart -pix_fmt yuv420p "${outputPath}" -y`;
        
        console.log(`Running FFMPEG command: ${ffmpegCmd}`);
        
        // Execute the command
        const { stdout, stderr } = await execAsync(ffmpegCmd);
        
        // Check if output file exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFMPEG failed to create output file');
        }
        
        // Get optimized video info
        const optimizedInfo = await getVideoInfo(outputPath);
        console.log('Optimized video info:', optimizedInfo);
        
        // Show file size reduction
        const originalSize = videoInfo.size;
        const optimizedSize = optimizedInfo.size;
        const percentReduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
        console.log(`File size reduction: ${formatSize(originalSize)} → ${formatSize(optimizedSize)} (${percentReduction}% reduction)`);
        
        // If file is still extremely large (>30MB), do a simple second pass with just a bit more compression
        if (optimizedSize > 30 * 1024 * 1024) {
            console.log(`Output still too large (${formatSize(optimizedSize)}), performing quick second pass`);
            
            const secondPassOutput = outputPath.replace('.mp4', '_pass2.mp4');
            const secondPassCrf = crf + 2; // Just a bit more compression
            
            const secondPassCmd = `ffmpeg -i "${outputPath}" -c:v libx264 -preset fast -crf ${secondPassCrf} ` +
                `-c:a copy "${secondPassOutput}" -y`;
            
            console.log(`Running quick second pass: ${secondPassCmd}`);
            await execAsync(secondPassCmd);
            
            // Replace with second pass output if successful
            if (fs.existsSync(secondPassOutput)) {
                fs.unlinkSync(outputPath);
                fs.renameSync(secondPassOutput, outputPath);
                console.log(`Quick second pass complete`);
            }
        }
        
        // Delete the original file to save space
        if (inputPath !== outputPath && fs.existsSync(inputPath)) {
            fs.unlinkSync(inputPath);
            console.log(`Deleted temporary file: ${inputPath}`);
        }
        
        return outputPath;
    } catch (error) {
        console.error('Error optimizing video for universal compatibility:', error);
        // If optimization fails, return the original file path
        return inputPath;
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

/**
 * Optimize video specifically for WhatsApp status compatibility
 * This function enforces stricter parameters than the universal compatibility function
 * @param {string} inputPath - Path to input video
 * @param {string} outputPath - Path for optimized output video
 * @returns {Promise<string>} - Path to optimized video
 */
export async function optimizeVideoForStatus(inputPath, outputPath) {
    try {
        console.log(`Optimizing video specifically for WhatsApp status: ${inputPath}`);
        
        // Get video information
        const videoInfo = await getVideoInfo(inputPath);
        console.log('Original video info:', videoInfo);
        
        // WhatsApp status has strict requirements
        const maxDuration = 30; // WhatsApp status max 30 seconds
        const maxWidth = 1280;
        const maxHeight = 720;
        const targetFileSize = 7 * 1024 * 1024; // Target 7MB for better compatibility
        
        // Determine duration (with safety checks)
        const duration = videoInfo.duration || 0;
        
        // Trim video if it's longer than maxDuration
        const needsTrimming = duration > maxDuration;
        const trimParams = needsTrimming ? `-t ${maxDuration}` : '';
        
        if (needsTrimming) {
            console.log(`Video duration (${duration}s) exceeds maximum allowed (${maxDuration}s). Will trim.`);
        }
        
        // Calculate target bitrate more conservatively for status videos
        // Formula: (target size in bits) / (duration in seconds)
        const effectiveDuration = Math.min(duration, maxDuration);
        let targetBitrate = Math.floor((targetFileSize * 8) / effectiveDuration);
        
        // Cap bitrate for very short videos
        if (effectiveDuration < 5) {
            targetBitrate = Math.min(targetBitrate, 2500000); // 2.5Mbps max for short status videos
        } else {
            targetBitrate = Math.min(targetBitrate, 1500000); // 1.5Mbps for regular status videos
        }
        
        // Determine scale parameters if needed
        const width = videoInfo.width || 1280;
        const height = videoInfo.height || 720;
        
        // Always scale for status videos to ensure compatibility
        const scaleFactor = Math.min(1, maxWidth / width, maxHeight / height);
        const newWidth = Math.round(width * scaleFactor);
        const newHeight = Math.round(height * scaleFactor);
        
        // Set up video filter parameters - more strict for status videos
        let vfParams = [];
        
        // Add scaling
        vfParams.push(`scale=${newWidth}:${newHeight}`);
        
        // Ensure YUV 4:2:0 pixel format for maximum compatibility
        vfParams.push('format=yuv420p');
        
        // Build the filter string
        const vfString = `-vf "${vfParams.join(',')}"`;
        
        // Use 'veryfast' preset for speed but add a second pass for quality control
        // First pass (analysis)
        const passLogFile = outputPath.replace('.mp4', '-passlog');
        
        const firstPassCmd = `ffmpeg -y -i "${inputPath}" ${trimParams} ` +
            `-c:v libx264 -preset veryfast -b:v ${targetBitrate} ` +
            `-pass 1 -passlogfile "${passLogFile}" -an ${vfString} ` +
            `-profile:v baseline -level 3.0 -pix_fmt yuv420p -f mp4 /dev/null`;
        
        // Second pass (encoding) - keep stereo audio by removing the -ac parameter
        const secondPassCmd = `ffmpeg -y -i "${inputPath}" ${trimParams} ` +
            `-c:v libx264 -preset veryfast -b:v ${targetBitrate} ` +
            `-pass 2 -passlogfile "${passLogFile}" ${vfString} ` +
            `-profile:v baseline -level 3.0 ` +
            `-c:a aac -b:a 96k -ar 44100 ` + // Keep stereo audio (removed -ac 1)
            `-movflags +faststart -pix_fmt yuv420p "${outputPath}"`;
        
        console.log('Running first pass analysis...');
        console.log(firstPassCmd);
        await execAsync(firstPassCmd.replace('/dev/null', process.platform === 'win32' ? 'NUL' : '/dev/null'));
        
        console.log('Running second pass encoding...');
        console.log(secondPassCmd);
        await execAsync(secondPassCmd);
        
        // Clean up passlog files
        if (fs.existsSync(`${passLogFile}-0.log`)) {
            fs.unlinkSync(`${passLogFile}-0.log`);
        }
        if (fs.existsSync(`${passLogFile}-0.log.mbtree`)) {
            fs.unlinkSync(`${passLogFile}-0.log.mbtree`);
        }
        
        // Verify the result
        if (!fs.existsSync(outputPath)) {
            throw new Error('Status optimization failed to create output file');
        }
        
        const optimizedInfo = await getVideoInfo(outputPath);
        console.log('Optimized status video info:', optimizedInfo);
        
        // Verify file size is under limit
        const maxAllowedSize = 15 * 1024 * 1024; // 15MB absolute maximum
        if (optimizedInfo.size > maxAllowedSize) {
            console.log(`Optimized video still too large (${formatSize(optimizedInfo.size)}), performing emergency compression`);
            
            // Emergency final pass with more aggressive settings - keep stereo audio
            const emergencyOutput = outputPath.replace('.mp4', '_emergency.mp4');
            
            const emergencyCmd = `ffmpeg -y -i "${outputPath}" ` +
                `-c:v libx264 -preset faster -crf 30 ` +
                `-vf "scale=640:360,format=yuv420p" ` +
                `-profile:v baseline -level 3.0 ` +
                `-c:a aac -b:a 48k -ar 44100 ` + // Keep stereo audio (removed -ac 1)
                `-movflags +faststart "${emergencyOutput}"`;
            
            console.log(emergencyCmd);
            await execAsync(emergencyCmd);
            
            // Replace output with emergency version
            if (fs.existsSync(emergencyOutput)) {
                fs.unlinkSync(outputPath);
                fs.renameSync(emergencyOutput, outputPath);
                
                // Get final info
                const finalInfo = await getVideoInfo(outputPath);
                console.log('Emergency compressed video info:', finalInfo);
            }
        }
        
        // Video is now optimized for WhatsApp status
        return outputPath;
    } catch (error) {
        console.error('Error optimizing video for WhatsApp status:', error);
        throw error;
    }
}
