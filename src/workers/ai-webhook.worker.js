import { aiWebhookQueue } from '../config/queue.config.js';
import aiWebhookService from '../services/ai-webhook.service.js';
import logger from '../config/logger.js';

/**
 * AI Webhook Queue Processor
 * Processes AI webhook jobs from the queue
 */

// Process AI webhook jobs
aiWebhookQueue.process('dispatch-webhook', async (job) => {
    logger.info(`Processing AI webhook job ${job.id}`);
    
    try {
        const { endpoint, payload } = job.data;
        await aiWebhookService.dispatchWebhook(endpoint, payload);
        logger.info(`AI webhook job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`AI webhook job ${job.id} failed:`, error.message);
        throw error; // Will trigger retry based on queue configuration
    }
});

// Queue event listeners
aiWebhookQueue.on('completed', (job) => {
    logger.info(`AI webhook job ${job.id} completed`);
});

aiWebhookQueue.on('failed', (job, err) => {
    logger.error(`AI webhook job ${job.id} failed after all retries:`, err.message);
});

aiWebhookQueue.on('stalled', (job) => {
    logger.warn(`AI webhook job ${job.id} stalled`);
});

aiWebhookQueue.on('error', (error) => {
    logger.error('AI webhook queue error:', error);
});

logger.info('AI webhook worker initialized and listening for jobs');

export default aiWebhookQueue;
