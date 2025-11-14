import { emailQueue } from '../config/queue.config.js';
import notificationService from '../services/notification.service.js';
import logger from '../config/logger.js';

/**
 * Email Queue Processor
 * Processes email notification jobs from the queue
 */

// Process email notification jobs
emailQueue.process('send-email', async (job) => {
    logger.info(`Processing email job ${job.id}`);
    
    try {
        await notificationService.processEmailNotification(job);
        logger.info(`Email job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Email job ${job.id} failed:`, error.message);
        throw error; // Will trigger retry based on queue configuration
    }
});

// Queue event listeners
emailQueue.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed`);
});

emailQueue.on('failed', (job, err) => {
    logger.error(`Email job ${job.id} failed after all retries:`, err.message);
});

emailQueue.on('stalled', (job) => {
    logger.warn(`Email job ${job.id} stalled`);
});

logger.info('Email worker initialized and listening for jobs');

export default emailQueue;
