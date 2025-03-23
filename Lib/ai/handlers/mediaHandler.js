import message from '../../chat/messageHandler.js';

/**
 * Send wallpaper images to the user
 * 
 * @param {Object} m - Message object
 * @param {Object} sock - Socket object
 * @param {Array} wallpapers - Array of wallpaper results
 */
export async function sendWallpaperImages(m, sock, wallpapers) {
    if (!wallpapers || wallpapers.length === 0) {
        console.log("No wallpapers to send");
        return;
    }
    
    try {
        // Show typing indicator
        await sock.sendPresenceUpdate('composing', m.key.remoteJid);
        
        console.log(`Preparing to send ${Math.min(wallpapers.length, 3)} wallpapers`);
        
        // Send up to 3 images to avoid spamming
        const wallpapersToSend = wallpapers.slice(0, 3);
        
        for (let i = 0; i < wallpapersToSend.length; i++) {
            const wallpaper = wallpapersToSend[i];
            
            try {
                console.log(`Sending wallpaper ${i+1}/${wallpapersToSend.length}: ${wallpaper.image}`);
                
                // Verify the image URL is valid
                if (!wallpaper.image || !wallpaper.image.startsWith('http')) {
                    console.log(`Invalid image URL for wallpaper ${i+1}: ${wallpaper.image}`);
                    continue;
                }
                
                // Add a small delay between sending images
                if (i > 0) {
                    await new Promise(resolve => setTimeout(resolve, 1000));
                    await sock.sendPresenceUpdate('composing', m.key.remoteJid);
                }
                
                // Send the image
                await message.sendImage(
                    wallpaper.image,
                    i === 0 ? "Wallpaper found for you" : "", // Add caption only to first image
                    m,
                    sock
                );
                
                console.log(`Successfully sent wallpaper ${i+1}`);
                
            } catch (error) {
                console.error(`Error sending wallpaper ${i+1}:`, error);
            }
        }
        
        // React with success emoji after sending all wallpapers
        await message.react('✨', m, sock); // Changed from ✅ to ✨ (sparkles)
        
        // Clear typing indicator after all wallpapers are sent
        await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        
    } catch (error) {
        console.error('Error in sendWallpaperImages:', error);
        
        // If error sending images, let the user know
        try {
            await message.reply("I found some wallpapers but had trouble sending them. Please try again.", m, sock);
            await message.react('😔', m, sock); // Add sad face reaction on error
            // Make sure to clear typing indicator even after error
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        } catch (replyError) {
            console.error('Error sending error message:', replyError);
            // Last resort attempt to clear typing indicator
            await sock.sendPresenceUpdate('paused', m.key.remoteJid);
        }
    }
}

// Admin message forwarding function has been removed
