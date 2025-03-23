/**
 * AI Response Caching System
 * Caches responses to common queries to reduce API costs and improve response time
 */

import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

// Get current directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache configuration
const cacheConfig = {
    enabled: true,
    maxSize: 1000, // Maximum number of entries in memory cache
    ttl: 24 * 60 * 60 * 1000, // Default TTL: 24 hours in milliseconds
    persistentPath: path.join(__dirname, '../../data/ai_cache.json'),
    persistenceInterval: 15 * 60 * 1000, // 15 minutes in milliseconds
    saveInterval: null,
    factQueries: 3 * 24 * 60 * 60 * 1000, // 3 days for factual queries
    conversationalQueries: 12 * 60 * 60 * 1000 // 12 hours for conversational
};

// In-memory cache
const memoryCache = {
    entries: new Map(),
    stats: {
        hits: 0,
        misses: 0,
        added: 0,
        expired: 0,
        size: 0
    }
};

/**
 * Generate a consistent hash for a query and its context
 * @param {string} query - The query text
 * @param {Object} options - Additional options to include in the hash
 * @returns {string} - Hash string
 */
function generateQueryHash(query, options = {}) {
    // Normalize query text (lowercase, remove extra whitespace)
    const normalizedQuery = query.toLowerCase().trim().replace(/\s+/g, ' ');
    
    // Create a string to hash including the query and relevant options
    let hashSource = normalizedQuery;
    
    // Add relevant context to hash if provided
    if (options.model) hashSource += `|model:${options.model}`;
    if (options.temperature) hashSource += `|temp:${options.temperature}`;
    
    // Generate SHA-256 hash
    return crypto.createHash('sha256').update(hashSource).digest('hex');
}

/**
 * Initialize the cache
 * @param {Object} config - Optional configuration overrides
 */
