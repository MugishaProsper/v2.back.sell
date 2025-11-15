import logger from '../config/logger.js';
import { redisClient } from '../config/redis.config.js';
import prometheusMetrics from './prometheus-metrics.service.js';

/**
 * PerformanceMonitorService - Tracks and logs performance metrics
 * Monitors API response times, database queries, cache operations, and slow operations
 */
class PerformanceMonitorService {
    constructor() {
        // Performance thresholds (in milliseconds)
        this.thresholds = {
            api: {
                slow: 1000,      // 1 second
                critical: 3000   // 3 seconds
            },
            database: {
                slow: 1000,      // 1 second
                critical: 3000   // 3 seconds
            },
            cache: {
                slow: 100,       // 100ms
                critical: 500    // 500ms
            }
        };

        // In-memory metrics storage (for current session)
        this.metrics = {
            api: {
                totalRequests: 0,
                totalDuration: 0,
                slowRequests: 0,
                criticalRequests: 0,
                errorRequests: 0,
                byEndpoint: new Map(),
                byStatusCode: new Map()
            },
            database: {
                totalQueries: 0,
                totalDuration: 0,
                slowQueries: 0,
                criticalQueries: 0,
                byOperation: new Map(),
                byModel: new Map()
            },
            cache: {
                totalOperations: 0,
                hits: 0,
                misses: 0,
                totalDuration: 0,
                slowOperations: 0,
                byOperation: new Map()
            }
        };

        // Start periodic metrics logging
        this.startPeriodicLogging();
    }

    /**
     * Track API request performance
     * @param {Object} data - Request performance data
     */
    trackAPIRequest(data) {
        const { method, url, duration, statusCode, requestId } = data;
        
        this.metrics.api.totalRequests++;
        this.metrics.api.totalDuration += duration;

        // Track by endpoint
        const endpoint = `${method} ${url}`;
        const endpointStats = this.metrics.api.byEndpoint.get(endpoint) || {
            count: 0,
            totalDuration: 0,
            avgDuration: 0,
            minDuration: Infinity,
            maxDuration: 0
        };
        
        endpointStats.count++;
        endpointStats.totalDuration += duration;
        endpointStats.avgDuration = endpointStats.totalDuration / endpointStats.count;
        endpointStats.minDuration = Math.min(endpointStats.minDuration, duration);
        endpointStats.maxDuration = Math.max(endpointStats.maxDuration, duration);
        
        this.metrics.api.byEndpoint.set(endpoint, endpointStats);

        // Track by status code
        const statusStats = this.metrics.api.byStatusCode.get(statusCode) || 0;
        this.metrics.api.byStatusCode.set(statusCode, statusStats + 1);

        // Track errors
        if (statusCode >= 400) {
            this.metrics.api.errorRequests++;
        }

        // Track slow and critical requests
        if (duration >= this.thresholds.api.critical) {
            this.metrics.api.criticalRequests++;
            logger.error('Critical API Response Time', {
                requestId,
                endpoint,
                duration,
                durationMs: `${duration}ms`,
                threshold: `${this.thresholds.api.critical}ms`,
                statusCode
            });
        } else if (duration >= this.thresholds.api.slow) {
            this.metrics.api.slowRequests++;
            logger.warn('Slow API Response Time', {
                requestId,
                endpoint,
                duration,
                durationMs: `${duration}ms`,
                threshold: `${this.thresholds.api.slow}ms`,
                statusCode
            });
        }
    }

