import logger from '../config/logger.js';

/**
 * Query Optimizer Utility
 * Provides utilities for monitoring and optimizing database queries
 */

/**
 * Wrap a query with performance monitoring
 * Logs queries that take longer than the threshold
 * @param {Function} queryFn - Query function to execute
 * @param {string} queryName - Name/description of the query
 * @param {number} threshold - Time threshold in ms (default: 3000ms)
 * @returns {Promise<any>} Query result
 */
export async function monitorQuery(queryFn, queryName, threshold = 3000) {
    const startTime = Date.now();
    
    try {
        const result = await queryFn();
        const executionTime = Date.now() - startTime;
        
        if (executionTime > threshold) {
            logger.warn(`Slow query detected: ${queryName} took ${executionTime}ms (threshold: ${threshold}ms)`);
        } else {
            logger.debug(`Query executed: ${queryName} in ${executionTime}ms`);
        }
        
        return result;
    } catch (error) {
        const executionTime = Date.now() - startTime;
        logger.error(`Query failed: ${queryName} after ${executionTime}ms`, error);
        throw error;
    }
}

/**
 * Common field projections for different entities
 * Use these to fetch only required fields
 */
export const projections = {
    // User projections
    user: {
        basic: 'email profile.firstName profile.lastName role',
        public: 'profile.firstName profile.lastName stats',
        session: 'email role profile notificationPreferences lastLogin',
        full: '' // Empty string means all fields
    },
    
    // Auction projections
    auction: {
        list: 'title category images pricing timing status bidding.totalBids seller',
        detail: '', // All fields
        summary: 'title pricing.currentPrice timing.endTime status',
        search: 'title description category images pricing timing status seller'
    },
    
    // Bid projections
    bid: {
        basic: 'auction bidder amount timestamp status',
        detail: 'auction bidder amount timestamp status fraudAnalysis',
        history: 'bidder amount timestamp status'
    },
    
    // Notification projections
    notification: {
        list: 'type title message data channels.inApp.read createdAt',
        unread: 'type title message data createdAt'
    }
};

/**
 * Build optimized aggregation pipeline
 * @param {Array} stages - Aggregation stages
 * @param {Object} options - Options (allowDiskUse, etc.)
 * @returns {Array} Optimized pipeline
 */
export function buildAggregationPipeline(stages, options = {}) {
    const pipeline = [...stages];
    
    // Add index hints if provided
    if (options.hint) {
        pipeline.unshift({ $hint: options.hint });
    }
    
    // Add limit early if provided to reduce documents processed
    if (options.earlyLimit) {
        pipeline.splice(1, 0, { $limit: options.earlyLimit });
    }
    
    return pipeline;
}

/**
 * Create index recommendation based on query patterns
 * @param {string} collection - Collection name
 * @param {Object} filter - Query filter
 * @param {Object} sort - Sort criteria
 * @returns {Object} Index recommendation
 */
export function recommendIndex(collection, filter, sort) {
    const filterFields = Object.keys(filter);
    const sortFields = Object.keys(sort);
    
    // Combine filter and sort fields for compound index
    const indexFields = [...new Set([...filterFields, ...sortFields])];
    
    const recommendation = {
        collection,
        suggestedIndex: {},
        reason: `Query uses fields: ${indexFields.join(', ')}`
    };
    
    // Build index specification
    indexFields.forEach(field => {
        if (sortFields.includes(field)) {
            recommendation.suggestedIndex[field] = sort[field];
        } else {
            recommendation.suggestedIndex[field] = 1;
        }
    });
    
    return recommendation;
}

/**
 * Batch query executor
 * Executes multiple queries in parallel with error handling
 * @param {Array} queries - Array of {name, fn} objects
 * @returns {Promise<Object>} Results object with query names as keys
 */
export async function batchExecute(queries) {
    const startTime = Date.now();
    
    try {
        const results = await Promise.allSettled(
            queries.map(async ({ name, fn }) => {
                const queryStart = Date.now();
                const result = await fn();
                const queryTime = Date.now() - queryStart;
                
                return { name, result, executionTime: queryTime };
            })
        );
        
        const totalTime = Date.now() - startTime;
        
        // Process results
        const output = {
            success: {},
            errors: {},
            performance: {
                totalTime,
                queriesExecuted: queries.length
            }
        };
        
        results.forEach((result, index) => {
            const queryName = queries[index].name;
            
            if (result.status === 'fulfilled') {
                output.success[queryName] = result.value.result;
                
                if (result.value.executionTime > 3000) {
                    logger.warn(`Slow query in batch: ${queryName} took ${result.value.executionTime}ms`);
                }
            } else {
                output.errors[queryName] = result.reason;
                logger.error(`Query failed in batch: ${queryName}`, result.reason);
            }
        });
        
        logger.info(`Batch execution completed in ${totalTime}ms - ${Object.keys(output.success).length}/${queries.length} successful`);
        
        return output;
    } catch (error) {
        logger.error('Batch execution failed:', error);
        throw error;
    }
}

/**
 * Query result cache wrapper
 * Wraps a query with caching logic
 * @param {Function} queryFn - Query function
 * @param {Object} cacheService - Cache service instance
 * @param {string} cacheKey - Cache key
 * @param {number} ttl - TTL in seconds
 * @returns {Promise<any>} Query result (cached or fresh)
 */
export async function withCache(queryFn, cacheService, cacheKey, ttl = 300) {
    // Try cache first
    const cached = await cacheService.get(cacheKey);
    if (cached) {
        logger.debug(`Cache hit: ${cacheKey}`);
        return { ...cached, fromCache: true };
    }
    
    // Execute query
    const result = await queryFn();
    
    // Cache result
    await cacheService.set(cacheKey, result, ttl);
    
    return { ...result, fromCache: false };
}

export default {
    monitorQuery,
    projections,
    buildAggregationPipeline,
    recommendIndex,
    batchExecute,
    withCache
};
