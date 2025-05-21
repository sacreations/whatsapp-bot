import { generateGeminiChatResponse } from '../groq.js';
import { createQueryClassificationPrompt, createCommandMatchPrompt } from '../prompts.js';
import { extractUrl } from '../utils/aiUtils.js';

/**
 * Classify the query type using AI
 * 
 * @param {string} query - The user's query to classify
 * @returns {Promise<string>} - Query type (wikipedia, wallpaper, realtime, admin, botinfo, webpage, general)
 */
export async function classifyQueryType(query) {
    try {
        // Create a classification prompt
        const classificationPrompt = createQueryClassificationPrompt(query);
        
        // Get AI classification response
        const response = await generateGeminiChatResponse(classificationPrompt, {
            temperature: 0.1, // Lower temperature for more consistent classification
            max_completion_tokens: 10 // We just need a single word
        });
        
        // Extract the classification result
        const result = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
        
        // Check which type it matches and return it
        const validTypes = ['wikipedia', 'wallpaper', 'realtime', 'admin', 'botinfo', 'webpage', 'general'];
        for (const type of validTypes) {
            if (result.includes(type)) {
                return type;
            }
        }
        
        // Check for URL in message as a fallback for webpage detection
        if (extractUrl(query)) {
            return 'webpage';
        }
        
        // Default to general if no match found
        return 'general';
    } catch (error) {
        console.error('Error classifying query type:', error);
        // Default to general in case of error
        return 'general';
    }
}

/**
 * Check if a user query should be handled by a bot command
 * 
 * @param {string} query - The user's message
 * @returns {Promise<string>} - The matching command or 'none'
 */
export async function checkForCommandMatch(query) {
    // Quick check to skip command matching for obvious knowledge-based questions
    const lowerQuery = query.toLowerCase();
    
    // Skip command matching for programming/code-related queries
    if (lowerQuery.includes('code') || 
        lowerQuery.includes('program') || 
        lowerQuery.includes('api') || 
        lowerQuery.includes('function') ||
        lowerQuery.includes('script') ||
        lowerQuery.includes('develop') ||
        lowerQuery.includes('tutorial') ||
        lowerQuery.includes('write') ||
        lowerQuery.includes('create')) {
        return 'none';
    }
    
    try {
        const commandMatchPrompt = createCommandMatchPrompt(query);
        
        const response = await generateGeminiChatResponse(commandMatchPrompt, {
            temperature: 0.1,
            max_completion_tokens: 10
        });
        
        const result = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "none";
        
        // List of valid command matches
        const validCommands = ['time', 'date', 'wallpaper', 'yt', 'tiktok', 'ig', 'fb', 'menu'];
        
        // Check if the result is a valid command
        if (validCommands.includes(result)) {
            return result;
        }
        
        return 'none';
    } catch (error) {
        console.error('Error checking for command match:', error);
        return 'none';
    }
}

/**
 * Generate a response that suggests using a bot command
 * 
 * @param {string} userMessage - The user's original message
 * @param {string} command - The matching command
 * @returns {Promise<string>} - A response suggesting the command
 */
export async function generateCommandSuggestion(userMessage, command, config) {
    // For common commands, provide direct suggestions
    switch (command) {
        case 'time':
            return `To check the current time, please use the command: ${config.PREFIX}time`;
            
        case 'date':
            return `To check today's date, please use the command: ${config.PREFIX}date`;
            
        case 'wallpaper':
            // Extract the wallpaper subject from the query
            const wallpaperSubject = extractSearchTerm(userMessage, 'wallpaper');
            return `For wallpapers, please use: ${config.PREFIX}wallpaper ${wallpaperSubject}\n\nThis will send actual wallpaper images to your chat.`;
            
        case 'menu':
            return `To see all available commands, please use: ${config.PREFIX}menu`;
            
        case 'yt':
        case 'tiktok':
        case 'ig':
        case 'fb':
            return `To download content, please use the ${config.PREFIX}${command} command followed by the URL.\n\nExample: ${config.PREFIX}${command} [URL]`;
            
        default:
            return `You might want to try using the ${config.PREFIX}${command} command, or type ${config.PREFIX}menu to see all available commands.`;
    }
}

/**
 * Detects if a message is a simple factual question that should be searched immediately
 * 
 * This helps bypass classification for obvious fact-based questions
 */
export function isFastFactQuestion(text) {
    const lowerText = text.toLowerCase().trim();
    
    // Exclude programming/code requests from fast fact patterns
    if (lowerText.includes('code') || 
        lowerText.includes('program') || 
        lowerText.includes('api') || 
        lowerText.includes('function') ||
        lowerText.includes('script') ||
        lowerText.includes('develop')) {
        return false;
    }
    
    // Patterns for factual questions
    const factPatterns = [
        /^who is /, /^who was /, /^who are /,
        /^what is /, /^what are /, /^what was /,
        /^when is /, /^when was /, /^when are /,
        /^where is /, /^where was /, /^where are /,
        /^which is /, /^which was /, /^which are /,
        /^how many /, /^how much /, /^how old /,
        /^current .* president/, /^president of /,
        /^capital of /
    ];
    
    // Check if any pattern matches
    return factPatterns.some(pattern => pattern.test(lowerText));
}

// Helper used by generateCommandSuggestion
function extractSearchTerm(text, queryType) {
    // Extract what comes after common phrases based on the query type
    let searchTerm = text;
    
    // Remove question marks and convert to lowercase
    searchTerm = searchTerm.replace(/\?/g, '').trim();
    
    // If short, just use the whole text
    if (searchTerm.length < 30) {
        return searchTerm;
    }
    
    // Otherwise, try to intelligently extract the main subject
    const commonPhrases = [
        'tell me about', 'show me', 'find', 'search for', 'look up', 
        'who is', 'what is', 'where is', 'when was', 'explain',
        'information on', 'info about', 'facts about', 'details about',
        'images of', 'pictures of', 'wallpaper of', 'wallpapers of'
    ];
    
    for (const phrase of commonPhrases) {
        if (searchTerm.toLowerCase().includes(phrase)) {
            const parts = searchTerm.toLowerCase().split(phrase);
            if (parts.length > 1 && parts[1].trim()) {
                return parts[1].trim();
            }
        }
    }
    
    return searchTerm;
}
