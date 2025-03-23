/**
 * Memory monitoring utility for the WhatsApp bot
 * Helps track memory usage and prevent memory leaks
 */

// Store memory usage history
const memoryHistory = {
    readings: [],
    maxReadings: 100, // Keep only the last 100 readings
    startTime: Date.now(),
    warningThreshold: 500, // MB - Warning threshold
    criticalThreshold: 800, // MB - Critical threshold
    interval: null
};

// Format memory size to readable format
function formatMemorySize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    else if (bytes < 1048576) return (bytes / 1024).toFixed(2) + ' KB';
    else if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';
    else return (bytes / 1073741824).toFixed(2) + ' GB';
}

// Get current memory usage
function getMemoryUsage() {
    const memoryUsage = process.memoryUsage();
    
    return {
        timestamp: Date.now(),
        rss: memoryUsage.rss, // Resident Set Size - total memory allocated for the process
        heapTotal: memoryUsage.heapTotal, // Total size of allocated heap
        heapUsed: memoryUsage.heapUsed, // Actual memory used during execution
        external: memoryUsage.external, // Memory used by C++ objects bound to JavaScript
        arrayBuffers: memoryUsage.arrayBuffers || 0, // Memory used by ArrayBuffers and SharedArrayBuffers
        formatted: {
            rss: formatMemorySize(memoryUsage.rss),
            heapTotal: formatMemorySize(memoryUsage.heapTotal),
            heapUsed: formatMemorySize(memoryUsage.heapUsed),
            external: formatMemorySize(memoryUsage.external),
            arrayBuffers: formatMemorySize(memoryUsage.arrayBuffers || 0)
        }
    };
}

// Check for memory leaks or high usage
function checkMemoryHealth(memoryUsage) {
    const rssMB = memoryUsage.rss / 1048576; // Convert to MB
    
    if (rssMB > memoryHistory.criticalThreshold) {
        console.error(`CRITICAL MEMORY USAGE: ${rssMB.toFixed(2)} MB exceeds critical threshold of ${memoryHistory.criticalThreshold} MB`);
        return 'critical';
    } else if (rssMB > memoryHistory.warningThreshold) {
        console.warn(`HIGH MEMORY USAGE: ${rssMB.toFixed(2)} MB exceeds warning threshold of ${memoryHistory.warningThreshold} MB`);
        return 'warning';
    }
    
    return 'normal';
}

// Take a memory snapshot and store it
function takeMemorySnapshot() {
    const memoryUsage = getMemoryUsage();
    const health = checkMemoryHealth(memoryUsage);
    
    // Add to history
    memoryHistory.readings.push({
        ...memoryUsage,
        health
    });
    
    // Trim history if needed
    if (memoryHistory.readings.length > memoryHistory.maxReadings) {
        memoryHistory.readings.shift();
    }
    
    // If we're in critical state, try to force garbage collection
    if (health === 'critical' && global.gc) {
        console.log('Forcing garbage collection due to critical memory usage');
        global.gc();
    }
    
    return { memoryUsage, health };
}

// Start memory monitoring
function startMonitoring(intervalMs = 60000) { // Default: every minute
    if (memoryHistory.interval) {
        clearInterval(memoryHistory.interval);
    }
    
    console.log(`Starting memory monitoring with ${intervalMs}ms interval`);
    
    // Take initial snapshot
    takeMemorySnapshot();
    
    // Set up interval
    memoryHistory.interval = setInterval(() => {
        takeMemorySnapshot();
    }, intervalMs);
    
    return memoryHistory.interval;
}

// Stop memory monitoring
function stopMonitoring() {
    if (memoryHistory.interval) {
        clearInterval(memoryHistory.interval);
        memoryHistory.interval = null;
        console.log('Memory monitoring stopped');
    }
}

// Get memory statistics
function getMemoryStats() {
    const currentUsage = getMemoryUsage();
    const uptime = Date.now() - memoryHistory.startTime;
    
    // Calculate memory growth rate (MB per hour) based on history
    let growthRate = 0;
    if (memoryHistory.readings.length > 1) {
        const first = memoryHistory.readings[0];
        const latest = memoryHistory.readings[memoryHistory.readings.length - 1];
        const mbDiff = (latest.rss - first.rss) / 1048576;
        const hoursDiff = (latest.timestamp - first.timestamp) / 3600000;
        
        if (hoursDiff > 0) {
            growthRate = mbDiff / hoursDiff;
        }
    }
    
    return {
        current: currentUsage,
        uptime: {
            ms: uptime,
            seconds: Math.floor(uptime / 1000),
            minutes: Math.floor(uptime / 60000),
            hours: Math.floor(uptime / 3600000),
            days: Math.floor(uptime / 86400000)
        },
        history: {
            readings: memoryHistory.readings.length,
            oldest: memoryHistory.readings[0]?.timestamp || null,
            newest: memoryHistory.readings[memoryHistory.readings.length - 1]?.timestamp || null
        },
        analysis: {
            growthRateMBPerHour: growthRate.toFixed(2),
            thresholds: {
                warning: memoryHistory.warningThreshold + ' MB',
                critical: memoryHistory.criticalThreshold + ' MB'
            }
        }
    };
}

// Configure memory thresholds
function configureThresholds(warningMB, criticalMB) {
    if (warningMB && warningMB > 0) {
        memoryHistory.warningThreshold = warningMB;
    }
    
    if (criticalMB && criticalMB > 0) {
        memoryHistory.criticalThreshold = criticalMB;
    }
    
    console.log(`Memory thresholds set: Warning=${memoryHistory.warningThreshold}MB, Critical=${memoryHistory.criticalThreshold}MB`);
}

// Export the memory monitoring API
export default {
    getMemoryUsage,
    startMonitoring,
    stopMonitoring,
    takeMemorySnapshot,
    getMemoryStats,
    configureThresholds,
    formatMemorySize
};
