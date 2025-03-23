import config from '../../../Config.js';

// Message history cache (very simple implementation)
const messageHistory = new Map();
const MAX_HISTORY_LENGTH = config.AI_CONTEXT_LENGTH || 5;  // Maximum number of previous exchanges to include

// Track first-time users
const firstTimeUsers = new Set();

/**
 * Get message history for a specific sender
 * @param {string} senderId - The sender's ID
 * @returns {Array} - Array of message history entries
 */
export function getMessageHistory(senderId) {
    if (!messageHistory.has(senderId)) {
        return [];
    }
    
    return messageHistory.get(senderId);
}

/**
 * Update message history with new exchange
 * @param {string} senderId - The sender's ID
 * @param {string} userMessage - The user's message
 * @param {string} aiResponse - The AI's response
 */
export function updateMessageHistory(senderId, userMessage, aiResponse) {
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
 * Check if this is a first-time interaction with this user
 * @param {string} userId - The user's JID
 * @returns {boolean} - True if this is the first interaction
 */
export function isFirstTimeInteraction(userId) {
    if (firstTimeUsers.has(userId)) {
        return false;
    }
    
    // Mark as interacted
    firstTimeUsers.add(userId);
    return true;
}

/**
 * Count how many admin-related inquiries are in the chat history
 * @param {Array} history - Chat history
 * @returns {number} - Count of admin inquiries
 */
export function countAdminInquiries(history) {
    let count = 0;
    
    for (let i = 0; i < history.length; i++) {
        const item = history[i];
        if (item.role === 'user' && isAskingAboutAdmin(item.content)) {
            count++;
        }
    }
    
    return count;
}

// Internal utility used by countAdminInquiries
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
