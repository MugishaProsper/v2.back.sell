import { Server } from 'socket.io';
import { createAdapter } from '@socket.io/redis-adapter';
import { createClient } from 'redis';
import jwt from 'jsonwebtoken';
import logger from './logger.js';
import prometheusMetrics from '../services/prometheus-metrics.service.js';
import { configDotenv } from 'dotenv';

configDotenv();

/**
 * Initialize Socket.IO server with authentication and Redis adapter
 * @param {Object} httpServer - HTTP server instance
 * @returns {Object} - Socket.IO server instance
 */
export const initializeSocketIO = async (httpServer) => {
    try {
        // Create Socket.IO server
        const io = new Server(httpServer, {
            cors: {
                origin: process.env.FRONTEND_URL || 'http://localhost:3000',
                methods: ['GET', 'POST'],
                credentials: true
            },
            transports: ['websocket', 'polling']
        });

        // Set up Redis adapter for multi-instance scaling
        if (process.env.REDIS_HOST) {
            try {
                const pubClient = createClient({
                    socket: {
                        host: process.env.REDIS_HOST || 'localhost',
                        port: process.env.REDIS_PORT || 6379
                    },
                    password: process.env.REDIS_PASSWORD || undefined
                });

                const subClient = pubClient.duplicate();

                await Promise.all([
                    pubClient.connect(),
                    subClient.connect()
                ]);

                io.adapter(createAdapter(pubClient, subClient));

                logger.info('Socket.IO Redis adapter configured');
            } catch (redisError) {
                logger.warn('Redis adapter setup failed, using default adapter:', redisError.message);
            }
        }

        // Authentication middleware
        io.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                
                // Attach user info to socket
                socket.userId = decoded.id;
                socket.userEmail = decoded.email;
                socket.userRole = decoded.role;

                logger.info(`Socket authenticated: ${socket.id} for user ${socket.userId}`);
                next();
            } catch (error) {
                logger.error('Socket authentication failed:', error.message);
                next(new Error('Authentication failed'));
            }
        });

        // Create /auctions namespace for auction-specific events
        const auctionsNamespace = io.of('/auctions');

        // Authentication middleware for auctions namespace
        auctionsNamespace.use((socket, next) => {
            try {
                const token = socket.handshake.auth.token || socket.handshake.headers.authorization?.split(' ')[1];

                if (!token) {
                    return next(new Error('Authentication token required'));
                }

                // Verify JWT token
                const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
                
                // Attach user info to socket
                socket.userId = decoded.id;
                socket.userEmail = decoded.email;
                socket.userRole = decoded.role;

                logger.info(`Auctions namespace socket authenticated: ${socket.id} for user ${socket.userId}`);
                next();
            } catch (error) {
                logger.error('Auctions namespace authentication failed:', error.message);
                next(new Error('Authentication failed'));
            }
        });

        // Handle connections to auctions namespace
        auctionsNamespace.on('connection', (socket) => {
            logger.info(`Client connected to auctions namespace: ${socket.id} (user: ${socket.userId})`);
            
            // Update WebSocket connection count
            const connectionCount = auctionsNamespace.sockets.size;
            prometheusMetrics.updateWebSocketConnections(connectionCount);

            // Join auction room
            socket.on('join:auction', (auctionId) => {
                try {
                    socket.join(`auction:${auctionId}`);
                    logger.info(`User ${socket.userId} joined auction room: ${auctionId}`);
                    
                    // Notify user they joined successfully
                    socket.emit('joined:auction', {
                        auctionId,
                        message: 'Successfully joined auction room'
                    });
                } catch (error) {
                    logger.error(`Error joining auction room:`, error.message);
                    socket.emit('error', { message: 'Failed to join auction room' });
                }
            });

            // Leave auction room
            socket.on('leave:auction', (auctionId) => {
                try {
                    socket.leave(`auction:${auctionId}`);
                    logger.info(`User ${socket.userId} left auction room: ${auctionId}`);
                    
                    // Notify user they left successfully
                    socket.emit('left:auction', {
                        auctionId,
                        message: 'Successfully left auction room'
                    });
                } catch (error) {
                    logger.error(`Error leaving auction room:`, error.message);
                }
            });

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                logger.info(`Client disconnected from auctions namespace: ${socket.id} (reason: ${reason})`);
                
                // Update WebSocket connection count
                const connectionCount = auctionsNamespace.sockets.size;
                prometheusMetrics.updateWebSocketConnections(connectionCount);
            });

            // Handle errors
            socket.on('error', (error) => {
                logger.error(`Socket error for ${socket.id}:`, error.message);
            });
        });

        // Handle connections to default namespace
        io.on('connection', (socket) => {
            logger.info(`Client connected: ${socket.id} (user: ${socket.userId})`);

            // Handle disconnection
            socket.on('disconnect', (reason) => {
                logger.info(`Client disconnected: ${socket.id} (reason: ${reason})`);
            });

            // Handle errors
            socket.on('error', (error) => {
                logger.error(`Socket error for ${socket.id}:`, error.message);
            });
        });

        logger.info('Socket.IO server initialized successfully');

        return io;
    } catch (error) {
        logger.error('Error initializing Socket.IO:', error.message);
        throw error;
    }
};

/**
 * Emit event to auction room
 * @param {Object} io - Socket.IO server instance
 * @param {string} auctionId - Auction ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToAuctionRoom = (io, auctionId, event, data) => {
    try {
        const auctionsNamespace = io.of('/auctions');
        auctionsNamespace.to(`auction:${auctionId}`).emit(event, data);
        logger.info(`Event ${event} emitted to auction room ${auctionId}`);
    } catch (error) {
        logger.error(`Error emitting to auction room ${auctionId}:`, error.message);
    }
};

/**
 * Emit event to specific user
 * @param {Object} io - Socket.IO server instance
 * @param {string} userId - User ID
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const emitToUser = (io, userId, event, data) => {
    try {
        io.to(userId).emit(event, data);
        logger.info(`Event ${event} emitted to user ${userId}`);
    } catch (error) {
        logger.error(`Error emitting to user ${userId}:`, error.message);
    }
};

/**
 * Broadcast event to all connected clients
 * @param {Object} io - Socket.IO server instance
 * @param {string} event - Event name
 * @param {Object} data - Event data
 */
export const broadcastEvent = (io, event, data) => {
    try {
        io.emit(event, data);
        logger.info(`Event ${event} broadcasted to all clients`);
    } catch (error) {
        logger.error(`Error broadcasting event:`, error.message);
    }
};

export default {
    initializeSocketIO,
    emitToAuctionRoom,
    emitToUser,
    broadcastEvent
};
