/**
 * API Key Rotation System
 * Helps manage and rotate between multiple API keys to prevent rate limiting
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Key management for different services
const keyManager = {
    // Store API keys and their usage stats
    keys: {
        groq: []
    },
    
    // Configuration
    config: {
        groq: {
            keysPath: path.join(__dirname, '../../data/groq_keys.json'),
            requestsPerKey: 100, // Maximum requests per key per rotation period
            rotationPeriod: 60 * 60 * 1000, // 1 hour in milliseconds
            resetInterval: null
        }
    }
};

/**
 * Initialize the key manager for a specific service
 * @param {string} service - Service name (e.g., 'groq')
 * @param {Object} config - Configuration for the service
 */
function initKeyManager(service, config = {}) {
    // Merge with existing config
    keyManager.config[service] = {
        ...keyManager.config[service],
        ...config
    };
    
    // Create keys directory if it doesn't exist
    const dataDir = path.dirname(keyManager.config[service].keysPath);
    if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
    }
    
    // Load keys for the service
    loadKeys(service);
    
    // Start automatic reset timer if not already running
    if (!keyManager.config[service].resetInterval) {
        keyManager.config[service].resetInterval = setInterval(() => {
            resetRequestCounts(service);
        }, keyManager.config[service].rotationPeriod);
    }
    
    console.log(`API key rotation initialized for ${service} with ${keyManager.keys[service].length} keys`);
    return keyManager.keys[service].length > 0;
}

/**
 * Load API keys from the file
 * @param {string} service - Service name (e.g., 'groq')
 */
function loadKeys(service) {
    const keysPath = keyManager.config[service].keysPath;
    
    try {
        if (fs.existsSync(keysPath)) {
            const keysData = JSON.parse(fs.readFileSync(keysPath, 'utf8'));
            keyManager.keys[service] = keysData;
            console.log(`Loaded ${keysData.length} ${service} API keys`);
        } else {
            // Create empty keys file if it doesn't exist
            keyManager.keys[service] = [];
            saveKeys(service);
            console.log(`Created empty ${service} API keys file`);
        }
    } catch (error) {
        console.error(`Error loading ${service} API keys:`, error);
        keyManager.keys[service] = [];
    }
}

/**
 * Save API keys to the file
 * @param {string} service - Service name (e.g., 'groq')
 */
function saveKeys(service) {
    const keysPath = keyManager.config[service].keysPath;
    
    try {
        fs.writeFileSync(keysPath, JSON.stringify(keyManager.keys[service], null, 2));
    } catch (error) {
        console.error(`Error saving ${service} API keys:`, error);
    }
}

/**
 * Add a new API key
 * @param {string} service - Service name (e.g., 'groq')
 * @param {string} key - The API key to add
 * @param {string} name - Optional name/description for the key
 * @returns {boolean} - Success status
 */
function addKey(service, key, name = '') {
    if (!keyManager.keys[service]) {
        keyManager.keys[service] = [];
    }
    
    // Check if key already exists
    const existingKey = keyManager.keys[service].find(k => k.key === key);
    if (existingKey) {
        console.log(`Key already exists for ${service}: ${key.substring(0, 4)}...`);
        return false;
    }
    
    // Add the new key
    keyManager.keys[service].push({
        key,
        name,
        added: Date.now(),
        requests: 0,
        lastUsed: null,
        enabled: true
    });
    
    // Save keys
    saveKeys(service);
    console.log(`Added new ${service} API key: ${key.substring(0, 4)}...`);
    return true;
}

/**
 * Remove an API key
 * @param {string} service - Service name (e.g., 'groq')
 * @param {string} key - The API key to remove
 * @returns {boolean} - Success status
 */
