import { redisClient } from '../config/redis.config.js';
import logger from '../config/logger.js';
import performanceMonitor from './performance-monitor.service.js';
import crypto from 'crypto';

/**
 * CacheService - Manages Redis caching operations
 * Provides cache get/set/delete operations with TTL management
 */
class CacheService {
    constructor() {
        this.defaultTTL = 300; // 5 minutes in seconds
        this.prefixes = {
            search: 'search:',
            auction: 'auction:',
            user: 'user:',
            session: 'session:',
            recommendations: 'recommendations:',
            analytics: 'analytics:',
            aiPrediction: 'ai:prediction:'
        };
        
        // TTL configurations for different data types (in seconds)
        this.ttlConfig = {
            session: 900,        // 15 minutes
            auction: 300,        // 5 minutes
            search: 300,         // 5 minutes
            aiPrediction: 3600,  // 1 hour
            analytics: 3600,     // 1 hour
            user: 900,           // 15 minutes
            recommendations: 3600 // 1 hour
        };
    }

    /**
     * Generate cache key from search parameters
     * @param {Object} params - Search parameters
     * @returns {string} Cache key
     */
    generateSearchKey(params) {
        // Create a deterministic key from search params
        const sortedParams = Object.keys(params)
            .sort()
            .reduce((acc, key) => {
                if (params[key] !== undefined && params[key] !== null) {
                    acc[key] = params[key];
                }
                return acc;
            }, {});
        
        const paramString = JSON.stringify(sortedParams);
        const hash = crypto.createHash('md5').update(paramString).digest('hex');
        return `${this.prefixes.search}${hash}`;
    }

    /**
     * Get cached data
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Cached data or null
     */
    async get(key) {
        const startTime = Date.now();
        try {
            const cached = await redisClient.get(key);
            const duration = Date.now() - startTime;
            
            if (cached) {
                logger.debug(`Cache hit: ${key}`);
                performanceMonitor.trackCacheOperation({
                    operation: 'get',
                    key,
                    hit: true,
                    duration
                });
                return JSON.parse(cached);
            }
            
            logger.debug(`Cache miss: ${key}`);
            performanceMonitor.trackCacheOperation({
                operation: 'get',
                key,
                hit: false,
                duration
            });
            return null;
        } catch (error) {
            logger.error(`Error reading from cache (${key}):`, error.message);
            const duration = Date.now() - startTime;
            performanceMonitor.trackCacheOperation({
                operation: 'get',
                key,
                hit: false,
                duration
            });
            return null;
        }
    }

    /**
     * Set cached data with TTL
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @param {number} ttl - Time to live in seconds (optional)
     * @returns {Promise<boolean>} Success status
     */
    async set(key, data, ttl = this.defaultTTL) {
        const startTime = Date.now();
        try {
            await redisClient.setex(key, ttl, JSON.stringify(data));
            const duration = Date.now() - startTime;
            
            logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
            performanceMonitor.trackCacheOperation({
                operation: 'set',
                key,
                duration
            });
            return true;
        } catch (error) {
            logger.error(`Error writing to cache (${key}):`, error.message);
            const duration = Date.now() - startTime;
            performanceMonitor.trackCacheOperation({
                operation: 'set',
                key,
                duration
            });
            return false;
        }
    }

    /**
     * Delete cached data
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        const startTime = Date.now();
        try {
            await redisClient.del(key);
            const duration = Date.now() - startTime;
            
            logger.debug(`Cache deleted: ${key}`);
            performanceMonitor.trackCacheOperation({
                operation: 'delete',
                key,
                duration
            });
            return true;
        } catch (error) {
            logger.error(`Error deleting from cache (${key}):`, error.message);
            const duration = Date.now() - startTime;
            performanceMonitor.trackCacheOperation({
                operation: 'delete',
                key,
                duration
            });
            return false;
        }
    }

    /**
     * Delete all keys matching a pattern
     * @param {string} pattern - Key pattern (e.g., 'search:*')
     * @returns {Promise<number>} Number of keys deleted
     */
    async deletePattern(pattern) {
        try {
            const keys = await redisClient.keys(pattern);
            if (keys.length > 0) {
                await redisClient.del(...keys);
                logger.info(`Cache invalidated: ${keys.length} keys matching ${pattern}`);
                return keys.length;
            }
            return 0;
        } catch (error) {
            logger.error(`Error deleting cache pattern (${pattern}):`, error.message);
            return 0;
        }
    }

