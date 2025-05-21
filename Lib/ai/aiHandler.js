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

// --- New: Helper to ask AI if real-time data is needed ---
async function askIfNeedsRealtime(userText, chatHistory) {
    // Simple prompt for decision
    const prompt = [
        {
            role: "system",
            content: "You are a WhatsApp AI assistant. Decide if the user's message needs real-time data (Google search) to answer. Respond with only 'yes' or 'no'."
        },
        // Add up to 3 previous exchanges for context
        ...(chatHistory ? chatHistory.slice(-6) : []),
        {
            role: "user",
            content: userText
        }
    ];
    const response = await generateGeminiChatResponse(prompt, { temperature: 0.1, max_completion_tokens: 5 });
    const text = response.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
    console.log(`AI decision on real-time data: "${text}"`);
    return text.startsWith('y'); // true if "yes"
}

// --- New: Function to generate good search prompt to google ---
async function createSearchPrompt(userText, chatHistory ) {
    const searchPrompt = [
        {
            role: "system",
            content: `You are ${config.BOT_NAME}, a WhatsApp assistant. Decide what search terms to use for Google search based on the user's message. Respond only with best one search term.(e.g. "latest news on AI")`
        },
        // Add up to 3 previous exchanges for context
        ...(chatHistory ? chatHistory.slice(-6) : []),
        {
            role: "user",
            content: userText
        }

    ];
    const searchTerm = await generateGeminiChatResponse(searchPrompt, { temperature: 0.1, max_completion_tokens: 500 });
    const text = searchTerm.candidates?.[0]?.content?.parts?.[0]?.text?.trim().toLowerCase() || "";
    console.log(`AI decision on search term: "${text}"`);
    return text;
}

// function to skip real-time data
const skipRealtimeKeywords = ['thank', 'thanks', 'ok', 'okay', 'cool', 'welcome', 'lol', 'haha', 'nice', 'great', 'good', 'bye'];

function isCasualReply(text) {
    return skipRealtimeKeywords.some(keyword => text.toLowerCase().includes(keyword));
}



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

        // Fetch message history for this sender (for context)
        const chatHistory = getMessageHistory(senderId);

        // Handle greeting for first-time users
        if ((!chatHistory || chatHistory.length === 0) && userText && isGreeting(userText)) {
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

        // --- Ask AI if real-time data is needed ---
        let needsRealtime = false;
        if (!isCasualReply(userText) && !isFirstTime) {
            if (userText.length < 4) {
                needsRealtime = false;
            }else{
                try {
                needsRealtime = await askIfNeedsRealtime(userText, chatHistory);
                } catch (e) {
                console.error('Error in real-time decision:', e);
            }

            }
            
        }
        
        if (needsRealtime) {
            await message.react('🌐', m, sock);
            searchResults = await googleSearch(await createSearchPrompt(userText, chatHistory));
            console.log(`Google search found ${searchResults.results?.length || 0} results using ${searchResults.searchEngine}`);
            // Use search-enhanced prompt with chat history
            promptMessages = createSearchEnhancedPrompt(userText, searchResults, chatHistory);
        } else {
            // Use regular prompt with chat history (no search)
            promptMessages = [
                {
                    role: "system",
                    content: `You are ${config.BOT_NAME}, a helpful WhatsApp assistant. Respond naturally and concisely.`
                },
                ...(chatHistory ? chatHistory.slice(-10) : []),
                { role: "user", content: userText }
            ];
        }

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


