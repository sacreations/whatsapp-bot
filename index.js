import { connectToWhatsApp } from './Bot.js';
import config from './Config.js';

// Import admin server
import './admin/server.js';

// Create necessary directories
config.createDirectories();

// Start the bot
console.log(`Starting ${config.BOT_NAME}...`);
connectToWhatsApp().catch(err => console.error('Unexpected error starting bot:', err));

// Handle process termination
process.on('SIGINT', () => {
    console.log('Shutting down...');
    process.exit(0);
});

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