    /**
     * Invalidate all search caches
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidateSearchCache() {
        return await this.deletePattern(`${this.prefixes.search}*`);
    }

    /**
     * Invalidate auction-related caches
     * @param {string} auctionId - Auction ID (optional)
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidateAuctionCache(auctionId = null) {
        if (auctionId) {
            // Invalidate specific auction cache
            await this.delete(`${this.prefixes.auction}${auctionId}`);
            // Also invalidate search caches as auction data changed
            return await this.invalidateSearchCache();
        } else {
            // Invalidate all auction caches
            const auctionKeys = await this.deletePattern(`${this.prefixes.auction}*`);
            const searchKeys = await this.invalidateSearchCache();
            return auctionKeys + searchKeys;
        }
    }

    /**
     * Invalidate user-related caches
     * @param {string} userId - User ID (optional)
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidateUserCache(userId = null) {
        if (userId) {
            await this.delete(`${this.prefixes.user}${userId}`);
            await this.delete(`${this.prefixes.recommendations}${userId}`);
            return 2;
        } else {
            const userKeys = await this.deletePattern(`${this.prefixes.user}*`);
            const recKeys = await this.deletePattern(`${this.prefixes.recommendations}*`);
            return userKeys + recKeys;
        }
    }

    /**
     * Get cache statistics
     * @returns {Promise<Object>} Cache statistics
     */
    async getStats() {
        try {
            const info = await redisClient.info('stats');
            const keyspace = await redisClient.info('keyspace');
            
            return {
                info,
                keyspace,
                timestamp: new Date().toISOString()
            };
        } catch (error) {
            logger.error('Error getting cache stats:', error.message);
            return null;
        }
    }

    /**
     * Check if Redis is connected
     * @returns {Promise<boolean>} Connection status
     */
    async isConnected() {
        try {
            await redisClient.ping();
            return true;
        } catch (error) {
            logger.error('Redis connection check failed:', error.message);
            return false;
        }
    }

    /**
     * Flush all cache (use with caution)
     * @returns {Promise<boolean>} Success status
     */
    async flushAll() {
        try {
            await redisClient.flushall();
            logger.warn('All cache flushed');
            return true;
        } catch (error) {
            logger.error('Error flushing cache:', error.message);
            return false;
        }
    }

    /**
     * Get TTL for a specific data type
     * @param {string} type - Data type (session, auction, search, etc.)
     * @returns {number} TTL in seconds
     */
    getTTL(type) {
        return this.ttlConfig[type] || this.defaultTTL;
    }

    /**
     * Set with automatic TTL based on data type
     * @param {string} type - Data type
     * @param {string} key - Cache key
     * @param {any} data - Data to cache
     * @returns {Promise<boolean>} Success status
     */
    async setWithType(type, key, data) {
        const ttl = this.getTTL(type);
        const fullKey = this.prefixes[type] ? `${this.prefixes[type]}${key}` : key;
        return await this.set(fullKey, data, ttl);
    }

    /**
     * Get with automatic prefix based on data type
     * @param {string} type - Data type
     * @param {string} key - Cache key
     * @returns {Promise<any|null>} Cached data or null
     */
    async getWithType(type, key) {
        const fullKey = this.prefixes[type] ? `${this.prefixes[type]}${key}` : key;
        return await this.get(fullKey);
    }

    /**
     * Delete with automatic prefix based on data type
     * @param {string} type - Data type
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async deleteWithType(type, key) {
        const fullKey = this.prefixes[type] ? `${this.prefixes[type]}${key}` : key;
        return await this.delete(fullKey);
    }

    /**
     * Cache user session data
     * @param {string} userId - User ID
     * @param {Object} sessionData - Session data
     * @returns {Promise<boolean>} Success status
     */
    async cacheUserSession(userId, sessionData) {
        return await this.setWithType('session', userId, sessionData);
    }

    /**
     * Get cached user session
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} Session data or null
     */
    async getUserSession(userId) {
        return await this.getWithType('session', userId);
    }

    /**
     * Invalidate user session
     * @param {string} userId - User ID
     * @returns {Promise<boolean>} Success status
     */
    async invalidateUserSession(userId) {
        return await this.deleteWithType('session', userId);
    }

    /**
     * Cache active auction listings
     * @param {string} key - Cache key (e.g., 'active-list-page-1')
     * @param {Object} data - Auction listings data
     * @returns {Promise<boolean>} Success status
     */
    async cacheAuctionListings(key, data) {
        return await this.setWithType('auction', key, data);
    }

    /**
     * Get cached auction listings
     * @param {string} key - Cache key
     * @returns {Promise<Object|null>} Auction listings or null
     */
    async getAuctionListings(key) {
        return await this.getWithType('auction', key);
    }

    /**
     * Cache AI prediction
     * @param {string} auctionId - Auction ID
     * @param {Object} prediction - AI prediction data
     * @returns {Promise<boolean>} Success status
     */
    async cacheAIPrediction(auctionId, prediction) {
        return await this.setWithType('aiPrediction', auctionId, prediction);
    }

