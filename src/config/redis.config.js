import Redis from 'ioredis';
import { configDotenv } from 'dotenv';
import logger from './logger.js';

configDotenv();

const redisConfig = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT) || 6379,
    password: process.env.REDIS_PASSWORD || undefined,
    retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
    },
    maxRetriesPerRequest: 3,
};

// Create Redis client for general caching
export const redisClient = new Redis(redisConfig);

// Create separate Redis client for Bull queue
export const redisQueueClient = new Redis(redisConfig);

redisClient.on('connect', () => {
    logger.info('Redis client connected');
});

redisClient.on('error', (err) => {
    logger.error('Redis client error:', err);
});

redisClient.on('ready', () => {
    logger.info('Redis client ready');
});

redisQueueClient.on('connect', () => {
    logger.info('Redis queue client connected');
});

redisQueueClient.on('error', (err) => {
    logger.error('Redis queue client error:', err);
});

export const connectToRedis = async () => {
    try {
        await redisClient.ping();
        await redisQueueClient.ping();
        logger.info('Redis connections established successfully');
    } catch (error) {
        logger.error('Error connecting to Redis:', error.message);
        process.exit(1);
    }
};