function removeKey(service, key) {
    if (!keyManager.keys[service]) {
        return false;
    }
    
    // Find key index
    const keyIndex = keyManager.keys[service].findIndex(k => k.key === key);
    if (keyIndex === -1) {
        return false;
    }
    
    // Remove the key
    keyManager.keys[service].splice(keyIndex, 1);
    
    // Save keys
    saveKeys(service);
    console.log(`Removed ${service} API key: ${key.substring(0, 4)}...`);
    return true;
}

/**
 * Get the next available API key
 * @param {string} service - Service name (e.g., 'groq')
 * @returns {string|null} - The API key or null if none available
 */
function getNextKey(service) {
    if (!keyManager.keys[service] || keyManager.keys[service].length === 0) {
        console.log(`No API keys available for ${service}`);
        return null;
    }
    
    // Get the maximum requests per key
    const maxRequests = keyManager.config[service].requestsPerKey;
    
    // Find a key that hasn't reached the request limit
    const availableKey = keyManager.keys[service].find(k => 
        k.enabled && k.requests < maxRequests
    );
    
    if (!availableKey) {
        console.warn(`All ${service} API keys have reached their request limit`);
        return null;
    }
    
    // Update key usage
    availableKey.requests += 1;
    availableKey.lastUsed = Date.now();
    
    // Save keys
    saveKeys(service);
    
    return availableKey.key;
}

/**
 * Reset request counts for all keys of a service
 * @param {string} service - Service name (e.g., 'groq')
 */
function resetRequestCounts(service) {
    if (!keyManager.keys[service]) {
        return;
    }
    
    // Reset request counts
    keyManager.keys[service].forEach(key => {
        key.requests = 0;
    });
    
    // Save keys
    saveKeys(service);
    console.log(`Reset request counts for ${service} API keys`);
}

/**
 * Enable or disable a specific API key
 * @param {string} service - Service name (e.g., 'groq')
 * @param {string} key - The API key to enable/disable
 * @param {boolean} enabled - Whether to enable or disable the key
 * @returns {boolean} - Success status
 */
function setKeyEnabled(service, key, enabled) {
    if (!keyManager.keys[service]) {
        return false;
    }
    
    // Find the key
    const keyObj = keyManager.keys[service].find(k => k.key === key);
    if (!keyObj) {
        return false;
    }
    
    // Update enabled status
    keyObj.enabled = enabled;
    
    // Save keys
    saveKeys(service);
    console.log(`${enabled ? 'Enabled' : 'Disabled'} ${service} API key: ${key.substring(0, 4)}...`);
    return true;
}

/**
 * Get usage statistics for all keys of a service
 * @param {string} service - Service name (e.g., 'groq')
 * @returns {Object} - Key usage statistics
 */
function getKeyStats(service) {
    if (!keyManager.keys[service]) {
        return {
            totalKeys: 0,
            enabledKeys: 0,
            totalRequests: 0,
            keys: []
        };
    }
    
    // Calculate statistics
    const totalKeys = keyManager.keys[service].length;
    const enabledKeys = keyManager.keys[service].filter(k => k.enabled).length;
    const totalRequests = keyManager.keys[service].reduce((sum, k) => sum + k.requests, 0);
    
    // Prepare key info (excluding the actual key for security)
    const keys = keyManager.keys[service].map(k => ({
        id: k.key.substring(0, 4) + '...',
        name: k.name,
        enabled: k.enabled,
        requests: k.requests,
        lastUsed: k.lastUsed,
        added: k.added
    }));
    
    return {
        totalKeys,
        enabledKeys,
        totalRequests,
        config: {
            requestsPerKey: keyManager.config[service].requestsPerKey,
            rotationPeriod: keyManager.config[service].rotationPeriod
        },
        keys
    };
}

// Add primary API key from config
function addPrimaryKey(service, apiKey, name = 'Primary') {
    if (apiKey && apiKey.length > 0) {
        addKey(service, apiKey, name);
    }
}

// Export the API
export default {
    initKeyManager,
    addKey,
    removeKey,
    getNextKey,
    resetRequestCounts,
    setKeyEnabled,
    getKeyStats,
    addPrimaryKey
};
