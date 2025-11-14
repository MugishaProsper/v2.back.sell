/**
 * Utility script to test database and Redis connections
 * Run with: node src/utils/testConnections.js
 */
import { configDotenv } from 'dotenv';
import logger from '../config/logger.js';
import { connectToDatabase } from '../config/db.config.js';
import { connectToRedis, redisClient } from '../config/redis.config.js';

configDotenv();

const testConnections = async () => {
    try {
        logger.info('Testing connections...');
        
        // Test MongoDB
        logger.info('Testing MongoDB connection...');
        await connectToDatabase();
        logger.info('✓ MongoDB connection successful');
        
        // Test Redis
        logger.info('Testing Redis connection...');
        await connectToRedis();
        
        // Test Redis operations
        await redisClient.set('test_key', 'test_value', 'EX', 10);
        const value = await redisClient.get('test_key');
        
        if (value === 'test_value') {
            logger.info('✓ Redis connection and operations successful');
        } else {
            logger.error('✗ Redis operations failed');
        }
        
        logger.info('All connections tested successfully!');
        process.exit(0);
    } catch (error) {
        logger.error('Connection test failed:', error);
        process.exit(1);
    }
};

testConnections();
