import mongoose from 'mongoose';
import { redisClient } from '../config/redis.config.js';
import aiIntegrationService from '../services/ai-integration.service.js';
import logger from '../config/logger.js';

/**
 * @desc    Basic health check
 * @route   GET /api/v1/health
 * @access  Public
 */
export const basicHealthCheck = async (req, res) => {
    try {
        const healthData = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            version: process.env.npm_package_version || '1.0.0',
        };

        res.status(200).json(healthData);
    } catch (error) {
        logger.error('Basic health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
        });
    }
};

/**
 * @desc    Detailed health check with service connectivity
 * @route   GET /api/v1/health/detailed
 * @access  Public
 */
export const detailedHealthCheck = async (req, res) => {
    const startTime = Date.now();
    const healthData = {
        status: 'healthy',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
        version: process.env.npm_package_version || '1.0.0',
        services: {},
        memory: {},
        errors: [],
    };

    try {
        // Check MongoDB connection
        const dbStartTime = Date.now();
        try {
            const dbState = mongoose.connection.readyState;
            const dbStatus = dbState === 1 ? 'connected' : dbState === 2 ? 'connecting' : 'disconnected';
            
            if (dbState === 1) {
                // Ping database to verify connectivity
                await mongoose.connection.db.admin().ping();
                healthData.services.database = {
                    status: 'connected',
                    responseTime: Date.now() - dbStartTime,
                };
            } else {
                healthData.services.database = {
                    status: dbStatus,
                    responseTime: Date.now() - dbStartTime,
                };
                healthData.status = 'degraded';
                healthData.errors.push('Database is not connected');
            }
        } catch (dbError) {
            healthData.services.database = {
                status: 'error',
                responseTime: Date.now() - dbStartTime,
                error: dbError.message,
            };
            healthData.status = 'degraded';
            healthData.errors.push(`Database error: ${dbError.message}`);
            logger.error('Database health check failed:', dbError);
        }

        // Check Redis connection
        const redisStartTime = Date.now();
        try {
            await redisClient.ping();
            healthData.services.redis = {
                status: 'connected',
                responseTime: Date.now() - redisStartTime,
            };
        } catch (redisError) {
            healthData.services.redis = {
                status: 'error',
                responseTime: Date.now() - redisStartTime,
                error: redisError.message,
            };
            healthData.status = 'degraded';
            healthData.errors.push(`Redis error: ${redisError.message}`);
            logger.error('Redis health check failed:', redisError);
        }

        // Check AI Module connectivity (optional - don't fail if unavailable)
        const aiStartTime = Date.now();
        try {
            // Check if AI module is configured
            const aiModuleUrl = process.env.AI_MODULE_URL;
            const useMockAI = process.env.USE_MOCK_AI === 'true';

            if (useMockAI) {
                healthData.services.aiModule = {
                    status: 'mock',
                    responseTime: Date.now() - aiStartTime,
                    message: 'Using mock AI service',
                };
            } else if (aiModuleUrl) {
                // Try to check AI module health (with timeout)
                const aiHealthCheck = await Promise.race([
                    aiIntegrationService.checkAIHealth(),
                    new Promise((_, reject) => 
                        setTimeout(() => reject(new Error('AI health check timeout')), 3000)
                    ),
                ]);

                healthData.services.aiModule = {
                    status: aiHealthCheck ? 'available' : 'unavailable',
                    responseTime: Date.now() - aiStartTime,
                };
            } else {
                healthData.services.aiModule = {
                    status: 'not_configured',
                    responseTime: Date.now() - aiStartTime,
                    message: 'AI module URL not configured',
                };
            }
        } catch (aiError) {
            healthData.services.aiModule = {
                status: 'unavailable',
                responseTime: Date.now() - aiStartTime,
                error: aiError.message,
            };
            // Don't mark as degraded for AI module issues
            logger.warn('AI module health check failed:', aiError.message);
        }

        // Memory usage
        const memUsage = process.memoryUsage();
        healthData.memory = {
            used: Math.round(memUsage.heapUsed / 1024 / 1024), // MB
            total: Math.round(memUsage.heapTotal / 1024 / 1024), // MB
            percentage: Math.round((memUsage.heapUsed / memUsage.heapTotal) * 100),
            rss: Math.round(memUsage.rss / 1024 / 1024), // MB
        };

        // Overall response time
        healthData.responseTime = Date.now() - startTime;

        // Determine final status code
        const statusCode = healthData.status === 'healthy' ? 200 : 503;

        res.status(statusCode).json(healthData);
    } catch (error) {
        logger.error('Detailed health check failed:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message,
            responseTime: Date.now() - startTime,
        });
    }
};
