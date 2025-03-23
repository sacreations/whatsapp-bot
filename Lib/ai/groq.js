import { v4 as uuidv4 } from 'uuid';
import config from '../../Config.js';
import apiKeyRotation from './apiKeyRotation.js';
import responseCache from './responseCache.js';
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
 * Filter out thinking part from model responses
 * @param {string} text - The model's response text
 * @returns {string} - Filtered text without thinking part
 */
function filterThinkingPart(text) {
    if (!text) return "";
    
    // Remove content between <think> and </think> tags
    const filteredText = text.replace(/<think>[\s\S]*?<\/think>/g, "");
    
    // Also handle other common thinking patterns
    return filteredText
        .replace(/^<think>[\s\S]*?<\/think>\s*/i, "") // Remove at start of message
        .replace(/\n*<think>[\s\S]*?<\/think>\s*/gi, "") // Remove anywhere with newlines
        .trim();
}

// Function to get completion from Groq API with caching and key rotation
export async function getGroqCompletion(messages, options = {}) {
    try {
        // Generate a cache key based on the messages
        const cacheQuery = messages.map(m => `${m.role}: ${m.content}`).join('\n');
        const cacheOptions = {
            model: options.model || config.AI_MODEL,
            temperature: options.temperature || config.AI_TEMPERATURE
        };
        
        // Check if a cached response exists
        const cachedResponse = responseCache.getCachedResponse(cacheQuery, cacheOptions);
        if (cachedResponse) {
            console.log('Using cached AI response');
            
            // Update AI stats if available
            if (global.aiStats) {
                global.aiStats.cacheHits = (global.aiStats.cacheHits || 0) + 1;
            }
            
            return cachedResponse;
        }
        
        // If no cached response, proceed with API call
        
        // Get API key from rotation system
        let apiKey = apiKeyRotation.getNextKey('groq');
        
        // Fall back to config key if no rotated key available
        if (!apiKey) {
            console.log('No rotated API key available, using config key');
            apiKey = config.GROQ_API_KEY;
        }
        
        // Check if we have a valid API key
        if (!apiKey) {
            throw new Error('No Groq API key available');
        }
        
        // Prepare request options
        const defaultModel = config.AI_MODEL || 'llama-3.3-70b-versatile';
        const requestOptions = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: options.model || defaultModel,
                messages: messages,
                temperature: options.temperature || parseFloat(config.AI_TEMPERATURE || 0.7),
                max_tokens: options.max_completion_tokens || 2048,
                top_p: options.top_p || 1,
                stream: false
            })
        };
        
        // Generate a unique request ID for logging
        const requestId = uuidv4().substring(0, 8);
        console.log(`[${requestId}] Sending request to Groq API with model: ${requestOptions.body.model}`);
        
        // Call Groq API
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', requestOptions);
        
        // Handle errors
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`[${requestId}] Groq API error (${response.status}):`, errorText);
            throw new Error(`Groq API error: ${response.status} - ${errorText}`);
        }
        
        // Parse response
        const data = await response.json();
        
        // Filter thinking parts from the response if present
        if (data.choices && data.choices.length > 0 && data.choices[0].message) {
            const originalContent = data.choices[0].message.content;
            data.choices[0].message.content = filterThinkingPart(originalContent);
        }
        
        // Update AI stats if available
        if (global.aiStats) {
            global.aiStats.messagesProcessed = (global.aiStats.messagesProcessed || 0) + 1;
            global.aiStats.cacheMisses = (global.aiStats.cacheMisses || 0) + 1;
        }
        
        // Cache the response
        responseCache.cacheResponse(cacheQuery, data, cacheOptions);
        
        return data;
    } catch (error) {
        console.error('Error getting completion from Groq:', error);
        throw error;
    }
}