    /**
     * Get cached AI prediction
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} AI prediction or null
     */
    async getAIPrediction(auctionId) {
        return await this.getWithType('aiPrediction', auctionId);
    }

    /**
     * Invalidate AI prediction cache
     * @param {string} auctionId - Auction ID (optional)
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidateAIPredictionCache(auctionId = null) {
        if (auctionId) {
            await this.deleteWithType('aiPrediction', auctionId);
            return 1;
        } else {
            return await this.deletePattern(`${this.prefixes.aiPrediction}*`);
        }
    }

    /**
     * Cache analytics data
     * @param {string} key - Cache key (e.g., 'dashboard', 'stats-2024-01-01')
     * @param {Object} data - Analytics data
     * @returns {Promise<boolean>} Success status
     */
    async cacheAnalytics(key, data) {
        return await this.setWithType('analytics', key, data);
    }

    /**
     * Get cached analytics data
     * @param {string} key - Cache key
     * @returns {Promise<Object|null>} Analytics data or null
     */
    async getAnalytics(key) {
        return await this.getWithType('analytics', key);
    }

    /**
     * Invalidate analytics cache
     * @param {string} key - Specific key (optional)
     * @returns {Promise<number>} Number of keys deleted
     */
    async invalidateAnalyticsCache(key = null) {
        if (key) {
            await this.deleteWithType('analytics', key);
            return 1;
        } else {
            return await this.deletePattern(`${this.prefixes.analytics}*`);
        }
    }

    /**
     * Get remaining TTL for a key
     * @param {string} key - Cache key
     * @returns {Promise<number>} Remaining TTL in seconds (-1 if no expiry, -2 if key doesn't exist)
     */
    async getTTLRemaining(key) {
        try {
            const ttl = await redisClient.ttl(key);
            return ttl;
        } catch (error) {
            logger.error(`Error getting TTL for ${key}:`, error.message);
            return -2;
        }
    }

    /**
     * Extend TTL for an existing key
     * @param {string} key - Cache key
     * @param {number} additionalSeconds - Additional seconds to add
     * @returns {Promise<boolean>} Success status
     */
    async extendTTL(key, additionalSeconds) {
        try {
            const currentTTL = await this.getTTLRemaining(key);
            if (currentTTL > 0) {
                await redisClient.expire(key, currentTTL + additionalSeconds);
                logger.debug(`TTL extended for ${key} by ${additionalSeconds}s`);
                return true;
            }
            return false;
        } catch (error) {
            logger.error(`Error extending TTL for ${key}:`, error.message);
            return false;
        }
    }

    /**
     * Set multiple keys at once (pipeline)
     * @param {Array} items - Array of {key, data, ttl} objects
     * @returns {Promise<boolean>} Success status
     */
    async setMultiple(items) {
        try {
            const pipeline = redisClient.pipeline();
            
            for (const item of items) {
                const { key, data, ttl = this.defaultTTL } = item;
                pipeline.setex(key, ttl, JSON.stringify(data));
            }
            
            await pipeline.exec();
            logger.debug(`Set ${items.length} cache keys in pipeline`);
            return true;
        } catch (error) {
            logger.error('Error setting multiple cache keys:', error.message);
            return false;
        }
    }

    /**
     * Get multiple keys at once (pipeline)
     * @param {Array} keys - Array of cache keys
     * @returns {Promise<Array>} Array of cached data (null for missing keys)
     */
    async getMultiple(keys) {
        try {
            const pipeline = redisClient.pipeline();
            
            for (const key of keys) {
                pipeline.get(key);
            }
            
            const results = await pipeline.exec();
            
            return results.map(([err, data]) => {
                if (err || !data) return null;
                try {
                    return JSON.parse(data);
                } catch {
                    return null;
                }
            });
        } catch (error) {
            logger.error('Error getting multiple cache keys:', error.message);
            return keys.map(() => null);
        }
    }

    /**
     * Increment a counter in cache
     * @param {string} key - Cache key
     * @param {number} amount - Amount to increment (default: 1)
     * @param {number} ttl - TTL for the key if it doesn't exist
     * @returns {Promise<number>} New value after increment
     */
    async increment(key, amount = 1, ttl = null) {
        try {
            const newValue = await redisClient.incrby(key, amount);
            
            // Set TTL if provided and key was just created
            if (ttl && newValue === amount) {
                await redisClient.expire(key, ttl);
            }
            
            return newValue;
        } catch (error) {
            logger.error(`Error incrementing cache key ${key}:`, error.message);
            return 0;
        }
    }

    /**
     * Check if a key exists in cache
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} True if key exists
     */
    async exists(key) {
        try {
            const result = await redisClient.exists(key);
            return result === 1;
        } catch (error) {
            logger.error(`Error checking if key exists ${key}:`, error.message);
            return false;
        }
    }
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
