import { redisClient } from '../config/redis.config.js';
import logger from '../config/logger.js';
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
            recommendations: 'recommendations:',
            analytics: 'analytics:'
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
        try {
            const cached = await redisClient.get(key);
            if (cached) {
                logger.debug(`Cache hit: ${key}`);
                return JSON.parse(cached);
            }
            logger.debug(`Cache miss: ${key}`);
            return null;
        } catch (error) {
            logger.error(`Error reading from cache (${key}):`, error.message);
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
        try {
            await redisClient.setex(key, ttl, JSON.stringify(data));
            logger.debug(`Cache set: ${key} (TTL: ${ttl}s)`);
            return true;
        } catch (error) {
            logger.error(`Error writing to cache (${key}):`, error.message);
            return false;
        }
    }

    /**
     * Delete cached data
     * @param {string} key - Cache key
     * @returns {Promise<boolean>} Success status
     */
    async delete(key) {
        try {
            await redisClient.del(key);
            logger.debug(`Cache deleted: ${key}`);
            return true;
        } catch (error) {
            logger.error(`Error deleting from cache (${key}):`, error.message);
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
}

// Export singleton instance
const cacheService = new CacheService();
export default cacheService;
