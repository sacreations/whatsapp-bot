import axios from 'axios';

// RapidAPI configuration for YouTube downloads
const RAPIDAPI_KEY = process.env.RAPIDAPI_KEY;

// Function to get progressId for downloading YouTube video
const getDownloadId = async (videoUrl) => {
  // convert url to ID
  const getYouTubeVideoID = (videoUrl) => {
    const patterns = [
      /(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/)([a-zA-Z0-9_-]{11})/, // Covers most YouTube formats
      /(?:youtube\.com\/(?:shorts\/))([a-zA-Z0-9_-]{11})/,
      /(?:youtube\.com\/(?:.*?v=))([a-zA-Z0-9_-]{11})/,
      /(?:youtu\.be\/)([a-zA-Z0-9_-]{11})/,
    ];
  
    for (let pattern of patterns) {
      const match = videoUrl.match(pattern);
      if (match) {
        return match[1]; 
      }
    }
    return null; 
  };

  const videoID = getYouTubeVideoID(videoUrl);
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
const downloadYouTubeVideo = async () => {
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
    const response = await axios.request(options);

    while (response.data.status !== "Finished") {
      console.log("Waiting for download to finish...");
      await new Promise(resolve => setTimeout(resolve, 1000)); 
      const response = await axios.request(options);
    }
    if (!response.data || !response.data.downloadUrl) {
      throw new Error("Download URL not found in response");
    }
    console.log("Download completed successfully!");
    return response.downloadUrl;
  } catch (error) {
    console.error("Error downloading video:", error.message);
    throw error;
  }
};

export { getDownloadId, downloadYouTubeVideo };