    /**
     * Track database query performance
     * @param {Object} data - Query performance data
     */
    trackDatabaseQuery(data) {
        const { model, operation, duration, conditions, options } = data;
        
        this.metrics.database.totalQueries++;
        this.metrics.database.totalDuration += duration;

        // Track in Prometheus
        prometheusMetrics.trackDatabaseQuery(model, operation, duration);

        // Track by operation
        const opStats = this.metrics.database.byOperation.get(operation) || {
            count: 0,
            totalDuration: 0,
            avgDuration: 0
        };
        
        opStats.count++;
        opStats.totalDuration += duration;
        opStats.avgDuration = opStats.totalDuration / opStats.count;
        
        this.metrics.database.byOperation.set(operation, opStats);

        // Track by model
        const modelStats = this.metrics.database.byModel.get(model) || {
            count: 0,
            totalDuration: 0,
            avgDuration: 0
        };
        
        modelStats.count++;
        modelStats.totalDuration += duration;
        modelStats.avgDuration = modelStats.totalDuration / modelStats.count;
        
        this.metrics.database.byModel.set(model, modelStats);

        // Track slow and critical queries
        if (duration >= this.thresholds.database.critical) {
            this.metrics.database.criticalQueries++;
            logger.error('Critical Database Query Time', {
                model,
                operation,
                duration,
                durationMs: `${duration}ms`,
                threshold: `${this.thresholds.database.critical}ms`,
                conditions: JSON.stringify(conditions),
                options: JSON.stringify(options)
            });
        } else if (duration >= this.thresholds.database.slow) {
            this.metrics.database.slowQueries++;
            logger.warn('Slow Database Query', {
                model,
                operation,
                duration,
                durationMs: `${duration}ms`,
                threshold: `${this.thresholds.database.slow}ms`,
                conditions: JSON.stringify(conditions)
            });
        }
    }

    /**
     * Track cache operation performance
     * @param {Object} data - Cache operation data
     */
    trackCacheOperation(data) {
        const { operation, key, hit, duration } = data;
        
        this.metrics.cache.totalOperations++;
        this.metrics.cache.totalDuration += duration || 0;

        // Track hits and misses
        if (operation === 'get') {
            if (hit) {
                this.metrics.cache.hits++;
            } else {
                this.metrics.cache.misses++;
            }
            
            // Track in Prometheus
            const result = hit ? 'hit' : 'miss';
            prometheusMetrics.trackCacheOperation(operation, result);
        } else {
            // Track other cache operations
            prometheusMetrics.trackCacheOperation(operation, 'success');
        }

        // Update cache hit ratio in Prometheus
        const totalCacheOps = this.metrics.cache.hits + this.metrics.cache.misses;
        if (totalCacheOps > 0) {
            const hitRatio = this.metrics.cache.hits / totalCacheOps;
            prometheusMetrics.updateCacheHitRatio(hitRatio);
        }

        // Track by operation type
        const opStats = this.metrics.cache.byOperation.get(operation) || {
            count: 0,
            totalDuration: 0,
            avgDuration: 0
        };
        
        opStats.count++;
        if (duration) {
            opStats.totalDuration += duration;
            opStats.avgDuration = opStats.totalDuration / opStats.count;
        }
        
        this.metrics.cache.byOperation.set(operation, opStats);

        // Track slow cache operations
        if (duration && duration >= this.thresholds.cache.critical) {
            this.metrics.cache.slowOperations++;
            logger.warn('Slow Cache Operation', {
                operation,
                key,
                duration,
                durationMs: `${duration}ms`,
                threshold: `${this.thresholds.cache.critical}ms`
            });
        }
    }

    /**
     * Get current performance metrics
     * @returns {Object} Current metrics
     */
    getMetrics() {
        const avgApiDuration = this.metrics.api.totalRequests > 0
            ? Math.round(this.metrics.api.totalDuration / this.metrics.api.totalRequests)
            : 0;

        const avgDbDuration = this.metrics.database.totalQueries > 0
            ? Math.round(this.metrics.database.totalDuration / this.metrics.database.totalQueries)
            : 0;

        const avgCacheDuration = this.metrics.cache.totalOperations > 0
            ? Math.round(this.metrics.cache.totalDuration / this.metrics.cache.totalOperations)
            : 0;

        const cacheHitRate = (this.metrics.cache.hits + this.metrics.cache.misses) > 0
            ? ((this.metrics.cache.hits / (this.metrics.cache.hits + this.metrics.cache.misses)) * 100).toFixed(2)
            : 0;

        const errorRate = this.metrics.api.totalRequests > 0
            ? ((this.metrics.api.errorRequests / this.metrics.api.totalRequests) * 100).toFixed(2)
            : 0;

        return {
            api: {
                totalRequests: this.metrics.api.totalRequests,
                avgDuration: avgApiDuration,
                slowRequests: this.metrics.api.slowRequests,
                criticalRequests: this.metrics.api.criticalRequests,
                errorRequests: this.metrics.api.errorRequests,
                errorRate: `${errorRate}%`,
                byEndpoint: Object.fromEntries(
                    Array.from(this.metrics.api.byEndpoint.entries())
                        .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
                        .slice(0, 10) // Top 10 slowest endpoints
                ),
                byStatusCode: Object.fromEntries(this.metrics.api.byStatusCode)
            },
            database: {
                totalQueries: this.metrics.database.totalQueries,
                avgDuration: avgDbDuration,
                slowQueries: this.metrics.database.slowQueries,
                criticalQueries: this.metrics.database.criticalQueries,
                byOperation: Object.fromEntries(this.metrics.database.byOperation),
                byModel: Object.fromEntries(
                    Array.from(this.metrics.database.byModel.entries())
                        .sort((a, b) => b[1].avgDuration - a[1].avgDuration)
                )
            },
            cache: {
                totalOperations: this.metrics.cache.totalOperations,
                hits: this.metrics.cache.hits,
                misses: this.metrics.cache.misses,
                hitRate: `${cacheHitRate}%`,
                avgDuration: avgCacheDuration,
                slowOperations: this.metrics.cache.slowOperations,
                byOperation: Object.fromEntries(this.metrics.cache.byOperation)
            },
            timestamp: new Date().toISOString(),
            uptime: process.uptime()
        };
    }

