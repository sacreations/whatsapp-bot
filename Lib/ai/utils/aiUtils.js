/**
 * Check if a message is a greeting
 * @param {string} text - Message text
 * @returns {boolean} - True if it's a greeting
 */
export function isGreeting(text) {
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
export function isAskingAboutAdmin(text) {
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
 * Extract URL from text message
 * @param {string} text - The message text
 * @returns {string|null} - The extracted URL or null if none found
 */
export function extractUrl(text) {
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
export function extractSearchTerm(text, queryType) {
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
 * Detect the language of the message for Wikipedia search
 */
export function detectLanguage(text) {
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
 * Safely update typing status
 * @param {Object} sock - WhatsApp socket
 * @param {string} jid - The recipient JID
 * @param {string} status - The status to set ('composing' or 'paused')
 */
export async function updateTypingStatus(sock, jid, status) {
    if (sock && typeof sock.sendPresenceUpdate === 'function') {
        try {
            await sock.sendPresenceUpdate(status, jid);
        } catch (e) {
            console.error(`Error updating presence: ${e.message}`);
        }
    }
}
