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

// Health check endpoint
app.get('/health', (_req, res) => {
    res.status(200).json({
        success: true,
        message: 'API is running',
        timestamp: new Date().toISOString(),
        uptime: process.uptime(),
    });
});

// API routes
import authRoutes from './routes/auth.routes.js';
import userRoutes from './routes/user.routes.js';
import auctionRoutes from './routes/auction.routes.js';
import bidRoutes from './routes/bid.routes.js';
import aiWebhookRoutes from './routes/ai-webhook.routes.js';
import notificationRoutes from './routes/notification.routes.js';
import analyticsRoutes from './routes/analytics.routes.js';
import auditRoutes from './routes/audit.routes.js';

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
        await import('./workers/email.worker.js');
        logger.info('Email worker initialized');
        
        await import('./workers/ai-webhook.worker.js');
        logger.info('AI webhook worker initialized');
        
        await import('./workers/auction-expiration.worker.js');
        logger.info('Auction expiration worker initialized');
        
        await import('./workers/analytics.worker.js');
        logger.info('Analytics worker initialized');
        
        // Start listening
        httpServer.listen(PORT, () => {
            logger.info(`Server is running on port ${PORT} in ${process.env.NODE_ENV} mode`);
            logger.info(`Health check available at http://localhost:${PORT}/health`);
            logger.info(`Socket.IO server ready for connections`);
        });
    } catch (error) {
        logger.error('Failed to start server:', error);
        process.exit(1);
    }
};

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    logger.error('Unhandled Promise Rejection:', err);
    process.exit(1);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    logger.error('Uncaught Exception:', err);
    process.exit(1);
});

startServer();

// Export io for use in other modules
export { io };