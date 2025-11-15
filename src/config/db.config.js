import mongoose from "mongoose";
import { configDotenv } from "dotenv";
import logger from "./logger.js";
import performanceMonitor from "../services/performance-monitor.service.js";

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
        
        // Enable query logging in development
        if (process.env.NODE_ENV === 'development') {
            mongoose.set('debug', true);
        }
        
        // Set up query performance monitoring
        setupQueryMonitoring();
        
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

/**
 * Set up query performance monitoring
 * Logs slow queries (> 3 seconds) for optimization
 */
const setupQueryMonitoring = () => {
    // Track query execution times
    const queryTimes = new Map();
    
    // Monitor query start
    mongoose.plugin((schema) => {
        schema.pre(/^find/, function() {
            this._startTime = Date.now();
        });
        
        schema.pre('save', function() {
            this._startTime = Date.now();
        });
        
        schema.pre('updateOne', function() {
            this._startTime = Date.now();
        });
        
        schema.pre('updateMany', function() {
            this._startTime = Date.now();
        });
        
        schema.pre('deleteOne', function() {
            this._startTime = Date.now();
        });
        
        schema.pre('deleteMany', function() {
            this._startTime = Date.now();
        });
        
        schema.pre('aggregate', function() {
            this._startTime = Date.now();
        });
        
        // Monitor query end
        schema.post(/^find/, function(docs) {
            logQueryTime(this, 'find');
        });
        
        schema.post('save', function(doc) {
            logQueryTime(this, 'save');
        });
        
        schema.post('updateOne', function(result) {
            logQueryTime(this, 'updateOne');
        });
        
        schema.post('updateMany', function(result) {
            logQueryTime(this, 'updateMany');
        });
        
        schema.post('deleteOne', function(result) {
            logQueryTime(this, 'deleteOne');
        });
        
        schema.post('deleteMany', function(result) {
            logQueryTime(this, 'deleteMany');
        });
        
        schema.post('aggregate', function(result) {
            logQueryTime(this, 'aggregate');
        });
    });
    
    logger.info('Query performance monitoring enabled');
};

/**
 * Log query execution time if it exceeds threshold
 * @param {Object} query - Mongoose query object
 * @param {string} operation - Operation type
 */
const logQueryTime = (query, operation) => {
    if (query._startTime) {
        const executionTime = Date.now() - query._startTime;
        const modelName = query.model?.modelName || query.constructor?.modelName || 'Unknown';
        const conditions = query.getQuery?.() || query._conditions || {};
        const options = query.getOptions?.() || {};
        
        // Track query performance in performance monitor
        performanceMonitor.trackDatabaseQuery({
            model: modelName,
            operation,
            duration: executionTime,
            conditions,
            options
        });
        
        // Log slow queries (> 3 seconds)
        if (executionTime > 3000) {
            logger.warn(`Slow query detected (${executionTime}ms)`, {
                model: modelName,
                operation,
                conditions: JSON.stringify(conditions),
                options: JSON.stringify(options),
                executionTime: `${executionTime}ms`
            });
        } else if (executionTime > 1000) {
            // Log moderately slow queries (> 1 second) at debug level
            logger.debug(`Query took ${executionTime}ms: ${modelName}.${operation}`);
        }
    }
};