function initCache(config = {}) {
    // Apply custom configuration
    Object.assign(cacheConfig, config);
    
    // Create directory if it doesn't exist
    const cacheDir = path.dirname(cacheConfig.persistentPath);
    if (!fs.existsSync(cacheDir)) {
        fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    // Load persistent cache
    loadPersistentCache();
    
    // Set up persistence interval
    if (!cacheConfig.saveInterval && cacheConfig.persistenceInterval > 0) {
        cacheConfig.saveInterval = setInterval(() => {
            savePersistentCache();
        }, cacheConfig.persistenceInterval);
    }
    
    console.log(`AI response cache initialized with ${memoryCache.entries.size} entries`);
    return true;
}

/**
 * Load persistent cache from disk
 */
function loadPersistentCache() {
    try {
        if (fs.existsSync(cacheConfig.persistentPath)) {
            const rawData = fs.readFileSync(cacheConfig.persistentPath, 'utf8');
            const cacheData = JSON.parse(rawData);
            
            // Reset entries map
            memoryCache.entries.clear();
            
            // Restore entries and check expiration
            let validCount = 0;
            let expiredCount = 0;
            
            // Parse the entries array and restore to Map
            if (Array.isArray(cacheData.entries)) {
                cacheData.entries.forEach(([key, value]) => {
                    // Check if entry is expired
                    if (value.expires > Date.now()) {
                        memoryCache.entries.set(key, value);
                        validCount++;
                    } else {
                        expiredCount++;
                    }
                });
            }
            
            // Restore stats
            if (cacheData.stats) {
                memoryCache.stats = { ...cacheData.stats };
                memoryCache.stats.expired += expiredCount;
                memoryCache.stats.size = validCount;
            }
            
            console.log(`Loaded ${validCount} cache entries from disk (${expiredCount} expired entries removed)`);
        } else {
            console.log('No persistent cache file found, starting with empty cache');
        }
    } catch (error) {
        console.error('Error loading persistent cache:', error);
    }
}

/**
 * Save persistent cache to disk
 */
function savePersistentCache() {
    try {
        // Convert entries Map to array for JSON serialization
        const entries = Array.from(memoryCache.entries);
        
        // Prepare data to save
        const cacheData = {
            entries,
            stats: memoryCache.stats,
            savedAt: Date.now()
        };
        
        // Write to file
        fs.writeFileSync(cacheConfig.persistentPath, JSON.stringify(cacheData));
        console.log(`Saved ${memoryCache.entries.size} cache entries to disk`);
        return true;
    } catch (error) {
        console.error('Error saving persistent cache:', error);
        return false;
    }
}

/**
 * Check if a query result is in the cache
 * @param {string} query - The query text
 * @param {Object} options - Additional options to include in the hash
 * @returns {Object|null} - The cached result or null if not found
 */
function getCachedResponse(query, options = {}) {
    if (!cacheConfig.enabled) {
        return null;
    }
    
    // Generate hash
    const queryHash = generateQueryHash(query, options);
    
    // Look up in cache
    const cachedEntry = memoryCache.entries.get(queryHash);
    
    // Check if entry exists and is not expired
    if (cachedEntry && cachedEntry.expires > Date.now()) {
        // Update hit count and last access
        cachedEntry.hits += 1;
        cachedEntry.lastAccess = Date.now();
        
        // Update stats
        memoryCache.stats.hits += 1;
        
        return cachedEntry.data;
    }
    
    // If entry is expired, remove it
    if (cachedEntry) {
        memoryCache.entries.delete(queryHash);
        memoryCache.stats.expired += 1;
        memoryCache.stats.size -= 1;
    }
    
    // No valid cache entry found
    memoryCache.stats.misses += 1;
    return null;
}

/**
 * Store a query result in the cache
 * @param {string} query - The query text
 * @param {Object} result - The result to cache
 * @param {Object} options - Additional options for caching
 * @returns {boolean} - Success status
 */
function cacheResponse(query, result, options = {}) {
    if (!cacheConfig.enabled || !result) {
        return false;
    }
    
    // Generate hash
    const queryHash = generateQueryHash(query, options);
    
    // Determine TTL based on query characteristics
    let ttl = cacheConfig.ttl;
    
    // Adjust TTL based on query type if not explicitly provided
    if (!options.ttl) {
        if (isFactualQuery(query)) {
            ttl = cacheConfig.factQueries;
        } else {
            ttl = cacheConfig.conversationalQueries;
        }
    } else {
        ttl = options.ttl;
    }
    
    // Create cache entry
    const cacheEntry = {
        query,
        data: result,
        created: Date.now(),
        expires: Date.now() + ttl,
        hits: 0,
        lastAccess: null,
        queryType: isFactualQuery(query) ? 'factual' : 'conversational'
    };
    
    // Add to cache
    memoryCache.entries.set(queryHash, cacheEntry);
    
    // Update stats
    memoryCache.stats.added += 1;
    memoryCache.stats.size = memoryCache.entries.size;
    
    // Check if cache exceeds max size
    if (memoryCache.entries.size > cacheConfig.maxSize) {
        pruneCache();
    }
    
    return true;
}

/**
 * Determine if a query is factual in nature
 * @param {string} query - The query text
 * @returns {boolean} - True if the query appears to be factual
 */
function isFactualQuery(query) {
    const normalizedQuery = query.toLowerCase().trim();
    
    // Patterns that suggest factual queries
    const factualPatterns = [
        /^who is /, /^who was /, /^who are /,
        /^what is /, /^what are /, /^what was /,
        /^when is /, /^when was /, /^when are /,
        /^where is /, /^where was /, /^where are /,
        /^which is /, /^which was /, /^which are /,
        /^how many /, /^how much /, /^how old /,
        /capital of /, /population of /, /founded in /,
        /born in /, /died in /, /inventor of /,
        /discovery of /, /definition of /, /meaning of /
    ];
    
    // Check if any pattern matches
    return factualPatterns.some(pattern => pattern.test(normalizedQuery));
}

/**
 * Remove the least valuable entries when cache exceeds size limit
 */
function pruneCache() {
    if (memoryCache.entries.size <= cacheConfig.maxSize) {
        return;
    }
    
    console.log(`Pruning cache from ${memoryCache.entries.size} entries down to ${cacheConfig.maxSize}`);
    
    // Get all entries as array
    const entries = Array.from(memoryCache.entries);
    
    // Calculate value for each entry (combination of hits, recency, and remaining TTL)
    const scoredEntries = entries.map(([key, entry]) => {
        const age = Date.now() - entry.created;
        const ttlRemaining = Math.max(0, entry.expires - Date.now());
        const lastAccessRecency = entry.lastAccess ? (Date.now() - entry.lastAccess) : age;
        
        // Score formula: hits * ttlFactor * recencyFactor
        // This favors: 1) frequently accessed entries, 2) entries with more TTL remaining
        // and 3) recently accessed entries
        const ttlFactor = ttlRemaining / cacheConfig.ttl; // 0-1 factor
        const recencyFactor = Math.max(0.1, 1 - (lastAccessRecency / age)); // 0.1-1 factor
        const score = (entry.hits + 1) * ttlFactor * recencyFactor;
        
        return { key, score };
    });
    
    // Sort by score (ascending - lowest scores first)
    scoredEntries.sort((a, b) => a.score - b.score);
    
    // Remove lowest-scoring entries until we're under maxSize
    const entriesToRemove = memoryCache.entries.size - cacheConfig.maxSize;
    for (let i = 0; i < entriesToRemove; i++) {
        if (i < scoredEntries.length) {
            memoryCache.entries.delete(scoredEntries[i].key);
        }
    }
    
    // Update size stat
    memoryCache.stats.size = memoryCache.entries.size;
}

/**
 * Clear all cache entries
 */
function clearCache() {
    memoryCache.entries.clear();
    
    // Update stats
    memoryCache.stats.size = 0;
    
    console.log('Cache cleared');
    return true;
}

/**
 * Get cache statistics
 * @returns {Object} - Cache statistics
 */
function getCacheStats() {
    return {
        enabled: cacheConfig.enabled,
        size: memoryCache.entries.size,
        maxSize: cacheConfig.maxSize,
        stats: { ...memoryCache.stats },
        config: {
            ttl: cacheConfig.ttl,
            factQueries: cacheConfig.factQueries,
            conversationalQueries: cacheConfig.conversationalQueries
        }
    };
}

// Export the API
export default {
    initCache,
    getCachedResponse,
    cacheResponse,
    clearCache,
    getCacheStats,
    savePersistentCache
};
