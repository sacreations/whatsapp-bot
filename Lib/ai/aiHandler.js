import { generateGeminiChatResponse, filterThinkingPart } from './groq.js';
import { 
    createRegularPrompt, 
    createAdminContactPrompt, 
    createBotInfoPrompt, 
    createSearchEnhancedPrompt,
    createWikipediaPrompt,
    createWallpaperPrompt,
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

// Import modularized components
import { getMessageHistory, updateMessageHistory, isFirstTimeInteraction, countAdminInquiries } from './history/messageHistory.js';
import { classifyQueryType, checkForCommandMatch, generateCommandSuggestion, isFastFactQuestion } from './classifiers/queryClassifier.js';
import { sendWallpaperImages } from './handlers/mediaHandler.js';
import { isGreeting, isAskingAboutAdmin, extractUrl, extractSearchTerm, detectLanguage, updateTypingStatus } from './utils/aiUtils.js';
import { generateBotInfo, generateCategoryInfo, handleCommandInquiry } from './handlers/botInfoHandler.js';

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
        const isFirstTime = !getMessageHistory(senderId) || getMessageHistory(senderId).length === 0;
        
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
        
        // Check for explicit bot info request
        if (userText.toLowerCase().includes('what can you do') || 
            userText.toLowerCase().includes('your features') ||
            userText.toLowerCase().includes('help menu') ||
            userText.toLowerCase().includes('bot features') ||
            userText.toLowerCase().includes('list commands') ||
            userText.toLowerCase().includes('show commands')) {
            
            const botInfoResponse = generateBotInfo();
            updateMessageHistory(senderId, userText, botInfoResponse);
            return botInfoResponse;
        }
        
        // Check for specific command category inquiries
        const categoryKeywords = {
            'social media commands': 'social',
            'download commands': 'social', 
            'media commands': 'media',
            'group commands': 'groups',
            'status commands': 'status',
            'links commands': 'links'
        };
        
        for (const [keyword, category] of Object.entries(categoryKeywords)) {
            if (userText.toLowerCase().includes(keyword)) {
                const categoryInfo = generateCategoryInfo(category);
                updateMessageHistory(senderId, userText, categoryInfo);
                return categoryInfo;
            }
        }
        
        // Check if asking about a specific command
        if (userText.toLowerCase().includes('how to use') || 
            userText.toLowerCase().includes('how do i use') ||
            userText.toLowerCase().includes('command for') ||
            userText.toLowerCase().includes('command help')) {
            
            const commandInfo = handleCommandInquiry(userText);
            updateMessageHistory(senderId, userText, commandInfo);
            return commandInfo;
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
                const commandResponse = await generateCommandSuggestion(userText, matchingCommand, config);
                
                // Update conversation history
                updateMessageHistory(senderId, userText, commandResponse);
                
                return commandResponse;
            }
            
            // For simple factual questions, prioritize search
            if (isFastFactQuestion(userText)) {
                console.log("Detected fast fact question, prioritizing search");
                try {
                    await message.react('🧠', m, sock); // Changed from 🔍 to 🧠 (brain)
                    searchResults = await googleSearch(userText);
                    console.log(`Fast fact search found ${searchResults.results?.length || 0} results using ${searchResults.searchEngine}`);
                    
                    if (searchResults.results && searchResults.results.length > 0) {
                        promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
                        
                        // Track search stats if available
                        if (global.aiStats) {
                            global.aiStats.searchesPerformed = (global.aiStats.searchesPerformed || 0) + 1;
                        }
                        
                        const response = await generateGeminiChatResponse(promptMessages);
                        const aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
                        
                        // Update conversation history with this exchange
                        updateMessageHistory(senderId, userText, aiReply);
                        
                        // Make sure to clear typing indicator even for fast facts
                        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
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
                    break;
                    
                case 'botinfo':
                    promptMessages = createBotInfoPrompt(userText);
                    break;
                    
                case 'wallpaper':
                    console.log(`Detected wallpaper request: "${userText}"`);
                    await message.react('🎨', m, sock); // Changed from 🖼️ to 🎨 (artist palette)
                    
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
                        const response = await generateGeminiChatResponse(promptMessages);
                        const aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text || "I found some wallpapers for you. I'll send them right away.";
                        
                        // Update conversation history with this exchange
                        updateMessageHistory(senderId, userText, aiReply);
                        
                        // First send the reply text
                        await message.reply(aiReply, m, sock);
                        
                        // Then send the wallpaper images directly
                        await sendWallpaperImages(m, sock, searchResults.results);
                        
                        // Make sure typing indicator is cleared after all operations
                        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
                        
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
                    await message.react('📚', m, sock); // Keep 📚 as it's good
                    
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
                    await message.react('🌐', m, sock); // Changed from 🔍 to 🌐 (globe)
                    
                    try {
                        searchResults = await googleSearch(userText);
                        console.log(`Found ${searchResults.results?.length || 0} search results using ${searchResults.searchEngine}`);
                        
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
                    await message.react('📄', m, sock); // Changed from 🌐 to 📄 (page)
                    
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
        
        // Call the Gemini API instead of Groq
        const response = await generateGeminiChatResponse(promptMessages);
        let aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";

        // Apply final thinking part filter before sending
        aiReply = filterThinkingPart(aiReply);
        
        // Update conversation history with this exchange
        updateMessageHistory(senderId, userText, aiReply);
        
        // Ensure typing indicator is cleared after all processing
        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
        
        return aiReply;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        // Clear typing indicator on error
        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}


