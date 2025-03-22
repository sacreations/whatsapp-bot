import config from '../../Config.js';
import { formatSearchResults } from './googleSearch.js';

/**
 * System prompt to define the AI assistant's behavior
 */
export const SYSTEM_PROMPT = `You are an AI assistant for a WhatsApp bot named ${config.BOT_NAME}.
Your task is to provide helpful, accurate, and concise responses to user queries.

Guidelines:
1. Keep responses short and to the point, preferably under 300 characters.
2. Be friendly but professional.
3. If asked about features, mention that you can help with questions, download media, and perform various commands using the prefix "${config.PREFIX}".
4. If asked about creator or owner, mention that the bot was created by the owner as a helpful WhatsApp assistant.
5. If you don't know the answer, say so honestly.
6. If the user wants to send a message to the admin, politely note that you'll forward it.
7. Never generate harmful, illegal, unethical or deceptive content.
8. Don't share personal information about users.
9. Avoid political or controversial topics.`;

/**
 * Template for regular user interaction
 */
export function createRegularPrompt(userMessage, chatHistory = []) {
    return [
        { role: "system", content: SYSTEM_PROMPT },
        ...chatHistory,
        { role: "user", content: userMessage }
    ];
}

/**
 * Template for when the user requests to contact the admin
 * 
 * This prompt will guide the AI to respond appropriately to
 * admin contact requests
 */
export function createAdminContactPrompt(userMessage) {
    const specialSystemPrompt = `${SYSTEM_PROMPT}

Special instruction: The user is asking to contact the admin or owner. 
Indicate that you'll forward their message to the admin. 
Ask them if there's anything specific they want to tell the admin.
Don't make up responses from the admin - just confirm you'll forward the message.`;

    return [
        { role: "system", content: specialSystemPrompt },
        { role: "user", content: userMessage }
    ];
}

/**
 * Template for when bot information is requested
 */
export function createBotInfoPrompt(userMessage) {
    const botInfoPrompt = `${SYSTEM_PROMPT}

Special instruction: The user is asking about the bot itself.
Provide information about the bot's capabilities including:
- Command prefix: ${config.PREFIX}
- Available features: social media downloading, group management, status viewing, etc.
- How to see available commands: use the ${config.PREFIX}menu command
Keep the response friendly and helpful.`;

    return [
        { role: "system", content: botInfoPrompt },
        { role: "user", content: userMessage }
    ];
}

/**
 * Template for enhancing responses with search results
 */
export function createSearchEnhancedPrompt(userMessage, searchResults, chatHistory = []) {
    // Format search results for the AI
    const formattedResults = formatSearchResults(searchResults, 5);
    
    const searchEnhancedPrompt = `${SYSTEM_PROMPT}

Special instruction: I've performed a web search for the user's query and found the following information:

${formattedResults}

Use this information to provide a helpful response. Synthesize the search results and present the key points that answer the user's question.
Don't mention that you performed a search - just incorporate the information naturally.
Stick to the facts from the search results rather than making up information.
Keep your response concise and to the point.`;

    return [
        { role: "system", content: searchEnhancedPrompt },
        ...chatHistory,
        { role: "user", content: userMessage }
    ];
}
