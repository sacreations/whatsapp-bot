import axios from 'axios';

// RapidAPI configuration for YouTube downloads
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

/**
 * Extract YouTube video ID from different URL formats
 * @param {string} url - The YouTube URL
 * @returns {string} - The video ID
 */
function extractVideoId(url) {
    // Handle various YouTube URL formats
    let videoId = null;
    
    // Pattern 1: Regular YouTube URL (youtube.com/watch?v=VIDEO_ID)
    const regularMatch = url.match(/(?:youtube\.com\/watch\?v=|youtu.be\/|youtube\.com\/embed\/)([^&?/]+)/);
    if (regularMatch && regularMatch[1]) {
        videoId = regularMatch[1];
    }
    
    // Pattern 2: YouTube shorts URL (youtube.com/shorts/VIDEO_ID)
    const shortsMatch = url.match(/youtube\.com\/shorts\/([^&?/]+)/);
    if (shortsMatch && shortsMatch[1]) {
        videoId = shortsMatch[1];
    }
    
    // If no match found, try a more generic approach
    if (!videoId) {
        const fallbackMatch = url.match(/[?&]v=([^&]+)/);
        if (fallbackMatch && fallbackMatch[1]) {
            videoId = fallbackMatch[1];
        }
    }
    
    if (!videoId) {
        throw new Error('Could not extract video ID from URL: ' + url);
    }
    
    console.log(`Extracted YouTube video ID: ${videoId} from URL: ${url}`);
    return videoId;
}

// Function to get progressId for downloading YouTube video
const getDownloadId = async (videoUrl) => {
  const videoID = extractVideoId(videoUrl);
  if (!videoID) {
    throw new Error('Invalid YouTube URL');
  }
  
  const options = {
    method: 'GET',
    url: 'https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/download',
    params: {
      format: '720',
      id: `${videoID}`,
      audioQuality: '128',
      addInfo: 'false'
    },
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
    }
  };

  try {
    const response = await axios.request(options);
    if (response.data && response.data.success) {
      return response.data.progressId;
    }
    throw new Error("Download ID not found in response");
  } catch (error) {
    console.error("Error getting download ID:", error.message);
    throw error;
  }
};

// Function to download YouTube video
const downloadYouTubeVideo = async (videoUrl) => {
  const progressId = await getDownloadId(videoUrl); 

  const options = {
    method: 'GET',
    url: 'https://youtube-mp4-mp3-downloader.p.rapidapi.com/api/v1/progress',
    params: {
      id: `${progressId}`, 
    },
    headers: {
      'x-rapidapi-key': RAPIDAPI_KEY,
      'x-rapidapi-host': 'youtube-mp4-mp3-downloader.p.rapidapi.com'
    }
  };

  try {
    let response = await axios.request(options);
    let attempts = 0;
    const maxAttempts = 60; // Maximum waiting time: 60 seconds
    
    while (response.data.status !== "Finished" && attempts < maxAttempts) {
      console.log("Waiting for download to finish...");
      await new Promise(resolve => setTimeout(resolve, 1000));
      response = await axios.request(options);
      attempts++;
    }
    
    if (attempts >= maxAttempts) {
      throw new Error("Download timed out after 60 seconds");
    }

    if (!response.data || !response.data.downloadUrl) {
      throw new Error("Download URL not found in response");
    }
    
    console.log("Download completed successfully!");
    // Make sure we return a string URL, not an object
    const downloadUrl = response.data.downloadUrl;
    
    if (typeof downloadUrl !== 'string') {
      throw new Error("Invalid download URL format received");
    }
    
    return downloadUrl;
  } catch (error) {
    console.error("Error downloading video:", error.message);
    throw error;
  }
};

export { getDownloadId, downloadYouTubeVideo };