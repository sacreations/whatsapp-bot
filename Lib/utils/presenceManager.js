import config from '../../Config.js';

let presenceInterval = null;
let currentSock = null;

/**
 * Start sending regular online presence updates
 * @param {Object} sock - WhatsApp socket connection
 */
export function startOnlinePresence(sock) {
    // Store the socket for later use
    currentSock = sock;
    
    // Clear any existing interval
    stopOnlinePresence();
    
    console.log('Starting always online presence updates');
    
    // Set up an interval to update presence status regularly
    presenceInterval = setInterval(() => {
        updateOnlinePresence();
    }, 60000); // Update every 60 seconds
    
    // Update immediately on start
    updateOnlinePresence();
}

/**
 * Update the bot's presence status to "available" (online)
 */
function updateOnlinePresence() {
    if (!currentSock) return;
    
    try {
        // Send "available" presence update to show as online
        currentSock.sendPresenceUpdate('available');
        
        if (config.DEBUG_MODE) {
            console.log('Updated presence status: online');
        }
    } catch (error) {
        console.error('Failed to update online presence:', error);
    }
}

/**
 * Stop sending online presence updates
 */
export function stopOnlinePresence() {
    if (presenceInterval) {
        clearInterval(presenceInterval);
        presenceInterval = null;
        console.log('Stopped online presence updates');
    }
}

/**
 * Update the socket reference when reconnecting
 * @param {Object} sock - New WhatsApp socket connection
 */
export function updateSocketReference(sock) {
    currentSock = sock;
}
