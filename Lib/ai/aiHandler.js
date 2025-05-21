import { generateGeminiChatResponse, filterThinkingPart } from './groq.js';
import { 
    createSearchEnhancedPrompt
} from './prompts.js';
import { 
    googleSearch
} from './googleSearch.js';
import config from '../../Config.js';
import message from '../chat/messageHandler.js';
import { getMessageHistory, updateMessageHistory, countAdminInquiries } from './history/messageHistory.js';
import { isGreeting, isAskingAboutAdmin, updateTypingStatus } from './utils/aiUtils.js';
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
            const adminName = config.ADMIN_NAME || 'the admin';
            const greeting = `Hello! 👋 I'm ${config.BOT_NAME}, a WhatsApp assistant created by ${adminName}. I can help you with questions, download media from social platforms, and more. How can I assist you today?`;
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
            const history = getMessageHistory(senderId);
            const adminInquiryCount = countAdminInquiries(history);
            if (adminInquiryCount > 2) {
                console.log(`Repeated admin inquiries (${adminInquiryCount}) - providing contact info`);
                const adminContact = `I'm just a bot assistant, not ${config.ADMIN_NAME || 'the admin'} personally. If you need to contact the admin directly, please use this number: ${config.OWNER_NUMBER}`;
                updateMessageHistory(senderId, userText, adminContact);
                return adminContact;
            }
            // Fallback: just reply with generic admin info
            const adminInfo = `I'm a bot created by ${config.ADMIN_NAME || 'the admin'}.`;
            updateMessageHistory(senderId, userText, adminInfo);
            return adminInfo;
        }

        // --- ALWAYS USE GOOGLE SEARCH FOR DATA ---
        await message.react('🌐', m, sock);
        searchResults = await googleSearch(userText);
        console.log(`Google search found ${searchResults.results?.length || 0} results using ${searchResults.searchEngine}`);
        promptMessages = createSearchEnhancedPrompt(userText, searchResults, getMessageHistory(senderId));
        const response = await generateGeminiChatResponse(promptMessages);
        let aiReply = response.candidates?.[0]?.content?.parts?.[0]?.text || "I'm not sure how to respond to that.";
        aiReply = filterThinkingPart(aiReply);
        updateMessageHistory(senderId, userText, aiReply);
        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
        return aiReply;
    } catch (error) {
        console.error('Error processing message with AI:', error);
        await updateTypingStatus(sock, m.key.remoteJid, 'paused');
        return "I'm having trouble connecting to my brain right now. Please try again later.";
    }
}


