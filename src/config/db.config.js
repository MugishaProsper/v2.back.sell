import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import logger from "./logger.js";

configDotenv();

const mongoOptions = {
    minPoolSize: parseInt(process.env.MONGO_MIN_POOL_SIZE) || 10,
    maxPoolSize: parseInt(process.env.MONGO_MAX_POOL_SIZE) || 100,
    serverSelectionTimeoutMS: 5000,
    socketTimeoutMS: 45000,
};

export const connectToDatabase = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, mongoOptions);
        logger.info(`Connected to MongoDB with connection pool (min: ${mongoOptions.minPoolSize}, max: ${mongoOptions.maxPoolSize})`);
        
        // Enable slow query logging (queries > 3 seconds)
        mongoose.set('debug', (collectionName, method, query, doc, options) => {
            const startTime = Date.now();
            
            // Log query execution time
            setImmediate(() => {
                const executionTime = Date.now() - startTime;
                if (executionTime > 3000) {
                    logger.warn(`Slow query detected (${executionTime}ms): ${collectionName}.${method}`, {
                        query: JSON.stringify(query),
                        options: JSON.stringify(options)
                    });
                }
            });
        });
        
        mongoose.connection.on('error', (err) => {
            logger.error('MongoDB connection error:', err);
        });
        
        mongoose.connection.on('disconnected', () => {
            logger.warn('MongoDB disconnected');
        });
        
        mongoose.connection.on('reconnected', () => {
            logger.info('MongoDB reconnected');
        });
    } catch (error) {
        logger.error("Error connecting to database:", error.message);
        process.exit(1);
    }
};