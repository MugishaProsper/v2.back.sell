import express from 'express';
import { createServer } from 'http';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { configDotenv } from 'dotenv';

import logger from './config/logger.js';
import { connectToDatabase } from './config/db.config.js';
import { connectToRedis } from './config/redis.config.js';
import { initializeSocketIO } from './config/socket.config.js';
import realtimeService from './services/realtime.service.js';
import loggerMiddleware from './middlewares/logger.middleware.js';
import { errorHandler, notFoundHandler } from './middlewares/error.middleware.js';

// Load environment variables
configDotenv();

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Security middleware
app.use(helmet());

// Rate limiting
const limiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests, please try again later',
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
});

app.use('/api', limiter);

// CORS configuration
const corsOptions = {
    credentials: true,
    origin: (origin, callback) => {
        const allowedOrigins = process.env.FRONTEND_URL 
            ? process.env.FRONTEND_URL.split(',') 
            : ['http://localhost:3000'];
        
        // Allow requests with no origin (mobile apps, Postman, etc.)
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
};

app.use(cors(corsOptions));

// Body parsing middleware
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

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

app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/users', userRoutes);
app.use('/api/v1/auctions', auctionRoutes);

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