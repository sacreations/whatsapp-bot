import axios from 'axios';

/**
 * Perform a Google search and return results
 * @param {string} query - The search query
 * @returns {Promise<Object>} - Search results
 */
export async function googleSearch(query) {
    try {
        // Try Google search first
        console.log(`Performing Google search for: ${query}`);
        const apiUrl = `https://delirius-apiofc.vercel.app/search/googlesearch?query=${encodeURIComponent(query)}`;

        // Use axios for better error handling and timeout
        const response = await axios.get(apiUrl, { timeout: 15000 });

        if (!response.data || response.data.status !== true || !Array.isArray(response.data.data)) {
            console.log(`Google search failed or returned no results. Falling back to Bing search.`);
            return await bingSearch(query); // Fall back to Bing search
        }

        // Track AI search stats if global container exists
        if (global.aiStats) {
            global.aiStats.searchesPerformed = (global.aiStats.searchesPerformed || 0) + 1;
        }

        // Normalize results to expected format
        const results = response.data.data.map(item => ({
            title: item.title || '',
            description: item.description || '',
            link: item.url || ''
        }));

        return {
            type: 'google',
            searchEngine: 'Google',
            query: query,
            results
        };
    } catch (error) {
        console.error(`Error in Google search: ${error.message}. Falling back to Bing search.`);
        // If Google search fails, fall back to Bing search
        return await bingSearch(query);
    }
}

/**
 * Perform a Bing search as fallback when Google search fails
 * @param {string} query - The search query
 * @returns {Promise<Object>} - Search results
 */
