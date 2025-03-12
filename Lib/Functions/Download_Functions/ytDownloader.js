import axios from 'axios';
import fs from 'fs';
import path from 'path';

// RapidAPI configuration for YouTube downloads
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY || 'ae868540e2mshdad303e6eb2f586p10c49ejsnfc99a77044eb';
const RAPIDAPI_HOST = 'ytstream-download-youtube-videos.p.rapidapi.com';
const RAPIDAPI_URL = 'https://ytstream-download-youtube-videos.p.rapidapi.com/dl';

/**
 * Extract YouTube video ID from different URL formats
 */
function extractVideoId(url) {
  const patterns = [
    /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/i,
    /^([^"&?\/\s]{11})$/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      return match[1];
    }
  }
  
  return null;
}

/**
 * Download YouTube video using RapidAPI
 * @param {string} url - YouTube URL
 * @param {string} outputPath - Output file path
 * @param {boolean} isAudio - Whether to download audio only
 * @returns {Promise<object>} - Downloaded file info
 */
export const downloadYoutubeVideo = async (url, outputPath, quality = '720p') => {
  try {
    console.log(`Downloading video from: ${url}`);
    
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID');
    }
    
    console.log(`Fetching video data for ID: ${videoId}`);
    
    // Fetch video information from RapidAPI
    const response = await axios({
      method: 'GET',
      url: RAPIDAPI_URL,
      params: { id: videoId },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });
    
    // Check if the response is valid
    if (!response.data || response.data.status !== 'OK') {
      throw new Error('Invalid response from YouTube API');
    }
    
    console.log('Successfully fetched video data from API');
    
    // Get available formats
    const { formats, adaptiveFormats } = response.data;
    
    // Select the best format based on quality preference
    let downloadUrl;
    
    // First try to find the exact quality requested
    if (adaptiveFormats) {
      const videoFormats = adaptiveFormats.filter(
        f => f.mimeType.includes('video/mp4') && f.qualityLabel === quality
      );
      
      if (videoFormats.length > 0) {
        downloadUrl = videoFormats[0].url;
      }
    }
    
    // If exact quality not found, try to find the best available MP4
    if (!downloadUrl && adaptiveFormats) {
      // Filter for MP4 video formats and sort by resolution
      const videoFormats = adaptiveFormats
        .filter(f => f.mimeType.includes('video/mp4') && f.qualityLabel)
        .sort((a, b) => {
          // Extract height from qualityLabel (e.g. "720p" -> 720)
          const heightA = parseInt(a.qualityLabel) || 0;
          const heightB = parseInt(b.qualityLabel) || 0;
          return heightB - heightA;  // Sort in descending order
        });
      
      if (videoFormats.length > 0) {
        downloadUrl = videoFormats[0].url;
        console.log(`Selected video quality: ${videoFormats[0].qualityLabel}`);
      }
    }
    
    // If still no URL, try formats array
    if (!downloadUrl && formats && formats.length > 0) {
      downloadUrl = formats[0].url;
      console.log('Using combined audio/video format');
    }
    
    // If still no URL found, throw error
    if (!downloadUrl) {
      throw new Error('No suitable download URL found');
    }
    
    console.log('Downloading video content...');
    
    // Download the video
    const videoResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    });
    
    // Save to file
    const writer = fs.createWriteStream(outputPath);
    videoResponse.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Download completed: ${outputPath}`);
        resolve({
          filePath: outputPath,
          title: response.data.title || 'YouTube Video',
          method: 'rapidapi'
        });
      });
      
      writer.on('error', (error) => {
        console.error('Error writing file:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('YouTube video download error:', error);
    throw new Error(`Failed to download video: ${error.message}`);
  }
};

/**
 * Download YouTube audio using RapidAPI
 * @param {string} url - YouTube URL
 * @param {string} outputPath - Output file path
 * @returns {Promise<object>} - Downloaded file info
 */
export const downloadYoutubeAudio = async (url, outputPath) => {
  try {
    console.log(`Downloading audio from: ${url}`);
    
    // Extract video ID from URL
    const videoId = extractVideoId(url);
    if (!videoId) {
      throw new Error('Could not extract YouTube video ID');
    }
    
    // Fetch video information from RapidAPI
    const response = await axios({
      method: 'GET',
      url: RAPIDAPI_URL,
      params: { id: videoId },
      headers: {
        'X-RapidAPI-Key': RAPIDAPI_KEY,
        'X-RapidAPI-Host': RAPIDAPI_HOST
      }
    });
    
    // Check if the response is valid
    if (!response.data || response.data.status !== 'OK') {
      throw new Error('Invalid response from YouTube API');
    }
    
    // Find the best audio format
    const { adaptiveFormats } = response.data;
    
    // Select the audio format
    let downloadUrl;
    
    if (adaptiveFormats) {
      // Filter for audio formats and sort by bitrate
      const audioFormats = adaptiveFormats
        .filter(f => f.mimeType && f.mimeType.includes('audio'))
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));
      
      if (audioFormats.length > 0) {
        downloadUrl = audioFormats[0].url;
        console.log(`Selected audio format with bitrate: ${audioFormats[0].bitrate}`);
      }
    }
    
    // If no audio format found, throw error
    if (!downloadUrl) {
      throw new Error('No suitable audio format found');
    }
    
    console.log('Downloading audio content...');
    
    // Download the audio
    const audioResponse = await axios({
      method: 'GET',
      url: downloadUrl,
      responseType: 'stream'
    });
    
    // Save to file
    const writer = fs.createWriteStream(outputPath);
    audioResponse.data.pipe(writer);
    
    return new Promise((resolve, reject) => {
      writer.on('finish', () => {
        console.log(`Audio download completed: ${outputPath}`);
        resolve({
          filePath: outputPath,
          title: response.data.title || 'YouTube Audio',
          method: 'rapidapi'
        });
      });
      
      writer.on('error', (error) => {
        console.error('Error writing audio file:', error);
        reject(error);
      });
    });
  } catch (error) {
    console.error('YouTube audio download error:', error);
    throw new Error(`Failed to download audio: ${error.message}`);
  }
};

/**
 * Search for YouTube videos
 * @param {string} query - Search query
 * @param {number} limit - Number of results to return
 * @returns {Promise<Array>} - Array of search results
 */
export const searchYouTube = async (query, limit = 1) => {
  try {
    // Direct URL search if URL is provided
    if (query.match(/youtu\.?be/)) {
      return [{ url: query }];
    }
    
    // Using a simple search API for YouTube
    const searchUrl = `https://yt-api-omega.vercel.app/search?query=${encodeURIComponent(query)}&limit=${limit}`;
    const response = await axios.get(searchUrl);
    
    if (!response.data || !response.data.items) {
      throw new Error('Invalid search response');
    }
    
    return response.data.items.map(item => ({
      title: item.title,
      url: item.url,
      thumbnail: item.thumbnail,
      duration: item.duration,
      views: item.views,
      uploadedAt: item.uploadedAt
    }));
  } catch (error) {
    console.error('YouTube search error:', error.message);
    throw new Error(`Failed to search YouTube videos: ${error.message}`);
  }
};
