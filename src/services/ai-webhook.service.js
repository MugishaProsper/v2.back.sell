import { aiWebhookQueue } from '../config/queue.config.js';
import aiIntegrationService from './ai-integration.service.js';
import logger from '../config/logger.js';

/**
 * AI Webhook Service
 * Handles queuing and dispatching webhooks to AI module
 */
class AIWebhookService {
    constructor() {
        this.initializeProcessors();
    }

    /**
     * Initialize queue processors
     */
    initializeProcessors() {
        // Process webhook jobs
        aiWebhookQueue.process(async (job) => {
            const { endpoint, payload } = job.data;
            
            try {
                logger.info(`Processing webhook job ${job.id}: ${endpoint}`);
                const result = await aiIntegrationService.dispatchWebhook(endpoint, payload);
                return result;
            } catch (error) {
                logger.error(`Webhook job ${job.id} failed:`, error.message);
                throw error;
            }
        });

        logger.info('AI webhook queue processors initialized');
    }

    /**
     * Queue webhook for auction creation
     * @param {object} auctionData - Auction data
     */
    async queueAuctionCreated(auctionData) {
        try {
            const payload = {
                auctionId: auctionData._id.toString(),
                title: auctionData.title,
                description: auctionData.description,
                category: auctionData.category,
                startingPrice: auctionData.pricing.startingPrice,
                images: auctionData.images.map(img => img.url),
                timing: {
                    startTime: auctionData.timing.startTime,
                    endTime: auctionData.timing.endTime,
                    duration: auctionData.timing.duration
                },
                seller: auctionData.seller.toString(),
                createdAt: auctionData.createdAt
            };

            const job = await aiWebhookQueue.add({
                endpoint: '/webhooks/auction-created',
                payload
            }, {
                priority: 2 // Medium priority
            });

            logger.info(`Queued auction-created webhook for auction ${auctionData._id}, job ${job.id}`);
            return job;
        } catch (error) {
            logger.error('Failed to queue auction-created webhook:', error);
            throw error;
        }
    }

    /**
     * Queue webhook for bid placement
     * @param {object} bidData - Bid data
     * @param {object} auctionData - Auction data
     * @param {object} userData - User data
     */
    async queueBidPlaced(bidData, auctionData, userData) {
        try {
            const payload = {
                bidId: bidData._id.toString(),
                auctionId: bidData.auction.toString(),
                userId: bidData.bidder.toString(),
                amount: bidData.amount,
                timestamp: bidData.timestamp,
                auction: {
                    title: auctionData.title,
                    category: auctionData.category,
                    currentPrice: auctionData.pricing.currentPrice,
                    totalBids: auctionData.bidding.totalBids
                },
                userHistory: {
                    totalBids: userData.stats.totalBids,
                    auctionsWon: userData.stats.auctionsWon,
                    totalSpent: userData.stats.totalSpent,
                    averageBidAmount: userData.stats.totalBids > 0 
                        ? userData.stats.totalSpent / userData.stats.totalBids 
                        : 0
                },
                metadata: bidData.metadata
            };

            const job = await aiWebhookQueue.add({
                endpoint: '/webhooks/bid-placed',
                payload
            }, {
                priority: 1 // High priority
            });

            logger.info(`Queued bid-placed webhook for bid ${bidData._id}, job ${job.id}`);
            return job;
        } catch (error) {
            logger.error('Failed to queue bid-placed webhook:', error);
            throw error;
        }
    }

    /**
     * Queue webhook for auction end
     * @param {object} auctionData - Auction data
     * @param {object} winningBidData - Winning bid data (optional)
     */
    async queueAuctionEnded(auctionData, winningBidData = null) {
        try {
            const payload = {
                auctionId: auctionData._id.toString(),
                title: auctionData.title,
                category: auctionData.category,
                finalPrice: auctionData.pricing.currentPrice,
                startingPrice: auctionData.pricing.startingPrice,
                totalBids: auctionData.bidding.totalBids,
                duration: auctionData.timing.duration,
                timing: {
                    startTime: auctionData.timing.startTime,
                    endTime: auctionData.timing.endTime
                },
                winner: winningBidData ? {
                    bidId: winningBidData._id.toString(),
                    userId: winningBidData.bidder.toString(),
                    amount: winningBidData.amount
                } : null,
                seller: auctionData.seller.toString(),
                status: auctionData.status
            };

            const job = await aiWebhookQueue.add({
                endpoint: '/webhooks/auction-ended',
                payload
            }, {
                priority: 2 // Medium priority
            });

            logger.info(`Queued auction-ended webhook for auction ${auctionData._id}, job ${job.id}`);
            return job;
        } catch (error) {
            logger.error('Failed to queue auction-ended webhook:', error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     */
    async getQueueStats() {
        try {
            const [waiting, active, completed, failed, delayed] = await Promise.all([
                aiWebhookQueue.getWaitingCount(),
                aiWebhookQueue.getActiveCount(),
                aiWebhookQueue.getCompletedCount(),
                aiWebhookQueue.getFailedCount(),
                aiWebhookQueue.getDelayedCount()
            ]);

            return {
                waiting,
                active,
                completed,
                failed,
                delayed,
                total: waiting + active + completed + failed + delayed
            };
        } catch (error) {
            logger.error('Failed to get queue stats:', error);
            throw error;
        }
    }

    /**
     * Clear failed jobs
     */
    async clearFailedJobs() {
        try {
            const failed = await aiWebhookQueue.getFailed();
            await Promise.all(failed.map(job => job.remove()));
            logger.info(`Cleared ${failed.length} failed webhook jobs`);
            return failed.length;
        } catch (error) {
            logger.error('Failed to clear failed jobs:', error);
            throw error;
        }
    }

    /**
     * Retry failed jobs
     */
    async retryFailedJobs() {
        try {
            const failed = await aiWebhookQueue.getFailed();
            await Promise.all(failed.map(job => job.retry()));
            logger.info(`Retrying ${failed.length} failed webhook jobs`);
            return failed.length;
        } catch (error) {
            logger.error('Failed to retry failed jobs:', error);
            throw error;
        }
    }
}

// Export singleton instance
const aiWebhookService = new AIWebhookService();
export default aiWebhookService;
