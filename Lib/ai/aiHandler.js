import { getGroqCompletion } from './groq.js';
import { 
    createRegularPrompt, 
    createAdminContactPrompt, 
    createBotInfoPrompt, 
    createSearchEnhancedPrompt,
    createWikipediaPrompt,
    createWallpaperPrompt,
    createRealTimeClassificationPrompt
} from './prompts.js';
import { 
    googleSearch, 
    wikipediaSearch, 
    wallpaperSearch, 
    formatSearchResults 
} from './googleSearch.js';
import config from '../../Config.js';
import message from '../chat/messageHandler.js';

// Message history cache (very simple implementation)
const messageHistory = new Map();
const MAX_HISTORY_LENGTH = 5;  // Maximum number of previous exchanges to include

/**
 * Process a message with AI and get a response
 * 
 * @param {Object} m - The message object
 * @param {string} userText - The text message from the user
 * @param {Object} sock - The WhatsApp socket
 * @returns {Promise<string>} AI response text
 */
export async function processMessageWithAI(m, userText, sock) {
    try {
        const senderId = m.key.remoteJid;
        let promptMessages;
        let searchResults = null;
        
        // Check if this is a request to contact admin
        if (isAdminContactRequest(userText)) {
            promptMessages = createAdminContactPrompt(userText);
            
            // Forward the message to admin
            await forwardMessageToAdmin(m, userText, sock);
        }
        // Check if this is a request for bot information
        else if (isBotInfoRequest(userText)) {
            promptMessages = createBotInfoPrompt(userText);
        }
        // Check if this is a request for wallpapers or images
        else if (isWallpaperRequest(userText)) {
            // Perform wallpaper search
            console.log(`Detected wallpaper request: "${userText}"`);
            await message.react('🖼️', m, sock); // React with image emoji
            
            try {
                // Extract the search term
                const searchTerm = extractWallpaperSearchTerm(userText);
                searchResults = await wallpaperSearch(searchTerm);
                console.log(`Found ${searchResults.results.length} wallpapers`);
                
                // Create prompt with wallpaper results
                promptMessages = createWallpaperPrompt(userText, searchResults, getMessageHistory(senderId));
            } catch (searchError) {
                console.error('Error during wallpaper search:', searchError);
                // Fall back to regular prompt if search fails
                promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
            }
        }
        // Check if this is a request for Wikipedia information
        else if (isWikipediaRequest(userText)) {
            // Perform Wikipedia search
            console.log(`Detected Wikipedia request: "${userText}"`);
            await message.react('📚', m, sock); // React with book emoji
            
            try {
                // Extract the search term
                const searchTerm = extractWikipediaSearchTerm(userText);
                // Determine appropriate language based on message content
                const language = detectLanguage(userText);
                searchResults = await wikipediaSearch(searchTerm, 5, language);
                console.log(`Found ${searchResults.results.length} Wikipedia entries`);
                
                // Create prompt with Wikipedia results
                promptMessages = createWikipediaPrompt(userText, searchResults, getMessageHistory(senderId));
            } catch (searchError) {
                console.error('Error during Wikipedia search:', searchError);
                // Fall back to regular prompt if search fails
                promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
            }
        }
        // Check if this might need real-time information using AI classification
        else {
            // First classify if the query needs real-time info
            const needsRealTimeInfo = await checkIfNeedsRealTimeInfo(userText);
            
            if (needsRealTimeInfo) {
                // Perform Google search
                console.log(`AI determined query needs real-time info: "${userText}"`);
                await message.react('🔍', m, sock); // React to show searching
                
                try {
                    searchResults = await googleSearch(userText);
                    console.log(`Found ${searchResults.results.length} search results`);
                    
                    // Create prompt with search results
                    promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
                } catch (searchError) {
                    console.error('Error during search:', searchError);
                    // Fall back to regular prompt if search fails
                    promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                }
            } else {
                // Get chat history for this sender
                const history = getMessageHistory(senderId);
                promptMessages = createRegularPrompt(userText, history);
            }
        }
        
        // Call the Groq API
        const response = await getGroqCompletion(promptMessages);
        const aiReply = response.choices[0]?.message?.content || "I'm not sure how to respond to that.";
        
        // Update conversation history with this exchange
        updateMessageHistory(senderId, userText, aiReply);
        
        return aiReply;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}

/**
 * Check if a query needs real-time information using AI classification
 * 
 * @param {string} query - The user's query to classify
 * @returns {Promise<boolean>} - Whether the query needs real-time info
 */
async function checkIfNeedsRealTimeInfo(query) {
    try {
        // Create a classification prompt
        const classificationPrompt = createRealTimeClassificationPrompt(query);
        
        // Get AI classification response
        const response = await getGroqCompletion(classificationPrompt, {
            temperature: 0.1, // Lower temperature for more consistent classification
            max_completion_tokens: 10 // We just need a yes/no answer
        });
        
        // Extract the classification result
        const result = response.choices[0]?.message?.content?.trim().toLowerCase() || "";
        
        // Check if the response contains "yes"
        return result.includes('yes');
    } catch (error) {
        console.error('Error classifying real-time info need:', error);
        // Default to false to avoid unnecessary searches in case of error
        return false;
    }
}

/**
 * Forward a message to the admin
 */
async function forwardMessageToAdmin(m, userText, sock) {
    try {
        // Get the original sender info
        const sender = m.key.remoteJid;
        const senderName = m.pushName || 'Unknown User';
        
        // Forward to admin
        const adminMessage = `📨 *Message from user:*\n` +
            `👤 *${senderName}* (${sender})\n\n` +
            `💬 "${userText}"`;
        
        // Send to admin using owner number from config
        await sock.sendMessage(config.OWNER_NUMBER, { text: adminMessage });
        
        console.log(`Forwarded message to admin from ${senderName} (${sender})`);
        return true;
    } catch (error) {
        console.error('Error forwarding message to admin:', error);
        return false;
    }
}

/**
 * Check if the message appears to be requesting admin contact
 */
function isAdminContactRequest(text) {
    const lowerText = text.toLowerCase();
    
    const adminKeywords = [
        'contact admin', 'message admin', 'tell admin', 'contact owner',
        'message owner', 'tell owner', 'send message to admin', 'send message to owner',
        'forward to admin', 'forward to owner', 'pass to admin', 'pass to owner'
    ];
    
    return adminKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Check if the message is asking about the bot itself
 */
function isBotInfoRequest(text) {
    const lowerText = text.toLowerCase();
    
    const botKeywords = [
        'who are you', 'what are you', 'what can you do', 'your features',
        'bot info', 'about bot', 'bot features', 'bot capabilities',
        'help me', 'how to use', 'tell me about yourself', 'what is this bot'
    ];
    
    return botKeywords.some(keyword => lowerText.includes(keyword));
}

/**
 * Get message history for a specific sender
 */
function getMessageHistory(senderId) {
    if (!messageHistory.has(senderId)) {
        return [];
    }
    
    return messageHistory.get(senderId);
}

/**
 * Update message history with new exchange
 */
function updateMessageHistory(senderId, userMessage, aiResponse) {
    if (!messageHistory.has(senderId)) {
        messageHistory.set(senderId, []);
    }
    
    const history = messageHistory.get(senderId);
    
    // Add this exchange
    history.push({ role: "user", content: userMessage });
    history.push({ role: "assistant", content: aiResponse });
    
    // Trim history if it's too long
    while (history.length > MAX_HISTORY_LENGTH * 2) { // *2 because each exchange is 2 messages
        history.shift();
    }
    
    messageHistory.set(senderId, history);
}

/**
 * Check if the message is a request for Wikipedia information
 */
function isWikipediaRequest(text) {
    const lowerText = text.toLowerCase();
    
    // Keywords that might indicate a Wikipedia request
    const wikipediaKeywords = [
        'who is', 'who was', 'what is', 'what are', 'when was', 'when did',
        'where is', 'wikipedia', 'wiki', 'tell me about', 'information about',
        'facts about', 'history of', 'definition of', 'define'
    ];
    
    return wikipediaKeywords.some(keyword => lowerText.includes(keyword)) &&
           !isWallpaperRequest(text);
}

/**
 * Extract the search term from a Wikipedia request
 */
function extractWikipediaSearchTerm(text) {
    const lowerText = text.toLowerCase();
    
    // Try to extract what comes after common phrases
    const patterns = [
        /who is (.*?)(?:\?|$)/i,
        /who was (.*?)(?:\?|$)/i,
        /what is (.*?)(?:\?|$)/i,
        /what are (.*?)(?:\?|$)/i,
        /when was (.*?)(?:\?|$)/i,
        /when did (.*?)(?:\?|$)/i,
        /where is (.*?)(?:\?|$)/i,
        /tell me about (.*?)(?:\?|$)/i,
        /information about (.*?)(?:\?|$)/i,
        /facts about (.*?)(?:\?|$)/i,
        /history of (.*?)(?:\?|$)/i,
        /definition of (.*?)(?:\?|$)/i,
        /define (.*?)(?:\?|$)/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    // If no patterns match, remove common wikipedia request phrases
    let searchTerm = lowerText
        .replace(/wikipedia/gi, '')
        .replace(/wiki/gi, '')
        .replace(/tell me about/gi, '')
        .replace(/information about/gi, '')
        .replace(/facts about/gi, '')
        .replace(/history of/gi, '')
        .replace(/definition of/gi, '')
        .replace(/define/gi, '')
        .replace(/\?/g, '')
        .trim();
    
    return searchTerm || text;
}

/**
 * Detect the language of the message for Wikipedia search
 */
function detectLanguage(text) {
    // Very simple language detection
    // For a real implementation, consider using a language detection library
    
    // Check for Spanish indicators
    if (/[áéíóúüñ¿¡]/i.test(text) || 
        /\b(qué|cómo|quién|dónde|cuándo|por qué)\b/i.test(text)) {
        return 'es';
    }
    
    // Default to English
    return 'en';
}

/**
 * Check if the message is a request for wallpapers or images
 */
function isWallpaperRequest(text) {
    const lowerText = text.toLowerCase();
    
    // Keywords that might indicate a wallpaper request
    const wallpaperKeywords = [
        'wallpaper', 'background', 'image', 'picture', 'photo',
        'img', 'pic', 'show me', 'find me', 'get me'
    ];
    
    return wallpaperKeywords.some(keyword => lowerText.includes(keyword)) &&
           (lowerText.includes('wallpaper') || 
            lowerText.includes('image') || 
            lowerText.includes('picture') || 
            lowerText.includes('photo'));
}

/**
 * Extract the search term from a wallpaper request
 */
function extractWallpaperSearchTerm(text) {
    const lowerText = text.toLowerCase();
    
    // Try to extract what comes after common phrases
    const patterns = [
        /wallpaper of (.*?)(?:\?|$)/i,
        /wallpaper for (.*?)(?:\?|$)/i,
        /wallpapers of (.*?)(?:\?|$)/i,
        /wallpapers for (.*?)(?:\?|$)/i,
        /image of (.*?)(?:\?|$)/i,
        /image for (.*?)(?:\?|$)/i,
        /picture of (.*?)(?:\?|$)/i,
        /picture for (.*?)(?:\?|$)/i,
        /show me (.*?) wallpaper/i,
        /show me (.*?) image/i,
        /find me (.*?) wallpaper/i,
        /get me (.*?) wallpaper/i
    ];
    
    for (const pattern of patterns) {
        const match = text.match(pattern);
        if (match && match[1]) {
            return match[1].trim();
        }
    }
    
    // If no patterns match, remove common wallpaper request phrases
    let searchTerm = lowerText
        .replace(/wallpaper of/gi, '')
        .replace(/wallpaper for/gi, '')
        .replace(/wallpapers of/gi, '')
        .replace(/wallpapers for/gi, '')
        .replace(/image of/gi, '')
        .replace(/image for/gi, '')
        .replace(/picture of/gi, '')
        .replace(/picture for/gi, '')
        .replace(/show me/gi, '')
        .replace(/find me/gi, '')
        .replace(/get me/gi, '')
        .replace(/wallpaper/gi, '')
        .replace(/image/gi, '')
        .replace(/picture/gi, '')
        .replace(/\?/g, '')
        .trim();
    
    return searchTerm || text;
}
