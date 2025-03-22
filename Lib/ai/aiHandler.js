import { getGroqCompletion } from './groq.js';
import { createRegularPrompt, createAdminContactPrompt, createBotInfoPrompt, createSearchEnhancedPrompt } from './prompts.js';
import { googleSearch, formatSearchResults } from './googleSearch.js';
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
        // Check if this might need real-time information
        else if (mightNeedRealTimeInfo(userText)) {
            // Perform Google search
            console.log(`Query might need real-time info: "${userText}"`);
            await message.react('🔍', m, sock); // React to show searching
            
            try {
                searchResults = await googleSearch(userText);
                console.log(`Found ${searchResults.length} search results`);
                
                // Create prompt with search results
                promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
            } catch (searchError) {
                console.error('Error during search:', searchError);
                // Fall back to regular prompt if search fails
                promptMessages = createRegularPrompt(userText, getMessageHistory(senderId));
            }
        }
        // Regular conversation
        else {
            // Get chat history for this sender
            const history = getMessageHistory(senderId);
            promptMessages = createRegularPrompt(userText, history);
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
 * Determine if a query might need real-time information
 * @param {string} text - The user's message
 * @returns {boolean} - Whether the message likely needs real-time info
 */
function mightNeedRealTimeInfo(text) {
    const lowerText = text.toLowerCase();
    
    // Keywords that might indicate a need for real-time information
    const realTimeKeywords = [
        'news', 'latest', 'recent', 'today', 'yesterday', 'this week', 'this month', 'this year',
        'current', 'weather', 'who is', 'what is', 'how to', 'when', 'where', 'why', 'which',
        'score', 'event', 'happened', 'trending', 'coronavirus', 'covid', 'pandemic',
        'election', 'stock', 'price', 'value', 'release', 'launch', 'update'
    ];
    
    // Check if the query contains question words or is framed as a question
    const isQuestion = lowerText.includes('?') || 
                      lowerText.startsWith('who') || 
                      lowerText.startsWith('what') || 
                      lowerText.startsWith('when') || 
                      lowerText.startsWith('where') || 
                      lowerText.startsWith('why') || 
                      lowerText.startsWith('how') || 
                      lowerText.startsWith('can') || 
                      lowerText.startsWith('does');
    
    // Check if any real-time keywords are present
    const containsRealTimeKeywords = realTimeKeywords.some(keyword => 
        lowerText.includes(keyword)
    );
    
    return isQuestion && containsRealTimeKeywords;
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
