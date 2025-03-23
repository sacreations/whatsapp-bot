import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import os from 'os';

const execAsync = promisify(exec);

async function setupYtDlp() {
    console.log('Setting up yt-dlp for direct media downloads...');
    
    const isWindows = os.platform() === 'win32';
    const binDir = path.join(process.cwd(), 'bin');
    
    // Create bin directory if it doesn't exist
    if (!fs.existsSync(binDir)) {
        fs.mkdirSync(binDir, { recursive: true });
    }
    
    try {
        if (isWindows) {
            // Download yt-dlp.exe for Windows
            const ytdlpUrl = 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe';
            const ytdlpPath = path.join(binDir, 'yt-dlp.exe');
            
            console.log('Downloading yt-dlp.exe...');
            await execAsync(`curl -L ${ytdlpUrl} -o "${ytdlpPath}"`);
            
            console.log('yt-dlp.exe downloaded successfully');
            console.log('You can use it with: .\\bin\\yt-dlp.exe');
        } else {
            // For Linux/macOS
            console.log('Installing yt-dlp via pip...');
            await execAsync('pip install yt-dlp');
            
            console.log('Making yt-dlp executable...');
            await execAsync('chmod a+rx $(which yt-dlp)`);
            
            console.log('yt-dlp installed successfully');
        }
        
        console.log('yt-dlp setup complete. The bot will now use direct downloads without FFmpeg processing.');
        console.log('Setup completed successfully!');
    } catch (error) {
        console.error('Error setting up yt-dlp:', error);
        console.log('You can manually install yt-dlp from: https://github.com/yt-dlp/yt-dlp#installation');
    }
}

setupYtDlp().catch(error => {
    console.error('Setup failed:', error);
});