    /**
     * Reset metrics (useful for testing or periodic resets)
     */
    resetMetrics() {
        this.metrics = {
            api: {
                totalRequests: 0,
                totalDuration: 0,
                slowRequests: 0,
                criticalRequests: 0,
                errorRequests: 0,
                byEndpoint: new Map(),
                byStatusCode: new Map()
            },
            database: {
                totalQueries: 0,
                totalDuration: 0,
                slowQueries: 0,
                criticalQueries: 0,
                byOperation: new Map(),
                byModel: new Map()
            },
            cache: {
                totalOperations: 0,
                hits: 0,
                misses: 0,
                totalDuration: 0,
                slowOperations: 0,
                byOperation: new Map()
            }
        };
        
        logger.info('Performance metrics reset');
    }

    /**
     * Start periodic metrics logging
     */
    startPeriodicLogging() {
        // Log metrics every 5 minutes
        const interval = parseInt(process.env.METRICS_LOG_INTERVAL) || 300000; // 5 minutes
        
        setInterval(() => {
            const metrics = this.getMetrics();
            
            logger.info('Performance Metrics Summary', {
                api: {
                    totalRequests: metrics.api.totalRequests,
                    avgDuration: `${metrics.api.avgDuration}ms`,
                    slowRequests: metrics.api.slowRequests,
                    criticalRequests: metrics.api.criticalRequests,
                    errorRate: metrics.api.errorRate
                },
                database: {
                    totalQueries: metrics.database.totalQueries,
                    avgDuration: `${metrics.database.avgDuration}ms`,
                    slowQueries: metrics.database.slowQueries,
                    criticalQueries: metrics.database.criticalQueries
                },
                cache: {
                    totalOperations: metrics.cache.totalOperations,
                    hitRate: metrics.cache.hitRate,
                    avgDuration: `${metrics.cache.avgDuration}ms`
                },
                uptime: `${Math.round(metrics.uptime)}s`
            });
        }, interval);
        
        logger.info(`Performance monitoring started (logging interval: ${interval}ms)`);
    }

    /**
     * Get performance summary for health checks
     * @returns {Object} Performance summary
     */
    getHealthSummary() {
        const metrics = this.getMetrics();
        
        return {
            api: {
                avgResponseTime: `${metrics.api.avgDuration}ms`,
                errorRate: metrics.api.errorRate,
                slowRequests: metrics.api.slowRequests
            },
            database: {
                avgQueryTime: `${metrics.database.avgDuration}ms`,
                slowQueries: metrics.database.slowQueries
            },
            cache: {
                hitRate: metrics.cache.hitRate,
                totalOperations: metrics.cache.totalOperations
            }
        };
    }

    /**
     * Log slow operation for optimization
     * @param {Object} data - Operation data
     */
    logSlowOperation(data) {
        const { type, operation, duration, details } = data;
        
        logger.warn('Slow Operation Detected', {
            type,
            operation,
            duration,
            durationMs: `${duration}ms`,
            details,
            timestamp: new Date().toISOString()
        });
    }
}

// Export singleton instance
const performanceMonitor = new PerformanceMonitorService();
export default performanceMonitor;
