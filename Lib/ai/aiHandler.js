import { getGroqCompletion } from './groq.js';
import { 
    createRegularPrompt, 
    createAdminContactPrompt, 
    createBotInfoPrompt, 
    createSearchEnhancedPrompt,
    createWikipediaPrompt,
    createWallpaperPrompt,
    createQueryClassificationPrompt,
    createHtmlExtractionPrompt,
    createCommandMatchPrompt
} from './prompts.js';
import { 
    googleSearch, 
    wikipediaSearch, 
    wallpaperSearch,
    extractHtml,
    formatSearchResults 
} from './googleSearch.js';
import config from '../../Config.js';
import message from '../chat/messageHandler.js';

// Message history cache (very simple implementation)
const messageHistory = new Map();
const MAX_HISTORY_LENGTH = config.AI_CONTEXT_LENGTH || 5;  // Maximum number of previous exchanges to include

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
        
        // Log the incoming message
        console.log(`AI processing message: "${userText}"`);
        
        // Step 1: First check if the query matches a bot command
        const matchingCommand = await checkForCommandMatch(userText);
        console.log(`Command match check result: ${matchingCommand}`);
        
        if (matchingCommand !== 'none') {
            // This query should be handled by suggesting a bot command
            const commandResponse = await generateCommandSuggestion(userText, matchingCommand);
            
            // Update conversation history
            updateMessageHistory(senderId, userText, commandResponse);
            
            return commandResponse;
        }
        
        // For simple factual questions, prioritize search
        if (isFastFactQuestion(userText)) {
            console.log("Detected fast fact question, prioritizing search");
            try {
                await message.react('🔍', m, sock);
                searchResults = await googleSearch(userText);
                console.log(`Fast fact search found ${searchResults.results?.length || 0} results`);
                
                if (searchResults.results && searchResults.results.length > 0) {
                    promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
                    
                    // Track search stats if available
                    if (global.aiStats) {
                        global.aiStats.searchesPerformed = (global.aiStats.searchesPerformed || 0) + 1;
                    }
                    
                    const response = await getGroqCompletion(promptMessages);
                    const aiReply = response.choices[0]?.message?.content || "I'm not sure how to respond to that.";
                    
                    // Update conversation history with this exchange
                    updateMessageHistory(senderId, userText, aiReply);
                    
                    return aiReply;
                }
                // If no search results or search failed, continue with normal classification
            } catch (searchError) {
                console.error('Error during fast fact search:', searchError);
                // Continue with normal classification
            }
        }
        
        // Classify the query type using AI instead of keyword detection
        const queryType = await classifyQueryType(userText);
        console.log(`Query classified as: ${queryType}`);
        
        // Handle the query based on its type
        switch (queryType) {
            case 'admin':
                promptMessages = createAdminContactPrompt(userText);
                await forwardMessageToAdmin(m, userText, sock);
                break;
                
            case 'botinfo':
                promptMessages = createBotInfoPrompt(userText);
                break;
                
            case 'wallpaper':
                console.log(`Detected wallpaper request: "${userText}"`);
                await message.react('🖼️', m, sock); // React with image emoji
                
                try {
                    // Extract the search term
                    const searchTerm = extractSearchTerm(userText, 'wallpaper');
                    searchResults = await wallpaperSearch(searchTerm);
                    console.log(`Found ${searchResults.results.length} wallpapers`);
                    
                    // Create prompt with wallpaper results
                    promptMessages = createWallpaperPrompt(userText, searchResults, getMessageHistory(senderId));
                } catch (searchError) {
                    console.error('Error during wallpaper search:', searchError);
                    // Fall back to regular prompt if search fails
                    promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                }
                break;
                
            case 'wikipedia':
                console.log(`Detected Wikipedia request: "${userText}"`);
                await message.react('📚', m, sock); // React with book emoji
                
                try {
                    // Extract the search term
                    const searchTerm = extractSearchTerm(userText, 'wikipedia');
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
                break;
                
            case 'realtime':
                console.log(`Detected real-time info request: "${userText}"`);
                await message.react('🔍', m, sock); // React to show searching
                
                try {
                    searchResults = await googleSearch(userText);
                    console.log(`Found ${searchResults.results?.length || 0} search results`);
                    
                    // Track search stats if available
                    if (global.aiStats) {
                        global.aiStats.searchesPerformed = (global.aiStats.searchesPerformed || 0) + 1;
                    }
                    
                    // Only use search results if we actually found any
                    if (searchResults.results && searchResults.results.length > 0) {
                        // Create prompt with search results
                        promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
                    } else {
                        console.log("No search results found, using regular prompt");
                        promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                    }
                } catch (searchError) {
                    console.error('Error during search:', searchError);
                    // Fall back to regular prompt if search fails
                    promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                }
                break;
                
            case 'webpage':
                console.log(`Detected webpage extraction request: "${userText}"`);
                await message.react('🌐', m, sock); // React with globe emoji
                
                try {
                    // Extract URL from the message
                    const url = extractUrl(userText);
                    
                    if (!url) {
                        await message.reply("I couldn't find a valid URL in your message. Please provide a URL to extract content from.", m, sock);
                        return "I couldn't find a valid URL in your message. Please provide a URL to extract content from.";
                    }
                    
                    console.log(`Extracting HTML from URL: ${url}`);
                    const extractionResults = await extractHtml(url);
                    
                    if (!extractionResults.result) {
                        await message.reply(`I couldn't extract content from the URL: ${url}. The website might block extraction or the URL might be invalid.`, m, sock);
                        return `I couldn't extract content from the URL: ${url}. The website might block extraction or the URL might be invalid.`;
                    }
                    
                    // Create prompt with HTML extraction results
                    promptMessages = createHtmlExtractionPrompt(userText, extractionResults, getMessageHistory(senderId));
                } catch (extractionError) {
                    console.error('Error during HTML extraction:', extractionError);
                    // Fall back to regular prompt if extraction fails
                    promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                }
                break;
                
            case 'general':
            default:
                // Get chat history for this sender
                const history = getMessageHistory(senderId);
                promptMessages = createRegularPrompt(userText, history);
                break;
        }
        
        // Call the Groq API
        const response = await getGroqCompletion(promptMessages);
        const aiReply = response.choices[0]?.message?.content || "I'm not sure how to respond to that.";
        
        // Update conversation history with this exchange
        updateMessageHistory(senderId, userText, aiReply);
        
        // For wallpaper requests, also send the actual wallpaper images
        if (queryType === 'wallpaper' && searchResults && searchResults.results && searchResults.results.length > 0) {
            await sendWallpaperImages(m, sock, searchResults.results, aiReply);
        }
        
        return aiReply;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}

