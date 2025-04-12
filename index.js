import { connectToWhatsApp } from './Bot.js';
import config from './Config.js';

// Initialize global variables
global.sock = null;

// Import admin server if not in cluster mode or we're an admin worker
if (!global.CLUSTER_MODE || !global.IS_PRIMARY_BOT) {
  import('./admin/server.js');
}

// Import new utilities
import memoryMonitor from './Lib/utils/memoryMonitor.js';
import apiKeyRotation from './Lib/ai/apiKeyRotation.js';
import responseCache from './Lib/ai/responseCache.js';
import { startOnlinePresence, stopOnlinePresence } from './Lib/utils/presenceManager.js';

// Create necessary directories
config.createDirectories();

// Define getSystemStats at the top level of the module
function getSystemStats() {
    return {
        memory: memoryMonitor?.getMemoryStats() || { status: 'Not initialized' },
        cache: responseCache?.getCacheStats() || { status: 'Not initialized' },
        apiKeys: apiKeyRotation?.getKeyStats('groq') || { status: 'Not initialized' },
        aiStats: global.aiStats || { status: 'Not initialized' },
        systemUptime: process.uptime(),
        cluster: {
          mode: global.CLUSTER_MODE || false,
          isPrimary: global.IS_PRIMARY_BOT || false,
          workerId: global.BOT_WORKER_ID || 0,
          workerCount: global.BOT_WORKER_COUNT || 1
        }
    };
}

// Export getSystemStats at the top level
export { getSystemStats };

// Modify the startup to be cluster-aware
console.log(`Starting WhatsApp bot in ${process.env.PROCESS_ROLE || 'standalone'} mode (PID: ${process.pid})`);

// Check if we're running in cluster mode and what our role is
if (global.CLUSTER_MODE) {
  console.log(`Running in cluster mode as ${global.IS_PRIMARY_BOT ? 'primary' : 'worker'} bot (ID: ${global.BOT_WORKER_ID})`);
  
  // Set up IPC messaging for worker coordination
  process.on('message', async (msg) => {
    if (msg.type === 'bot_command') {
      console.log(`Worker ${process.pid} received bot command:`, msg.command);
      // Handle bot commands
    } else if (msg.type === 'task_dispatch' && !global.IS_PRIMARY_BOT) {
      console.log(`Worker ${process.pid} received task:`, msg.taskId);
      // Handle specific bot tasks
    }
  });
}

// Only start the WhatsApp connection in the main bot process
if (!global.CLUSTER_MODE || global.IS_PRIMARY_BOT) {
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

  // When bot is started and socket is ready
  startOnlinePresence(sock);

  // Handle process termination
  process.on('SIGINT', async () => {
    console.log('Shutting down bot...');
    // Stop online presence updates
    stopOnlinePresence();
    process.exit(0);
  });
} else {
  console.log(`Bot worker ${global.BOT_WORKER_ID} ready to process tasks`);
  
  // Initialize minimal services needed by worker processes
  // This could include caches, specific API clients, etc.
}

// Handle uncaught exceptions and unhandled rejections
process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
