import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import { configDotenv } from 'dotenv';

import logger from './config/logger.js';
import { connectToDatabase } from './config/db.config.js';
import { connectToRedis } from './config/redis.config.js';
import { initializeSocketIO } from './config/socket.config.js';
import realtimeService from './services/realtime.service.js';
import aiIntegrationService from './services/ai-integration.service.js';
import loggerMiddleware from './middlewares/logger.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';
import { ipRateLimiter, userRateLimiter } from './middlewares/rate-limit.middleware.js';
import { sanitizeNoSQL, sanitizeXSS, customSanitize } from './middlewares/sanitization.middleware.js';
import { versionNegotiation } from './middlewares/versioning.middleware.js';
import {
    configureHelmet,
    configureCORS,
    addSecurityHeaders,
    detectSuspiciousActivity,
    enforceHTTPS,
    requestTimeout,
    validateContentType,
} from './middlewares/security.middleware.js';

// Load environment variables
configDotenv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Enforce HTTPS in production
app.use(enforceHTTPS);

// Security headers with Helmet.js
app.use(configureHelmet());

// Additional custom security headers
app.use(addSecurityHeaders);

// CORS configuration
app.use(configureCORS());

// Request timeout (30 seconds)
app.use(requestTimeout(30000));

// IP-based rate limiting for all API endpoints
app.use('/api', ipRateLimiter);

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Validate Content-Type for POST/PUT requests
app.use(validateContentType);

// Data sanitization middleware
app.use(sanitizeNoSQL); // Prevent NoSQL injection
app.use(sanitizeXSS); // Prevent XSS attacks
app.use(customSanitize); // Custom sanitization

// Detect suspicious activity
app.use(detectSuspiciousActivity);

// Request logging middleware
app.use(loggerMiddleware);

// API version negotiation middleware
app.use('/api', versionNegotiation);

// Swagger API Documentation
import swaggerUi from 'swagger-ui-express';
import swaggerSpec from './config/swagger.config.js';

// Serve Swagger UI at /api-docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'AI Auction Platform API Documentation',
}));

// Serve Swagger JSON spec
app.get('/api-docs.json', (_req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
});

// API version information endpoint (outside versioned routes)
import { getVersionInfo } from './controllers/health.controller.js';

/**
 * @swagger
 * /api/versions:
 *   get:
 *     summary: Get API version information
 *     description: Returns information about all supported API versions, their status, and features
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: API version information retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     current:
 *                       type: string
 *                       example: v1
 *                     supported:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: [v1]
 *                     deprecated:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: []
 *                     versions:
 *                       type: object
 *                       additionalProperties:
 *                         type: object
 *                         properties:
 *                           status:
 *                             type: string
 *                             enum: [stable, beta, deprecated]
 *                           releaseDate:
 *                             type: string
 *                             format: date
 *                           sunsetDate:
 *                             type: string
 *                             format: date
 *                             nullable: true
 *                           documentation:
 *                             type: string
 *                             format: uri
 *                           features:
 *                             type: array
 *                             items:
 *                               type: string
 */
app.get('/api/versions', getVersionInfo);

// API routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import auctionRoutes from './routes/auction.routes.js';
import bidRoutes from './routes/bid.routes.js';
import aiWebhookRoutes from './routes/ai-webhook.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import auditRoutes from './routes/audit.routes.js';
import healthRoutes from './routes/health.routes.js';

// Health check routes (v1 API)
app.use('/api/v1/health', healthRoutes);

// Legacy health check endpoint (for backward compatibility)
app.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running - use /api/v1/health for detailed health check',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRateLimiter, userRoutes);
app.use('/api/v1/auctions', userRateLimiter, auctionRoutes);
app.use('/api/v1/bids', userRateLimiter, bidRoutes);
app.use('/api/v1/webhooks/ai', aiWebhookRoutes);
app.use('/api/v1/notifications', userRateLimiter, notificationRoutes);
app.use('/api/v1/analytics', userRateLimiter, analyticsRoutes);
app.use('/api/v1/audit', userRateLimiter, auditRoutes);

// Initialize Socket.IO (will be set up in startServer)
let io;

// 404 handler
app.use(notFoundHandler);

// Centralized error handling middleware (must be last)
app.use(errorHandler);

// Start server
const startServer = async () => {
    try {
        // Connect to MongoDB
        await connectToDatabase();
        
        // Connect to Redis
        await connectToRedis();
        
        // Initialize Socket.IO
        io = await initializeSocketIO(httpServer);
        
        // Make io available globally for services
        app.set('io', io);
        
        // Initialize realtime service with Socket.IO instance
        realtimeService.setIO(io);
        
        // Initialize AI integration service (gRPC client)
        await aiIntegrationService.initializeGrpcClient();
        
        // Initialize analytics service (scheduled jobs)
        await import('./services/analytics.service.js');
        logger.info('Analytics service initialized');
        
        // Initialize all background workers
        const { initializeWorkers } = await import('./workers/index.js');
        initializeWorkers();
        logger.info('All background workers initialized');
        
        // Initialize scheduled jobs
        const { initializeScheduledJobs } = await import('./workers/scheduler.js');
        await initializeScheduledJobs();
        logger.info('Scheduled jobs initialized');
        
        // Start listening
        httpServer.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
            logger.info(`API Documentation available at http://localhost:${PORT}/api-docs`);
            logger.info(`Health check available at http://localhost:${PORT}/api/v1/health`);
            logger.info(`Socket.IO server ready for connections`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Graceful shutdown handler
const gracefulShutdown = async (signal) => {
    logger.info(`${signal} received. Starting graceful shutdown...`);
    
    try {
        // Stop accepting new connections
        httpServer.close(() => {
            logger.info('HTTP server closed');
        });
        
        // Close Socket.IO connections
        if (io) {
            io.close(() => {
                logger.info('Socket.IO server closed');
            });
        }
        
        // Shutdown workers
        const { shutdownWorkers } = await import('./workers/index.js');
        await shutdownWorkers();
        
        // Close database connection
        const mongoose = await import('mongoose');
        await mongoose.default.connection.close();
        logger.info('Database connection closed');
        
        // Close Redis connections
        const { redisClient, redisQueueClient } = await import('./config/redis.config.js');
        await redisClient.quit();
        await redisQueueClient.quit();
        logger.info('Redis connections closed');
        
        logger.info('Graceful shutdown completed');
        process.exit(0);
    } catch (error) {
        logger.error('Error during graceful shutdown:', error);
        process.exit(1);
    }
};

// Handle shutdown signals
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    gracefulShutdown('unhandledRejection');
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    gracefulShutdown('uncaughtException');
});

startServer();

// Export io for use in other modules
export { io };