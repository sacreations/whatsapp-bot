import config from '../../Config.js';
import Groq from 'groq-sdk';

/**
 * Initialize the Groq client with API key from config
 */
export function createGroqClient() {
    const apiKey = config.GROQ_API_KEY;
    
    if (!apiKey) {
        console.error('GROQ_API_KEY not found in config');
        return null;
    }
    
    return new Groq({ apiKey });
}

/**
 * Get a completion from Groq API
 * 
 * @param {Array} messages - Array of message objects with role and content
 * @param {Object} options - Additional options for the API call
 * @returns {Promise<Object>} The completion response
 */
export async function getGroqCompletion(messages, options = {}) {
    try {
        const client = createGroqClient();
        
        if (!client) {
            throw new Error('Failed to initialize Groq client');
        }
        
        const defaultOptions = {
            model: "llama-3.3-70b-versatile",
            temperature: 0.7,
            max_completion_tokens: 1024,
            top_p: 1,
            stream: false
        };
        
        const response = await client.chat.completions.create({
            messages,
            ...defaultOptions,
            ...options
        });
        
        return response;
    } catch (error) {
        console.error('Error calling Groq API:', error);
        throw error;
    }
}
