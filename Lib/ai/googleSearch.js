import axios from 'axios';

/**
 * Perform a Google search using the provided API
 * @param {string} query - The search query
 * @returns {Promise<Array>} - Array of search results
 */
export async function googleSearch(query) {
    try {
        // Encode the query for URL
        const encodedQuery = encodeURIComponent(query);
        
        // Make request to the search API
        const response = await axios.get(`https://delirius-apiofc.vercel.app/search/googlesearch?query=${encodedQuery}`);
        
        // Check if the response is successful
        if (response.data && response.data.status === true) {
            return { type: 'google', results: response.data.data };
        } else {
            console.error('Error in Google search response:', response.data);
            return { type: 'google', results: [] };
        }
    } catch (error) {
        console.error('Error performing Google search:', error);
        return { type: 'google', results: [] };
    }
}

/**
 * Perform a Wikipedia search using the provided API
 * @param {string} query - The search query
 * @param {number} limit - Maximum number of results
 * @param {string} language - Language code (en, es, etc.)
 * @returns {Promise<Object>} - Object with search results
 */
export async function wikipediaSearch(query, limit = 5, language = 'en') {
    try {
        // Encode the query for URL
        const encodedQuery = encodeURIComponent(query);
        
        // Make request to the Wikipedia API
        const response = await axios.get(
            `https://delirius-apiofc.vercel.app/search/wikipedia?query=${encodedQuery}&limit=${limit}&page=1&language=${language}`
        );
        
        // Check if the response is successful
        if (response.data && response.data.status === true) {
            return { type: 'wikipedia', results: response.data.data };
        } else {
            console.error('Error in Wikipedia search response:', response.data);
            return { type: 'wikipedia', results: [] };
        }
    } catch (error) {
        console.error('Error performing Wikipedia search:', error);
        return { type: 'wikipedia', results: [] };
    }
}

/**
 * Search for wallpapers using the provided API
 * @param {string} query - The search query
 * @returns {Promise<Object>} - Object with search results
 */
export async function wallpaperSearch(query) {
    try {
        // Encode the query for URL
        const encodedQuery = encodeURIComponent(query);
        
        // Make request to the Wallpaper API
        const response = await axios.get(
            `https://delirius-apiofc.vercel.app/search/wallpapers?q=${encodedQuery}`
        );
        
        // Check if the response is successful
        if (response.data && response.data.status === true) {
            return { type: 'wallpaper', results: response.data.data };
        } else {
            console.error('Error in wallpaper search response:', response.data);
            return { type: 'wallpaper', results: [] };
        }
    } catch (error) {
        console.error('Error performing wallpaper search:', error);
        return { type: 'wallpaper', results: [] };
    }
}

/**
 * Format search results into a readable text summary based on result type
 * @param {Object} searchData - The search results with type information
 * @param {number} maxResults - Maximum number of results to include
 * @returns {string} - Formatted text summary
 */
export function formatSearchResults(searchData, maxResults = 3) {
    const { type, results } = searchData;
    
    if (!results || results.length === 0) {
        return "No search results found.";
    }
    
    // Take only the top results to avoid very long messages
    const limitedResults = results.slice(0, maxResults);
    
    // Format based on the type of search result
    switch (type) {
        case 'google':
            return formatGoogleResults(limitedResults);
        case 'wikipedia':
            return formatWikipediaResults(limitedResults);
        case 'wallpaper':
            return formatWallpaperResults(limitedResults);
        default:
            return "No search results found.";
    }
}

/**
 * Format Google search results
 */
function formatGoogleResults(results) {
    let formattedText = "Here's what I found from a search:\n\n";
    
    results.forEach((result, index) => {
        formattedText += `${index + 1}. ${result.title}\n`;
        formattedText += `   ${result.description}\n\n`;
    });
    
    return formattedText;
}

/**
 * Format Wikipedia search results
 */
function formatWikipediaResults(results) {
    let formattedText = "Here's information from Wikipedia:\n\n";
    
    results.forEach((result, index) => {
        formattedText += `${index + 1}. ${result.title}\n`;
        formattedText += `   ${result.description}\n`;
        if (result.published) {
            formattedText += `   Published: ${result.published}\n`;
        }
        formattedText += `   Link: ${result.link}\n\n`;
    });
    
    return formattedText;
}

/**
 * Format Wallpaper search results
 */
function formatWallpaperResults(results) {
    let formattedText = "I found these wallpapers for you:\n\n";
    
    results.forEach((result, index) => {
        formattedText += `${index + 1}. ${result.title}\n`;
        formattedText += `   Direct link: ${result.image}\n\n`;
    });
    
    formattedText += "I'll send these images to you right after this message.";
    
    return formattedText;
}
