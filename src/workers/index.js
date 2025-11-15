import logger from '../config/logger.js';

/**
 * Worker Manager
 * Initializes and manages all background job processors
 */

// Import all workers
import emailWorker from './email.worker.js';
import aiWebhookWorker from './ai-webhook.worker.js';
import analyticsWorker from './analytics.worker.js';
import auctionExpirationWorker from './auction-expiration.worker.js';

// Export all workers for external access
export {
    emailWorker,
    aiWebhookWorker,
    analyticsWorker,
    auctionExpirationWorker
};

/**
 * Initialize all workers
 * This function should be called when the application starts
 */
export const initializeWorkers = () => {
    logger.info('Initializing all background workers...');
    
    // Workers are automatically initialized when imported
    // This function serves as a central point for worker management
    
    logger.info('All background workers initialized successfully');
    
    return {
        emailWorker,
        aiWebhookWorker,
        analyticsWorker,
        auctionExpirationWorker
    };
};

/**
 * Gracefully shutdown all workers
 * This function should be called when the application is shutting down
 */
export const shutdownWorkers = async () => {
    logger.info('Shutting down all background workers...');
    
    try {
        await Promise.all([
            emailWorker.close(),
            aiWebhookWorker.close(),
            analyticsWorker.close(),
            auctionExpirationWorker.close()
        ]);
        
        logger.info('All background workers shut down successfully');
    } catch (error) {
        logger.error('Error shutting down workers:', error.message);
        throw error;
    }
};

/**
 * Get worker health status
 * @returns {Promise<Object>} Health status of all workers
 */
export const getWorkerHealth = async () => {
    try {
        const [
            emailJobCounts,
            aiWebhookJobCounts,
            analyticsJobCounts,
            auctionExpirationJobCounts
        ] = await Promise.all([
            emailWorker.getJobCounts(),
            aiWebhookWorker.getJobCounts(),
            analyticsWorker.getJobCounts(),
            auctionExpirationWorker.getJobCounts()
        ]);
        
        return {
            email: {
                ...emailJobCounts,
                isPaused: await emailWorker.isPaused()
            },
            aiWebhook: {
                ...aiWebhookJobCounts,
                isPaused: await aiWebhookWorker.isPaused()
            },
            analytics: {
                ...analyticsJobCounts,
                isPaused: await analyticsWorker.isPaused()
            },
            auctionExpiration: {
                ...auctionExpirationJobCounts,
                isPaused: await auctionExpirationWorker.isPaused()
            }
        };
    } catch (error) {
        logger.error('Error getting worker health:', error.message);
        throw error;
    }
};

/**
 * Pause all workers
 * Useful for maintenance or debugging
 */
export const pauseAllWorkers = async () => {
    logger.info('Pausing all workers...');
    
    try {
        await Promise.all([
            emailWorker.pause(),
            aiWebhookWorker.pause(),
            analyticsWorker.pause(),
            auctionExpirationWorker.pause()
        ]);
        
        logger.info('All workers paused');
    } catch (error) {
        logger.error('Error pausing workers:', error.message);
        throw error;
    }
};

/**
 * Resume all workers
 */
export const resumeAllWorkers = async () => {
    logger.info('Resuming all workers...');
    
    try {
        await Promise.all([
            emailWorker.resume(),
            aiWebhookWorker.resume(),
            analyticsWorker.resume(),
            auctionExpirationWorker.resume()
        ]);
        
        logger.info('All workers resumed');
    } catch (error) {
        logger.error('Error resuming workers:', error.message);
        throw error;
    }
};

/**
 * Clean completed jobs from all queues
 * @param {number} grace - Grace period in milliseconds (default: 1 hour)
 */
export const cleanCompletedJobs = async (grace = 3600000) => {
    logger.info('Cleaning completed jobs from all queues...');
    
    try {
        const results = await Promise.all([
            emailWorker.clean(grace, 'completed'),
            aiWebhookWorker.clean(grace, 'completed'),
            analyticsWorker.clean(grace, 'completed'),
            auctionExpirationWorker.clean(grace, 'completed')
        ]);
        
        const totalCleaned = results.reduce((sum, jobs) => sum + jobs.length, 0);
        logger.info(`Cleaned ${totalCleaned} completed jobs`);
        
        return totalCleaned;
    } catch (error) {
        logger.error('Error cleaning completed jobs:', error.message);
        throw error;
    }
};

/**
 * Clean failed jobs from all queues
 * @param {number} grace - Grace period in milliseconds (default: 24 hours)
 */
export const cleanFailedJobs = async (grace = 86400000) => {
    logger.info('Cleaning failed jobs from all queues...');
    
    try {
        const results = await Promise.all([
            emailWorker.clean(grace, 'failed'),
            aiWebhookWorker.clean(grace, 'failed'),
            analyticsWorker.clean(grace, 'failed'),
            auctionExpirationWorker.clean(grace, 'failed')
        ]);
        
        const totalCleaned = results.reduce((sum, jobs) => sum + jobs.length, 0);
        logger.info(`Cleaned ${totalCleaned} failed jobs`);
        
        return totalCleaned;
    } catch (error) {
        logger.error('Error cleaning failed jobs:', error.message);
        throw error;
    }
};

// Initialize workers on module load
initializeWorkers();

logger.info('Worker manager initialized');
