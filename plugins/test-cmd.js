import { bot } from '../Lib/chat/commandHandler.js';
import message from '../Lib/chat/messageHandler.js';
import os from 'os';
import axios from 'axios';
import config from '../Config.js';

// Simple test command
bot({
    pattern: 'test',
    fromMe: false,
    desc: 'Test if the bot is working'
}, async (m, sock) => {
    await message.react('✅', m, sock);
    return await message.reply('Bot is working! 🤖', m, sock);
});

// System information command
bot({
    pattern: 'sysinfo',
    fromMe: true,
    desc: 'Get detailed system information'
}, async (m, sock) => {
    try {
        const cpus = os.cpus();
        const totalRam = os.totalmem();
        const freeRam = os.freemem();
        const uptime = os.uptime();
        
        let sysInfo = `💻 *System Information*\n\n`;
        sysInfo += `• OS: ${os.type()} ${os.release()}\n`;
        sysInfo += `• Architecture: ${os.arch()}\n`;
        sysInfo += `• Hostname: ${os.hostname()}\n`;
        sysInfo += `• CPU: ${cpus[0].model} (${cpus.length} cores)\n`;
        sysInfo += `• RAM: ${formatBytes(totalRam)} total / ${formatBytes(freeRam)} free\n`;
        sysInfo += `• Uptime: ${formatUptime(uptime)}\n\n`;
        
        sysInfo += `📊 *Process Info*\n\n`;
        
        const memUsage = process.memoryUsage();
        sysInfo += `• Node.js: ${process.version}\n`;
        sysInfo += `• Heap: ${formatBytes(memUsage.heapUsed)} / ${formatBytes(memUsage.heapTotal)}\n`;
        sysInfo += `• External: ${formatBytes(memUsage.external)}\n`;
        sysInfo += `• Process uptime: ${formatUptime(process.uptime())}\n`;
        
        return await message.reply(sysInfo, m, sock);
    } catch (error) {
        console.error('Error in sysinfo command:', error);
        return await message.reply(`Error getting system info: ${error.message}`, m, sock);
    }
});

// Test all message types command
bot({
    pattern: 'testall',
    fromMe: true,
    desc: 'Test all message types'
}, async (m, sock) => {
    try {
        await message.reply('Testing all message types...', m, sock);
        
        // Test text
        await message.reply('This is a text message test.', m, sock);
        
        // Test reaction
        await message.react('🎮', m, sock);
        
        // Test image
        await message.sendImage(
            'https://picsum.photos/200/300',
            'This is an image caption test.',
            m, sock
        );
        
        // Test video (using a sample video URL)
        await message.sendVideo(
            'https://sample-videos.com/video123/mp4/240/big_buck_bunny_240p_1mb.mp4',
            'This is a video caption test.',
            m, sock
        );
        
        // Test audio
        await message.sendAudio(
            'https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3',
            false,
            m, sock
        );
        
        // Test document
        await message.sendDocument(
            'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
            'test-document.pdf',
            'application/pdf',
            m, sock
        );
        
        await message.reply('All message types tested!', m, sock);
    } catch (error) {
        console.error('Error in testall command:', error);
        return await message.reply(`Error testing message types: ${error.message}`, m, sock);
    }
});

// Network test command
bot({
    pattern: 'netstat',
    fromMe: true,
    desc: 'Test network connectivity and latency'
}, async (m, sock) => {
    try {
        await message.react('⏳', m, sock);
        
        let netInfo = `🌐 *Network Status*\n\n`;
        
        // Test Google connectivity
        const startGoogle = Date.now();
        try {
            await axios.get('https://www.google.com', { timeout: 5000 });
            const googleTime = Date.now() - startGoogle;
            netInfo += `• Google: ✅ ${googleTime}ms\n`;
        } catch (error) {
            netInfo += `• Google: ❌ Failed\n`;
        }
        
        // Test WhatsApp connectivity
        const startWA = Date.now();
        try {
            await axios.get('https://web.whatsapp.com', { timeout: 5000 });
            const waTime = Date.now() - startWA;
            netInfo += `• WhatsApp: ✅ ${waTime}ms\n`;
        } catch (error) {
            netInfo += `• WhatsApp: ❌ Failed\n`;
        }
        
        // Network interfaces
        const interfaces = os.networkInterfaces();
        netInfo += `\n📡 *Network Interfaces*\n\n`;
        
        for (const [name, nets] of Object.entries(interfaces)) {
            for (const net of nets) {
                if (net.family === 'IPv4') {
                    netInfo += `• ${name}: ${net.address}\n`;
                }
            }
        }
        
        await message.reply(netInfo, m, sock);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error in netstat command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error testing network: ${error.message}`, m, sock);
    }
});

// Enhanced network test command with WhatsApp-specific diagnostics
bot({
    pattern: 'netdiag',
    fromMe: true,
    desc: 'Comprehensive network and WhatsApp connectivity diagnostics'
}, async (m, sock) => {
    try {
        await message.react('🔍', m, sock);
        
        let diagInfo = `🔬 *Network Diagnostics*\n\n`;
        
        // Test basic connectivity
        const tests = [
            { name: 'Google DNS', url: 'https://8.8.8.8', timeout: 3000 },
            { name: 'Google', url: 'https://www.google.com', timeout: 5000 },
            { name: 'WhatsApp Web', url: 'https://web.whatsapp.com', timeout: 5000 },
            { name: 'WhatsApp API', url: 'https://www.whatsapp.com', timeout: 5000 }
        ];
        
        for (const test of tests) {
            const start = Date.now();
            try {
                await axios.get(test.url, { 
                    timeout: test.timeout,
                    validateStatus: status => status < 500
                });
                const time = Date.now() - start;
                diagInfo += `✅ ${test.name}: ${time}ms\n`;
            } catch (error) {
                diagInfo += `❌ ${test.name}: ${error.code || 'Failed'}\n`;
            }
        }
        
        // Connection state info
        diagInfo += `\n📡 *Connection State*\n\n`;
        diagInfo += `• Socket State: ${sock?.ws?.readyState === 1 ? 'Connected' : 'Disconnected'}\n`;
        diagInfo += `• Auth State: ${sock?.authState?.creds ? 'Authenticated' : 'Not Authenticated'}\n`;
        diagInfo += `• User ID: ${sock?.user?.id || 'Unknown'}\n`;
        
        // Memory and system info
        const memUsage = process.memoryUsage();
        diagInfo += `\n💾 *System Resources*\n\n`;
        diagInfo += `• Heap Used: ${formatBytes(memUsage.heapUsed)}\n`;
        diagInfo += `• Heap Total: ${formatBytes(memUsage.heapTotal)}\n`;
        diagInfo += `• CPU Usage: ${process.cpuUsage().user / 1000}ms\n`;
        diagInfo += `• Uptime: ${formatUptime(process.uptime())}\n`;
        
        await message.reply(diagInfo, m, sock);
        await message.react('✅', m, sock);
    } catch (error) {
        console.error('Error in netdiag command:', error);
        await message.react('❌', m, sock);
        return await message.reply(`Error running diagnostics: ${error.message}`, m, sock);
    }
});

// Helper function to format bytes
function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return `${parseFloat((bytes / Math.pow(1024, i)).toFixed(2))} ${sizes[i]}`;
}

// Helper function to format uptime
function formatUptime(seconds) {
    const days = Math.floor(seconds / (3600 * 24));
    const hours = Math.floor((seconds % (3600 * 24)) / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    return `${days}d ${hours}h ${minutes}m ${secs}s`;
}
