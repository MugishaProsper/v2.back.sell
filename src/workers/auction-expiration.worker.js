import { auctionExpirationQueue } from '../config/queue.config.js';
import logger from '../config/logger.js';

/**
 * Auction Expiration Queue Processor
 * Processes auction expiration jobs from the queue
 */

// Process individual auction expiration jobs
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

// Process scheduled check for expired auctions
auctionExpirationQueue.process('check-expired-auctions', async (job) => {
    logger.info(`Processing scheduled auction expiration check ${job.id}`);
    
    try {
        // Import dynamically to avoid circular dependencies
        const { default: auctionRepository } = await import('../repositories/auction.repository.js');
        
        // Find all expired auctions
        const expiredAuctions = await auctionRepository.findExpired();
        
        if (expiredAuctions.length === 0) {
            logger.info('No expired auctions found');
            return { processed: 0 };
        }
        
        logger.info(`Found ${expiredAuctions.length} expired auctions to close`);
        
        // Queue individual close jobs for each expired auction
        const closeJobs = expiredAuctions.map(auction => 
            auctionExpirationQueue.add('close-auction', {
                auctionId: auction._id.toString()
            }, {
                attempts: 3,
                backoff: {
                    type: 'exponential',
                    delay: 2000
                }
            })
        );
        
        await Promise.all(closeJobs);
        
        logger.info(`Queued ${expiredAuctions.length} auction close jobs`);
        
        return { processed: expiredAuctions.length };
    } catch (error) {
        logger.error(`Scheduled auction expiration check ${job.id} failed:`, error.message);
        throw error;
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