async function bingSearch(query) {
    try {
        console.log(`Performing Bing search for: ${query}`);
        const apiUrl = `https://delirius-apiofc.vercel.app/search/bingsearch?query=${encodeURIComponent(query)}`;
        
        const response = await fetch(apiUrl, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        if (!response.ok) {
            throw new Error(`Bing search API response not OK: ${response.status}`);
        }
        
        const data = await response.json();
        
        // Track that we're using Bing as fallback in stats
        if (global.aiStats) {
            global.aiStats.bingSearchesFallback = (global.aiStats.bingSearchesFallback || 0) + 1;
        }
        
        return {
            searchEngine: 'Bing',
            query: query,
            results: data.results || []
        };
    } catch (error) {
        console.error(`Error in Bing search: ${error.message}`);
        // If both Google and Bing search fail, return empty results
        return {
            searchEngine: 'Failed',
            query: query,
            results: [],
            error: error.message
        };
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
        console.log(`Searching for wallpapers: ${encodedQuery}`);
        
        // Make request to the Wallpaper API
        const response = await axios.get(
            `https://delirius-apiofc.vercel.app/search/wallpapers?q=${encodedQuery}`,
            { timeout: 15000 } // Add 15s timeout to prevent hanging
        );
        
        // Check if the response is successful and contains data
        if (response.data && response.data.status === true && 
            response.data.data && Array.isArray(response.data.data)) {
            
            // Log success details
            console.log(`Wallpaper search successful. Found ${response.data.data.length} results.`);
            
            // Verify image URLs
            const validResults = response.data.data.filter(item => 
                item && item.image && typeof item.image === 'string' && 
                item.image.startsWith('http')
            );
            
            console.log(`${validResults.length} wallpapers have valid image URLs`);
            
            // Return a properly structured result
            return { 
                type: 'wallpaper', 
                results: validResults,
                query: query
            };
        } else {
            // Log the issue with the response
            if (!response.data) {
                console.error('Empty response from wallpaper API');
            } else if (!response.data.status) {
                console.error('API returned error status:', response.data);
            } else if (!response.data.data || !Array.isArray(response.data.data)) {
                console.error('Invalid data format in API response:', response.data);
            }
            
            // Return empty results
            return { type: 'wallpaper', results: [], query: query };
        }
    } catch (error) {
        console.error('Error performing wallpaper search:', error.message);
        
        // Return empty results with error info
        return { 
            type: 'wallpaper', 
            results: [], 
            query: query,
            error: error.message 
        };
    }
}

/**
 * Extract HTML content from a URL
 * @param {string} url - The URL to extract HTML from
 * @returns {Promise<Object>} - Object with extraction results
 */
export async function extractHtml(url) {
    try {
        // Encode the URL for API request
        const encodedUrl = encodeURIComponent(url);
        
        // Make request to the HTML extraction API
        const response = await axios.get(
            `https://delirius-apiofc.vercel.app/tools/htmlextract?url=${encodedUrl}`
        );
        
        // Check if the response is successful
        if (response.data && response.data.status === true) {
            return { type: 'html', result: response.data.html, url };
        } else {
            console.error('Error in HTML extraction response:', response.data);
            return { type: 'html', result: null, url };
        }
    } catch (error) {
        console.error('Error extracting HTML:', error);
        return { type: 'html', result: null, url };
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
    
    if (!results && !searchData.result) {
        return "No results found.";
    }
    
    // Format based on the type of search result
    switch (type) {
        case 'google':
            return formatGoogleResults(results.slice(0, maxResults));
        case 'wikipedia':
            return formatWikipediaResults(results.slice(0, maxResults));
        case 'wallpaper':
            return formatWallpaperResults(results.slice(0, maxResults));
        case 'html':
            return formatHtmlResults(searchData);
        default:
            return "No results found.";
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
    if (!results || results.length === 0) {
        return "I couldn't find any wallpapers matching your request.";
    }
    
    let formattedText = "I found these wallpapers for you:\n\n";
    
    results.forEach((result, index) => {
        const title = result.title || `Wallpaper ${index + 1}`;
        formattedText += `${index + 1}. ${title}\n`;
        
        if (result.image) {
            formattedText += `   Image URL: ${result.image}\n`;
        }
        
        formattedText += '\n';
    });
    
    formattedText += "I'll send these images directly to this chat.";
    
    return formattedText;
}

/**
 * Format HTML extraction results
 */
function formatHtmlResults(result) {
    const { url, result: html } = result;
    
    if (!html) {
        return `Failed to extract HTML from ${url}`;
    }
    
    // Get a small preview of the HTML (first 500 characters)
    const htmlPreview = html.substring(0, 500) + (html.length > 500 ? '...' : '');
    
    // Count various elements in the HTML to provide a summary
    const elementCounts = {
        div: countOccurrences(html, '<div'),
        p: countOccurrences(html, '<p'),
        a: countOccurrences(html, '<a'),
        img: countOccurrences(html, '<img'),
        script: countOccurrences(html, '<script'),
        style: countOccurrences(html, '<style'),
        meta: countOccurrences(html, '<meta'),
    };
    
    // Extract title if present
    const titleMatch = html.match(/<title[^>]*>(.*?)<\/title>/i);
    const title = titleMatch ? titleMatch[1] : 'Unknown Title';
    
    // Extract meta description if present
    const descMatch = html.match(/<meta[^>]*name=['"]description['"][^>]*content=['"]([^'"]*)['"]/i) || 
                       html.match(/<meta[^>]*content=['"]([^'"]*)['""][^>]*name=['"]description['"]/i);
    const description = descMatch ? descMatch[1] : 'No description found';
    
    return `HTML extracted from: ${url}\n\n` +
           `Title: ${title}\n` +
           `Description: ${description}\n\n` +
           `Page structure summary:\n` +
           `- ${elementCounts.div} div elements\n` +
           `- ${elementCounts.p} paragraph elements\n` +
           `- ${elementCounts.a} links\n` +
           `- ${elementCounts.img} images\n` +
           `- ${elementCounts.script} scripts\n` +
           `- ${elementCounts.style} style blocks\n` +
           `- ${elementCounts.meta} meta tags\n\n` +
           `HTML preview:\n${htmlPreview}`;
}

/**
 * Count occurrences of a substring in a string
 */
function countOccurrences(str, subStr) {
    return (str.match(new RegExp(subStr, 'gi')) || []).length;
}