/**
 * Send wallpaper images to the user
 * 
 * @param {Object} m - Message object
 * @param {Object} sock - Socket object
 * @param {Array} wallpapers - Array of wallpaper results
 * @param {string} aiReply - AI's text reply
 */
async function sendWallpaperImages(m, sock, wallpapers, aiReply) {
    try {
        // Show typing indicator briefly after sending text
        await sock.sendPresenceUpdate('composing', m.key.remoteJid);
        
        // Send up to 3 images to avoid spamming
        const wallpapersToSend = wallpapers.slice(0, 3);
        
        // Send the first image as a reply to the original message
        if (wallpapersToSend.length > 0) {
            // Send first with caption if we haven't sent a text reply yet
            await message.sendImage(
                wallpapersToSend[0].image,
                "", // No caption, as we already sent the text
                m,
                sock
            );
            
            // Send remaining images without caption
            for (let i = 1; i < wallpapersToSend.length; i++) {
                await message.sendImage(
                    wallpapersToSend[i].image,
                    "",
                    m,
                    sock
                );
                
                // Small delay between images to avoid rate limiting
                await new Promise(resolve => setTimeout(resolve, 500));
            }
        }
    } catch (error) {
        console.error('Error sending wallpaper images:', error);
        // If error sending images, at least let the user know
        await message.reply("I found some wallpapers but couldn't send them. You can check the links in my previous message.", m, sock);
    }
}

/**
 * Classify the query type using AI
 * 
 * @param {string} query - The user's query to classify
 * @returns {Promise<string>} - Query type (wikipedia, wallpaper, realtime, admin, botinfo, webpage, general)
 */
async function classifyQueryType(query) {
    try {
        // Create a classification prompt
        const classificationPrompt = createQueryClassificationPrompt(query);
        
        // Get AI classification response
        const response = await getGroqCompletion(classificationPrompt, {
            temperature: 0.1, // Lower temperature for more consistent classification
            max_completion_tokens: 10 // We just need a single word
        });
        
        // Extract the classification result
        const result = response.choices[0]?.message?.content?.trim().toLowerCase() || "";
        
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
async function checkForCommandMatch(query) {
    try {
        const commandMatchPrompt = createCommandMatchPrompt(query);
        
        const response = await getGroqCompletion(commandMatchPrompt, {
            temperature: 0.1,
            max_completion_tokens: 10
        });
        
        const result = response.choices[0]?.message?.content?.trim().toLowerCase() || "none";
        
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
async function generateCommandSuggestion(userMessage, command) {
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
function isFastFactQuestion(text) {
    const lowerText = text.toLowerCase().trim();
    
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

/**
 * Extract URL from text message
 * @param {string} text - The message text
 * @returns {string|null} - The extracted URL or null if none found
 */
function extractUrl(text) {
    // Simple URL regex pattern
    const urlPattern = /(https?:\/\/[^\s]+)/ig;
    const matches = text.match(urlPattern);
    
    if (matches && matches.length > 0) {
        return matches[0]; // Return the first URL found
    }
    
    return null;
}

/**
 * Extract search term based on the query type
 */
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
