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
            return response.data.data;
        } else {
            console.error('Error in Google search response:', response.data);
            return [];
        }
    } catch (error) {
        console.error('Error performing Google search:', error);
        return [];
    }
}

/**
 * Format search results into a readable text summary
 * @param {Array} results - The search results from Google
 * @param {number} maxResults - Maximum number of results to include
 * @returns {string} - Formatted text summary
 */
export function formatSearchResults(results, maxResults = 3) {
    if (!results || results.length === 0) {
        return "No search results found.";
    }
    
    // Take only the top results to avoid very long messages
    const limitedResults = results.slice(0, maxResults);
    
    let formattedText = "Here's what I found from a search:\n\n";
    
    limitedResults.forEach((result, index) => {
        formattedText += `${index + 1}. ${result.title}\n`;
        formattedText += `   ${result.description}\n\n`;
    });
    
    return formattedText;
}
