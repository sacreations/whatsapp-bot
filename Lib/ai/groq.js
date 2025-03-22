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
 * Filter out thinking part from model responses
 * @param {string} text - The model's response text
 * @returns {string} - Filtered text without thinking part
 */
function filterThinkingPart(text) {
    if (!text) return "";
    
    // Replace <think>...</think> blocks with empty string
    return text.replace(/<think>[\s\S]*?<\/think>/g, "").trim();
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
        
        // Get model from config, default to LLaMA if not set
        const model = config.AI_MODEL || "llama-3.3-70b-versatile";
        console.log(`Using AI model: ${model}`);
        
        const defaultOptions = {
            model: model,
            temperature: parseFloat(config.AI_TEMPERATURE || "0.7"),
            max_completion_tokens: 1024,
            top_p: 1,
            stream: false
        };
        
        // Merge with custom options
        const finalOptions = { ...defaultOptions, ...options };
        
        // Make the API call
        const response = await client.chat.completions.create({
            messages,
            ...finalOptions
        });
        
        // If using the deepseek model, filter out the thinking part from responses
        if (model === "deepseek-r1-distill-qwen-32b" && response.choices && response.choices.length > 0) {
            for (const choice of response.choices) {
                if (choice.message && choice.message.content) {
                    choice.message.content = filterThinkingPart(choice.message.content);
                }
            }
        }
        
        return response;
    } catch (error) {
        console.error('Error calling Groq API:', error);
        throw error;
    }
}
