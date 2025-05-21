import config from '../../Config.js';

// Use environment variable for API key instead of hardcoding
const API_KEY = config.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;

/**
 * Generate a chat response using Google Gemini API
 * @param {Array} messages - Array of chat messages (role/content)
 * @param {Object} options - Generation options (temperature, etc.)
 * @returns {Promise<Object>} - Gemini API response object
 */
export async function generateGeminiChatResponse(messages, options = {}) {
    try {
        const generationConfig = {
            temperature: options.temperature ?? 0.7,
            topP: options.top_p ?? 0.95,
            topK: options.top_k ?? 40,
            maxOutputTokens: options.max_completion_tokens ?? 1000,
            responseMimeType: 'text/plain',
        };

        // Convert messages to Gemini format
        const contents = messages.map(msg => ({
            role: msg.role === 'system' ? 'user' : msg.role, // Gemini doesn't support 'system', treat as 'user'
            parts: [{ text: msg.content }]
        }));

        const data = {
            generationConfig,
            contents,
        };

        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${API_KEY}`;
        const fetchOptions = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data)
        };

        const response = await fetch(url, fetchOptions);
        const result = await response.json();

        if (result.error) {
            console.error("Gemini API Error:", result.error);
            throw new Error(result.error.message || "Gemini API error");
        }

        return result;
    } catch (error) {
        console.error('Error generating Gemini chat response:', error);
        throw error;
    }
}

/**
 * Filter out thinking part from model responses (kept for compatibility)
 * @param {string} text
 * @returns {string}
 */
export function filterThinkingPart(text) {
    if (!text) return "";
    return text
        .replace(/<think>[\s\S]*?<\/think>/g, "")
        .replace(/<think>[\s\S]*$/, "")
        .replace(/^<think>.*$/gm, "")
        .replace(/\s*<think>\s+[\s\S]*?\s+<\/think>\s*/g, " ")
        .replace(/\s*<\/think>\s*$/, "")
        .replace(/\s{2,}/g, " ")
        .trim();
}
