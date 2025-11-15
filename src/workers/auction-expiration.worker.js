import { auctionExpirationQueue } from '../config/queue.config.js';
import logger from '../config/logger.js';

/**
 * Auction Expiration Queue Processor
 * Processes auction expiration jobs from the queue
 */

// Process auction expiration jobs
auctionExpirationQueue.process('close-auction', async (job) => {
    logger.info(`Processing auction expiration job ${job.id}`);
    
    try {
        const { auctionId } = job.data;
        
        // Import dynamically to avoid circular dependencies
        const { default: auctionService } = await import('../services/auction.service.js');
        
        await auctionService.closeExpiredAuction(auctionId);
        logger.info(`Auction expiration job ${job.id} completed successfully`);
    } catch (error) {
        logger.error(`Auction expiration job ${job.id} failed:`, error.message);
        throw error; // Will trigger retry based on queue configuration
    }
});

// Queue event listeners
auctionExpirationQueue.on('completed', (job) => {
    logger.info(`Auction expiration job ${job.id} completed`);
});

auctionExpirationQueue.on('failed', (job, err) => {
    logger.error(`Auction expiration job ${job.id} failed after all retries:`, err.message);
});

auctionExpirationQueue.on('stalled', (job) => {
    logger.warn(`Auction expiration job ${job.id} stalled`);
});

auctionExpirationQueue.on('error', (error) => {
    logger.error('Auction expiration queue error:', error);
});

logger.info('Auction expiration worker initialized and listening for jobs');

export default auctionExpirationQueue;
