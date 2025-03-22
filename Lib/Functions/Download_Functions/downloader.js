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
        if (!fs.existsSync(config.DOWNLOAD_FOLDER)) {
            fs.mkdirSync(config.DOWNLOAD_FOLDER, { recursive: true });
        }
        
        // Generate a unique filename
        const timestamp = Date.now();
        const randomStr = Math.random().toString(36).substring(2, 8);
        const tempOutputPath = path.join(config.DOWNLOAD_FOLDER, `${platform}_${timestamp}_${randomStr}_temp.mp4`);
        const finalOutputPath = path.join(config.DOWNLOAD_FOLDER, `${platform}_${timestamp}_${randomStr}.mp4`);
        
        // Additional options
        const isAudio = options.isAudio === true;
        
        console.log(`Downloading ${platform} ${isAudio ? 'audio' : 'video'}`);

        // Download based on platform
        let downloadPath;
        
        switch(platform) {
            case 'YouTube':
                // Use YouTube downloader with isAudio option
                downloadPath = await (options.isAudio 
                    ? downloadYoutubeAudio(url, generateFilename('youtube', 'mp3'))
                    : downloadYoutubeVideo(url, generateFilename('youtube', 'mp4')));
                break;
                
            case 'TikTok':
                downloadPath = await downloadFromTikTok(url);
                break;
                
            case 'Instagram':
                downloadPath = await downloadFromInstagram(url);
                break;
                
            case 'Facebook':
                downloadPath = await downloadFromFacebook(url);
                break;
                
            case 'Twitter':
                downloadPath = await downloadFromTwitter(url);
                break;
                
            default:
                throw new Error(`Unsupported platform: ${platform}`);
        }
        
        // After download, process the video to ensure universal compatibility
        if (!isAudio && fs.existsSync(downloadPath) && downloadPath.endsWith('.mp4')) {
            return await optimizeVideoForUniversalCompatibility(downloadPath, finalOutputPath);
        }
        
        // Return the downloaded path for non-video files or audio
        return downloadPath;
    } catch (error) {
        console.error(`Error downloading ${platform} content:`, error);
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
        
        // Create a temporary path for first-pass output if needed
        const tempOutputPath = outputPath.replace('.mp4', '_temp.mp4');
        
        // Calculate target size more conservatively to ensure it's under limitations
        // Target smaller files for longer videos
        let targetFileSize;
        if (duration <= 15) {
            // Very short videos can have higher quality
            targetFileSize = 12 * 1024 * 1024; // 12MB
        } else if (duration <= 30) {
            // Standard status videos
            targetFileSize = 10 * 1024 * 1024; // 10MB
        } else if (duration <= 60) {
            // Medium-length videos
            targetFileSize = 8 * 1024 * 1024; // 8MB
        } else {
            // Long videos need more aggressive compression
            targetFileSize = 7 * 1024 * 1024; // 7MB per minute, max 30MB
            // Cap at 30MB for very long videos
            targetFileSize = Math.min(30 * 1024 * 1024, targetFileSize * (Math.ceil(duration / 60)));
        }
        
        // Use original file size to determine compression strategy
        const compressionRatio = targetFileSize / fileSize;
        
        // Determine adaptive CRF (quality) based on compression needed
        // For reference: 18 is very high quality, 23 is default, 28 is lower quality, 32+ is very compressed
        let crf;
        if (compressionRatio >= 0.8) {
            crf = 23; // Minimal compression needed
        } else if (compressionRatio >= 0.5) {
            crf = 26; // Moderate compression
        } else if (compressionRatio >= 0.3) {
            crf = 28; // Higher compression
        } else if (compressionRatio >= 0.1) {
            crf = 30; // Much higher compression
        } else {
            crf = 33; // Extreme compression for very large files
        }
        
        console.log(`Using CRF ${crf} based on compression ratio ${compressionRatio.toFixed(2)}`);
        
        // Should we scale down the resolution?
        // More aggressive scaling for larger files
        let maxHeight = 720; // Default to 720p
        
        if (compressionRatio < 0.3 && height > 720) {
            maxHeight = 480; // Scale to 480p for larger files needing compression
            console.log(`Scaling down to 480p for better compression`);
        } else if (compressionRatio < 0.1 && height > 480) {
            maxHeight = 360; // Scale to 360p for extremely large files 
            console.log(`Scaling down to 360p for extreme compression`);
        }
        
        // Calculate matching width while maintaining aspect ratio
        const maxWidth = Math.floor((width / height) * maxHeight);
        
        // Set up video filter parameters
        let vfParams = [];
        
        // Scale video to target resolution
        vfParams.push(`scale=${maxWidth}:${maxHeight}:force_original_aspect_ratio=decrease`);
        
        // Ensure YUV 4:2:0 pixel format for maximum compatibility
        vfParams.push('format=yuv420p');
        
        // Build the filter string
        const vfString = `-vf "${vfParams.join(',')}"`;
        
        // Adjust audio bitrate based on content type and duration
        let audioBitrate = '64k'; // Default to low for most videos
        
        // For short videos or videos with important audio (determined by fileSize/duration ratio)
        if (duration < 30 || (fileSize / duration) > 500000) {
            audioBitrate = '96k';
        }
        
        // Base FFMPEG settings - prioritizing size over quality
        let ffmpegCmd = `ffmpeg -i "${inputPath}" ${vfString} ` +
            `-c:v libx264 -profile:v baseline -level 3.0 ` +
            `-preset slower -crf ${crf} ` + // Use slower preset for better compression
            `-c:a aac -b:a ${audioBitrate} -ar 44100 -ac 1 ` + // Mono audio to save space
            `-movflags +faststart -pix_fmt yuv420p "${outputPath}" -y`;
        
        console.log(`Running FFMPEG command: ${ffmpegCmd}`);
        
        // Execute the command
        const { stdout, stderr } = await execAsync(ffmpegCmd);
        
        // Check if output file exists
        if (!fs.existsSync(outputPath)) {
            throw new Error('FFMPEG failed to create output file');
        }
        
        // Verify file size after first pass
        const firstPassInfo = await getVideoInfo(outputPath);
        const firstPassSize = firstPassInfo.size;
        
        console.log(`First pass result: ${formatSize(firstPassSize)}`);
        
        // If still too large (>30MB), do a second pass with more aggressive settings
        if (firstPassSize > 30 * 1024 * 1024) {
            console.log(`Output still too large (${formatSize(firstPassSize)}), performing second pass`);
            
            // More aggressive second pass
            const secondPassCrf = crf + 4; // Much more aggressive quality reduction
            const secondPassHeight = maxHeight > 360 ? 360 : 240; // Further reduce resolution
            const secondPassWidth = Math.floor((width / height) * secondPassHeight);
            
            // Temporary second pass output
            const secondPassOutput = outputPath.replace('.mp4', '_pass2.mp4');
            
            const secondPassCmd = `ffmpeg -i "${outputPath}" -vf "scale=${secondPassWidth}:${secondPassHeight},format=yuv420p" ` +
                `-c:v libx264 -profile:v baseline -level 3.0 ` +
                `-preset slower -crf ${secondPassCrf} ` +
                `-c:a aac -b:a 48k -ar 44100 -ac 1 ` + // Even lower audio quality
                `-movflags +faststart -pix_fmt yuv420p "${secondPassOutput}" -y`;
            
            console.log(`Running second pass FFMPEG command: ${secondPassCmd}`);
            
            await execAsync(secondPassCmd);
            
            // Check if second pass output exists and replace original output
            if (fs.existsSync(secondPassOutput)) {
                fs.unlinkSync(outputPath); // Remove first pass output
                fs.renameSync(secondPassOutput, outputPath); // Rename second pass to final output
                console.log(`Second pass complete, replaced output with smaller file`);
            }
        }
        
        // Get final optimized video info
        const optimizedInfo = await getVideoInfo(outputPath);
        console.log('Optimized video info:', optimizedInfo);
        
        // Show file size reduction
        const originalSize = videoInfo.size;
        const optimizedSize = optimizedInfo.size;
        const percentReduction = ((originalSize - optimizedSize) / originalSize * 100).toFixed(2);
        console.log(`File size reduction: ${formatSize(originalSize)} → ${formatSize(optimizedSize)} (${percentReduction}% reduction)`);
        
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
