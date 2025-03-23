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

// Track first-time users
const firstTimeUsers = new Set();

/**
 * Process a message with AI and get a response
 * 
 * @param {Object} m - The message object
 * @param {Object} sock - The WhatsApp socket
 * @param {string} userText - The text message from the user
 * @returns {Promise<string>} AI response text
 */
export async function processMessageWithAI(m, sock, userText) {
    try {
        const senderId = m.key.remoteJid;
        let promptMessages;
        let searchResults = null;
        
        // Log the incoming message
        console.log(`AI processing message: "${userText}"`);
        
        // Check if this is a first-time user (no message history)
        const isFirstTime = !messageHistory.has(senderId) || messageHistory.get(senderId).length === 0;
        
        // Handle greeting for first-time users
        if (isFirstTime && userText && isGreeting(userText)) {
            console.log(`First-time greeting from user: ${senderId}`);
            
            // Create a custom greeting message
            const adminName = config.ADMIN_NAME || 'the admin';
            const greeting = `Hello! 👋 I'm ${config.BOT_NAME}, a WhatsApp assistant created by ${adminName}. I can help you with questions, download media from social platforms, and more. How can I assist you today?`;
            
            // Update conversation history with this exchange
            updateMessageHistory(senderId, userText, greeting);
            
            return greeting;
        }
        
        // Check if asking about admin information
        if (isAskingAboutAdmin(userText)) {
            console.log(`User asking about admin: ${senderId}`);
            
            // Check if this is a repeated or persistent inquiry about admin
            const history = getMessageHistory(senderId);
            const adminInquiryCount = countAdminInquiries(history);
            
            if (adminInquiryCount > 2) {
                console.log(`Repeated admin inquiries (${adminInquiryCount}) - providing contact info`);
                
                // After multiple inquiries, provide contact information
                const adminContact = `I'm just a bot assistant, not ${config.ADMIN_NAME || 'the admin'} personally. If you need to contact the admin directly, please use this number: ${config.OWNER_NUMBER}`;
                
                // Update conversation history
                updateMessageHistory(senderId, userText, adminContact);
                
                return adminContact;
            }
            
            // Use the admin-specific prompt for handling admin inquiries
            promptMessages = createAdminContactPrompt(userText);
        } else {
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
                        
                        // Make sure to clear typing indicator even for fast facts
                        await sock.sendPresenceUpdate('paused', m.key.remoteJid);
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
                        console.log(`Searching wallpapers for: "${searchTerm}"`);
                        
                        // Fetch wallpapers from API
                        searchResults = await wallpaperSearch(searchTerm);
                        console.log(`Found ${searchResults.results?.length || 0} wallpapers`);
                        
                        // Only continue if we actually found wallpapers
                        if (!searchResults.results || searchResults.results.length === 0) {
                            console.log("No wallpapers found, using regular prompt");
                            promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
                            break;
                        }
                        
                        // Create prompt with wallpaper results
                        promptMessages = createWallpaperPrompt(userText, searchResults, getMessageHistory(senderId));
                        
                        // Generate AI response
                        const response = await getGroqCompletion(promptMessages);
                        const aiReply = response.choices[0]?.message?.content || "I found some wallpapers for you. I'll send them right away.";
                        
                        // Update conversation history with this exchange
                        updateMessageHistory(senderId, userText, aiReply);
                        
                        // First send the reply text
                        await message.reply(aiReply, m, sock);
                        
                        // Then send the wallpaper images directly
                        await sendWallpaperImages(m, sock, searchResults.results);
                        
                        // Make sure typing indicator is cleared after all operations
                        await sock.sendPresenceUpdate('paused', m.key.remoteJid);
                        
                        // Return the AI reply to prevent duplicate response
                        return aiReply;
                        
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
        }
        
        // Call the Groq API
        const response = await getGroqCompletion(promptMessages);
        const aiReply = response.choices[0]?.message?.content || "I'm not sure how to respond to that.";
        
        // Update conversation history with this exchange
        updateMessageHistory(senderId, userText, aiReply);
        
        // Ensure typing indicator is cleared after all processing
        const updateTypingStatus = async (status) => {
            if (sock && typeof sock.sendPresenceUpdate === 'function') {
                try {
                    await sock.sendPresenceUpdate(status, m.key.remoteJid);
                } catch (e) {
                    console.error(`Error updating presence: ${e.message}`);
                }
            }
        };

        await updateTypingStatus('paused');
        
        return aiReply;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        // Clear typing indicator on error
        if (sock && typeof sock.sendPresenceUpdate === 'function') {
            try {
                await sock.sendPresenceUpdate('paused', m.key.remoteJid);
            } catch (e) {
                console.error(`Error clearing typing indicator: ${e.message}`);
            }
        }
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}

/**
 * Send wallpaper images to the user
 * 
 * @param {Object} m - Message object
 * @param {Object} sock - Socket object
 * @param {Array} wallpapers - Array of wallpaper results
 */
async function sendWallpaperImages(m, sock, wallpapers) {
    if (!wallpapers || wallpapers.length === 0) {
        console.log("No wallpapers to send");
        return;
    }
    
    try {
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', m.key.remoteJid);
        
        console.log(`Preparing to send ${Math.min(wallpapers.length, 3)} wallpapers`);
        
        // Send up to 3 images to avoid spamming
        const wallpapersToSend = wallpapers.slice(0, 3);
        
        for (let i = 0; i < wallpapersToSend.length; i++) {
            const wallpaper = wallpapersToSend[i];
            
            try {
                console.log(`Sending wallpaper ${i+1}/${wallpapersToSend.length}: ${wallpaper.image}`);
                
                // Verify the image URL is valid
                if (!wallpaper.image || !wallpaper.image.startsWith('http')) {
                    console.log(`Invalid image URL for wallpaper ${i+1}: ${wallpaper.image}`);
                    continue;
                }
                
                // Add a small delay between sending images
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                }
                
                // Send the image
                await message.sendImage(
                    wallpaper.image,
                    i === 0 ? "Wallpaper found for you" : "", // Add caption only to first image
                    m,
                    sock
                );
                
                console.log(`Successfully sent wallpaper ${i+1}`);
                
            } catch (error) {
                console.error(`Error sending wallpaper ${i+1}:`, error);
            }
        }
        
        // React with success emoji after sending all wallpapers
        await message.react('✅', m, sock);
        
        // Clear typing indicator after all wallpapers are sent
        await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        
    } catch (error) {
        console.error('Error in sendWallpaperImages:', error);
        
        // If error sending images, let the user know
        try {
            await message.reply("I found some wallpapers but had trouble sending them. Please try again.", m, sock);
            // Make sure to clear typing indicator even after error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
            // Last resort attempt to clear typing indicator
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        }
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

/**
 * Check if a message is a greeting
 * @param {string} text - Message text
 * @returns {boolean} - True if it's a greeting
 */
function isGreeting(text) {
    // First check if text is a valid string
    if (!text || typeof text !== 'string') {
        console.warn(`isGreeting called with invalid text: ${typeof text}`);
        return false;
    }

    const greetings = [
        'hi', 'hello', 'hey', 'hola', 'greetings', 'sup', 'whats up', 
        'good morning', 'good afternoon', 'good evening', 'howdy', 'yo',
        'hiya', 'heya', 'hai', 'bonjour', 'namaste', 'hallo', 'hi there'
    ];
    
    const lowercaseText = text.toLowerCase().trim();
    
    return greetings.some(greeting => 
        lowercaseText === greeting || 
        lowercaseText.startsWith(greeting + ' ') ||
        lowercaseText.endsWith(' ' + greeting)
    );
}

/**
 * Check if a message is asking about the admin
 * @param {string} text - Message text
 * @returns {boolean} - True if asking about admin
 */
function isAskingAboutAdmin(text) {
    const adminKeywords = [
        'admin', 'owner', 'creator', 'who made', 'who created', 
        'your creator', 'your owner', 'who owns', 'who programmed',
        'who developed', 'developer', 'admin info', 'admin contact',
        'admin number', 'contact admin', 'talk to admin'
    ];
    
    const lowercaseText = text.toLowerCase().trim();
    
    return adminKeywords.some(keyword => lowercaseText.includes(keyword));
}

/**
 * Count how many admin-related inquiries are in the chat history
 * @param {Array} history - Chat history
 * @returns {number} - Count of admin inquiries
 */
function countAdminInquiries(history) {
    let count = 0;
    
    for (let i = 0; i < history.length; i++) {
        const item = history[i];
        if (item.role === 'user' && isAskingAboutAdmin(item.content)) {
            count++;
        }
    }
    
    return count;
}
