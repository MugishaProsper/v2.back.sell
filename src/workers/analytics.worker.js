import { analyticsQueue } from '../config/queue.config.js';
import analyticsService from '../services/analytics.service.js';
import logger from '../config/logger.js';

/**
 * Analytics Queue Processor
 * Processes analytics aggregation jobs from the queue
 */

// Process analytics aggregation jobs
analyticsQueue.process('aggregate-daily', async (job) => {
    logger.info(`Processing analytics aggregation job ${job.id}`);
    
    try {
        const { date } = job.data;
        await analyticsService.aggregateDailyStatistics(date);
        logger.info(`Analytics aggregation job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Analytics aggregation job ${job.id} failed:`, error.message);
        throw error; // Will trigger retry based on queue configuration
    }
});

// Process manual analytics aggregation
analyticsQueue.process('aggregate-manual', async (job) => {
    logger.info(`Processing manual analytics aggregation job ${job.id}`);
    
    try {
        const { date } = job.data;
        await analyticsService.aggregateDailyStatistics(date);
        logger.info(`Manual analytics aggregation job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Manual analytics aggregation job ${job.id} failed:`, error.message);
        throw error;
    }
});

// Queue event listeners
analyticsQueue.on('completed', (job) => {
    logger.info(`Analytics job ${job.id} completed`);
});

analyticsQueue.on('failed', (job, err) => {
    logger.error(`Analytics job ${job.id} failed after all retries:`, err.message);
});

analyticsQueue.on('stalled', (job) => {
    logger.warn(`Analytics job ${job.id} stalled`);
});

analyticsQueue.on('error', (error) => {
    logger.error('Analytics queue error:', error);
});

logger.info('Analytics worker initialized and listening for jobs');

export default analyticsQueue;
