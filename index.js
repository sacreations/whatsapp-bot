import { connectToWhatsApp } from './Bot.js';
import config from './Config.js';

// Initialize global variables
global.sock = null;

// Import admin server
import './admin/server.js';

// Import new utilities
import memoryMonitor from './Lib/utils/memoryMonitor.js';
import apiKeyRotation from './Lib/ai/apiKeyRotation.js';
import responseCache from './Lib/ai/responseCache.js';
import { startOnlinePresence, stopOnlinePresence } from './Lib/utils/presenceManager.js';

// Create necessary directories
config.createDirectories();

// Start the bot
console.log(`Starting ${config.BOT_NAME}...`);
connectToWhatsApp().catch(err => console.error('Unexpected error starting bot:', err));

// Initialize the WhatsApp bot
async function initializeBot() {
    // Initialize memory monitoring (check every 5 minutes)
    memoryMonitor.startMonitoring(5 * 60 * 1000);
    console.log('Memory monitoring started');
    
    // Initialize API key rotation with primary key from config
    apiKeyRotation.initKeyManager('groq', {
        requestsPerKey: 200, // Configure requests per key
        rotationPeriod: 60 * 60 * 1000 // 1 hour
    });
    
    // Add primary API key from config
    apiKeyRotation.addPrimaryKey('groq', config.GROQ_API_KEY, 'Primary Config Key');
    
    // Initialize response cache
    responseCache.initCache({
        maxSize: 500 // Maximum entries in memory
    });
}

// Initialize global AI stats if not already present
if (!global.aiStats) {
    global.aiStats = {
        messagesProcessed: 0,
        searchesPerformed: 0,
        cacheHits: 0,
        cacheMisses: 0,
        bingSearchesFallback: 0
    };
}

// Add memory stats to admin API
function getSystemStats() {
    return {
        memory: memoryMonitor.getMemoryStats(),
        cache: responseCache.getCacheStats(),
        apiKeys: apiKeyRotation.getKeyStats('groq'),
        aiStats: global.aiStats,
        systemUptime: process.uptime()
    };
}

// Export getSystemStats for the admin panel
export { getSystemStats };

// When bot is started and socket is ready
startOnlinePresence(sock);

// Handle process termination
process.on('SIGINT', async () => {
    console.log('Shutting down bot...');
    // Stop online presence updates
    stopOnlinePresence();
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
