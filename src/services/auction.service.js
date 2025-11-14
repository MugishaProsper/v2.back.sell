import auctionRepository from '../repositories/auction.repository.js';
import userRepository from '../repositories/user.repository.js';
import realtimeService from './realtime.service.js';
import aiWebhookService from './ai-webhook.service.js';
import notificationEventService from './notification-event.service.js';
import bidRepository from '../repositories/bid.repository.js';
import cacheService from './cache.service.js';
import logger from '../config/logger.js';
import Bull from 'bull';
import { configDotenv } from 'dotenv';

configDotenv();

/**
 * AuctionService - Business logic layer for Auction operations
 * Handles auction creation, updates, deletion, and lifecycle management
 */
class AuctionService {
    constructor() {
        // Initialize Bull queue for auction expiration
        this.auctionExpirationQueue = new Bull('auction-expiration', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined
            }
        });

        // Process auction expiration jobs
        this.auctionExpirationQueue.process(async (job) => {
            const { auctionId } = job.data;
            await this.closeExpiredAuction(auctionId);
        });

        logger.info('AuctionService initialized with Bull queue');
    }

    /**
     * Create a new auction
     * @param {Object} auctionData - Auction data
     * @param {string} sellerId - Seller user ID
     * @returns {Promise<Object>} - Created auction
     */
    async createAuction(auctionData, sellerId) {
        try {
            // Validate seller exists
            const seller = await userRepository.findById(sellerId);
            if (!seller) {
                throw new Error('SELLER_NOT_FOUND');
            }

            // Validate timing
            const startTime = new Date(auctionData.startTime);
            const endTime = new Date(auctionData.endTime);
            const now = new Date();

            if (endTime <= startTime) {
                throw new Error('END_TIME_MUST_BE_AFTER_START_TIME');
            }

            if (endTime <= now) {
                throw new Error('END_TIME_MUST_BE_IN_FUTURE');
            }

            // Calculate duration in hours
            const durationMs = endTime - startTime;
            const duration = Math.ceil(durationMs / (1000 * 60 * 60));

            if (duration < 1) {
                throw new Error('DURATION_MUST_BE_AT_LEAST_1_HOUR');
            }

            // Validate pricing
            if (auctionData.startingPrice < 0) {
                throw new Error('STARTING_PRICE_MUST_BE_POSITIVE');
            }

            if (auctionData.reservePrice && auctionData.reservePrice < auctionData.startingPrice) {
                throw new Error('RESERVE_PRICE_MUST_BE_GREATER_THAN_STARTING_PRICE');
            }

            if (auctionData.buyNowPrice && auctionData.buyNowPrice <= auctionData.startingPrice) {
                throw new Error('BUY_NOW_PRICE_MUST_BE_GREATER_THAN_STARTING_PRICE');
            }

            // Prepare auction data
            const auction = {
                seller: sellerId,
                title: auctionData.title,
                description: auctionData.description,
                category: auctionData.category,
                images: auctionData.images || [],
                pricing: {
                    startingPrice: auctionData.startingPrice,
                    currentPrice: auctionData.startingPrice,
                    reservePrice: auctionData.reservePrice,
                    buyNowPrice: auctionData.buyNowPrice
                },
                timing: {
                    startTime,
                    endTime,
                    duration
                },
                status: auctionData.status || 'draft'
            };

            // Create auction
            const createdAuction = await auctionRepository.create(auction);

            // Schedule expiration job if auction is active
            if (createdAuction.status === 'active') {
                await this.scheduleAuctionExpiration(createdAuction._id, endTime);
            }

            // Increment seller's auction count
            await userRepository.incrementStats(sellerId, { auctionsCreated: 1 });

            logger.info(`Auction created: ${createdAuction._id} by seller ${sellerId}`);

            // Invalidate search cache since new auction was created
            await cacheService.invalidateSearchCache();

            // Queue webhook to AI module for auction creation
            if (createdAuction.status === 'active') {
                try {
                    await aiWebhookService.queueAuctionCreated(createdAuction);
                } catch (error) {
                    logger.error('Failed to queue auction-created webhook:', error.message);
                    // Don't fail auction creation if webhook fails
                }
            }

            return createdAuction;
        } catch (error) {
            logger.error('Error creating auction:', error.message);
            throw error;
        }
    }

    /**
     * Update an existing auction
     * @param {string} auctionId - Auction ID
     * @param {Object} updateData - Data to update
     * @param {string} userId - User ID making the update
     * @returns {Promise<Object>} - Updated auction
     */
    async updateAuction(auctionId, updateData, userId) {
        try {
            // Find auction
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Check ownership
            if (auction.seller.toString() !== userId.toString()) {
                throw new Error('UNAUTHORIZED_NOT_OWNER');
            }

            // Check if auction has bids
            if (auction.bidding.totalBids > 0) {
                throw new Error('CANNOT_UPDATE_AUCTION_WITH_BIDS');
            }

            // Validate timing if being updated
            if (updateData.startTime || updateData.endTime) {
                const startTime = updateData.startTime ? new Date(updateData.startTime) : auction.timing.startTime;
                const endTime = updateData.endTime ? new Date(updateData.endTime) : auction.timing.endTime;

                if (endTime <= startTime) {
                    throw new Error('END_TIME_MUST_BE_AFTER_START_TIME');
                }

                const now = new Date();
                if (endTime <= now) {
                    throw new Error('END_TIME_MUST_BE_IN_FUTURE');
                }

                // Calculate new duration
                const durationMs = endTime - startTime;
                const duration = Math.ceil(durationMs / (1000 * 60 * 60));

                updateData.timing = {
                    startTime,
                    endTime,
                    duration
                };
            }

            // Validate pricing if being updated
            if (updateData.startingPrice !== undefined) {
                if (updateData.startingPrice < 0) {
                    throw new Error('STARTING_PRICE_MUST_BE_POSITIVE');
                }

                // Update current price if starting price changes
                updateData.pricing = {
                    ...auction.pricing,
                    startingPrice: updateData.startingPrice,
                    currentPrice: updateData.startingPrice
                };
            }

            // Update auction
            const updatedAuction = await auctionRepository.update(auctionId, updateData);

            // Reschedule expiration if timing changed and auction is active
            if (updateData.timing && updatedAuction.status === 'active') {
                await this.scheduleAuctionExpiration(auctionId, updatedAuction.timing.endTime);
            }

            logger.info(`Auction updated: ${auctionId}`);

            // Invalidate auction-related caches
            await cacheService.invalidateAuctionCache(auctionId);

            // Emit auction update event
            if (realtimeService.isInitialized()) {
                realtimeService.emitAuctionUpdate(auctionId, updatedAuction, 'details');
            }

            return updatedAuction;
        } catch (error) {
            logger.error(`Error updating auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete an auction
     * @param {string} auctionId - Auction ID
     * @param {string} userId - User ID making the deletion
     * @returns {Promise<Object>} - Deleted auction
     */
    async deleteAuction(auctionId, userId) {
        try {
            // Find auction
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Check ownership
            if (auction.seller.toString() !== userId.toString()) {
                throw new Error('UNAUTHORIZED_NOT_OWNER');
            }

            // Check if auction has bids
            if (auction.bidding.totalBids > 0) {
                throw new Error('CANNOT_DELETE_AUCTION_WITH_BIDS');
            }

            // Delete auction
            const deletedAuction = await auctionRepository.delete(auctionId);

            // Remove expiration job if exists
            await this.removeAuctionExpirationJob(auctionId);

            // Decrement seller's auction count
            await userRepository.incrementStats(userId, { auctionsCreated: -1 });

            // Invalidate auction-related caches
            await cacheService.invalidateAuctionCache(auctionId);

            logger.info(`Auction deleted: ${auctionId}`);

            return deletedAuction;
        } catch (error) {
            logger.error(`Error deleting auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get auction by ID
     * @param {string} auctionId - Auction ID
     * @param {boolean} incrementViews - Whether to increment view count
     * @returns {Promise<Object>} - Auction
     */
    async getAuctionById(auctionId, incrementViews = false) {
        try {
            const auction = await auctionRepository.findById(
                auctionId,
                {},
                'seller'
            );

            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Increment views if requested
            if (incrementViews) {
                await auctionRepository.incrementViews(auctionId);
            }

            return auction;
        } catch (error) {
            logger.error(`Error getting auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * List auctions with pagination
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Auctions and pagination info
     */
    async listAuctions(options = {}) {
        try {
            const {
                page = 1,
                limit = 10,
                status,
                category,
                sellerId
            } = options;

            const filter = {};

            if (status) {
                filter.status = status;
            }

            if (category) {
                filter.category = category;
            }

            if (sellerId) {
                filter.seller = sellerId;
            }

            const result = await auctionRepository.findWithPagination(
                filter,
                page,
                limit
            );

            return result;
        } catch (error) {
            logger.error('Error listing auctions:', error.message);
            throw error;
        }
    }

    /**
     * Search auctions with caching
     * @param {Object} searchParams - Search parameters
     * @returns {Promise<Object>} - Search results
     */
    async searchAuctions(searchParams) {
        try {
            // Generate cache key from search parameters
            const cacheKey = cacheService.generateSearchKey(searchParams);
            
            // Try to get from cache first
            const cached = await cacheService.get(cacheKey);
            if (cached) {
                logger.info('Returning cached search results');
                return {
                    ...cached,
                    performance: {
                        ...cached.performance,
                        cached: true
                    }
                };
            }
            
            // If not in cache, fetch from database
            const result = await auctionRepository.search(searchParams);
            
            // Cache the result with 5 minute TTL
            await cacheService.set(cacheKey, result, 300);
            
            return result;
        } catch (error) {
            logger.error('Error searching auctions:', error.message);
            throw error;
        }
    }

    /**
     * Update auction status
     * @param {string} auctionId - Auction ID
     * @param {string} newStatus - New status
     * @param {string} userId - User ID making the change
     * @returns {Promise<Object>} - Updated auction
     */
    async updateAuctionStatus(auctionId, newStatus, userId) {
        try {
            // Find auction
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Check ownership
            if (auction.seller.toString() !== userId.toString()) {
                throw new Error('UNAUTHORIZED_NOT_OWNER');
            }

            // Validate status transition
            const validStatuses = ['draft', 'active', 'closed', 'cancelled'];
            if (!validStatuses.includes(newStatus)) {
                throw new Error('INVALID_STATUS');
            }

            // Update status
            const updatedAuction = await auctionRepository.updateStatus(auctionId, newStatus);

            // Schedule or remove expiration job based on status
            if (newStatus === 'active') {
                await this.scheduleAuctionExpiration(auctionId, auction.timing.endTime);
            } else if (newStatus === 'closed' || newStatus === 'cancelled') {
                await this.removeAuctionExpirationJob(auctionId);
            }

            logger.info(`Auction status updated: ${auctionId} to ${newStatus}`);

            // Invalidate auction-related caches
            await cacheService.invalidateAuctionCache(auctionId);

            // Emit auction update event
            if (realtimeService.isInitialized()) {
                realtimeService.emitAuctionUpdate(auctionId, updatedAuction, 'status');
            }

            return updatedAuction;
        } catch (error) {
            logger.error(`Error updating auction status ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Add images to auction
     * @param {string} auctionId - Auction ID
     * @param {Array} images - Array of image objects
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Updated auction
     */
    async addImages(auctionId, images, userId) {
        try {
            // Find auction
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Check ownership
            if (auction.seller.toString() !== userId.toString()) {
                throw new Error('UNAUTHORIZED_NOT_OWNER');
            }

            // Validate image count (max 10)
            const currentImageCount = auction.images?.length || 0;
            const newImageCount = images.length;

            if (currentImageCount + newImageCount > 10) {
                throw new Error('MAX_10_IMAGES_ALLOWED');
            }

            // Validate image size (max 5MB per image)
            const maxSize = 5 * 1024 * 1024; // 5MB in bytes
            for (const image of images) {
                if (image.size && image.size > maxSize) {
                    throw new Error('IMAGE_SIZE_EXCEEDS_5MB');
                }
            }

            // Prepare image objects
            const imageObjects = images.map((img, index) => ({
                url: img.url,
                publicId: img.publicId || null,
                order: currentImageCount + index
            }));

            // Update auction with new images
            const updatedAuction = await auctionRepository.update(auctionId, {
                $push: { images: { $each: imageObjects } }
            });

            logger.info(`Images added to auction: ${auctionId}`);

            return updatedAuction;
        } catch (error) {
            logger.error(`Error adding images to auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Schedule auction expiration job
     * @param {string} auctionId - Auction ID
     * @param {Date} endTime - Auction end time
     */
    async scheduleAuctionExpiration(auctionId, endTime) {
        try {
            const delay = endTime - new Date();

            if (delay > 0) {
                // Remove existing job if any
                await this.removeAuctionExpirationJob(auctionId);

                // Schedule new job
                await this.auctionExpirationQueue.add(
                    { auctionId },
                    {
                        delay,
                        jobId: `auction-expiration-${auctionId}`,
                        removeOnComplete: true
                    }
                );

                logger.info(`Auction expiration scheduled: ${auctionId} at ${endTime}`);
            } else {
                // Auction already expired, close immediately
                await this.closeExpiredAuction(auctionId);
            }
        } catch (error) {
            logger.error(`Error scheduling auction expiration ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Remove auction expiration job
     * @param {string} auctionId - Auction ID
     */
    async removeAuctionExpirationJob(auctionId) {
        try {
            const jobId = `auction-expiration-${auctionId}`;
            const job = await this.auctionExpirationQueue.getJob(jobId);

            if (job) {
                await job.remove();
                logger.info(`Auction expiration job removed: ${auctionId}`);
            }
        } catch (error) {
            logger.error(`Error removing auction expiration job ${auctionId}:`, error.message);
            // Don't throw error, just log it
        }
    }

    /**
     * Close expired auction
     * @param {string} auctionId - Auction ID
     */
    async closeExpiredAuction(auctionId) {
        try {
            const auction = await auctionRepository.findById(auctionId);

            if (!auction) {
                logger.warn(`Cannot close expired auction: Auction not found ${auctionId}`);
                return;
            }

            if (auction.status !== 'active') {
                logger.warn(`Cannot close expired auction: Auction not active ${auctionId}`);
                return;
            }

            // Update status to closed
            await auctionRepository.updateStatus(auctionId, 'closed');

            // If there's a highest bid, determine winner
            let winningBid = null;
            let winner = null;
            if (auction.bidding.highestBid) {
                // Import bidService dynamically to avoid circular dependency
                const { default: bidService } = await import('./bid.service.js');
                winningBid = await bidService.determineWinner(auctionId);
                winner = winningBid ? winningBid.bidder : null;
                logger.info(`Auction closed with winner: ${auctionId}`);
                
                // Send notification to winner (within 1 minute requirement)
                if (winningBid && winner) {
                    notificationEventService.notifyAuctionWinner(
                        winner._id || winner,
                        auction,
                        winningBid
                    ).catch(err => logger.error('Failed to send winner notification:', err.message));
                }
            } else {
                logger.info(`Auction closed without bids: ${auctionId}`);
                
                // Emit auction closed event without winner
                if (realtimeService.isInitialized()) {
                    const closedAuction = await auctionRepository.findById(auctionId);
                    realtimeService.emitAuctionClosed(auctionId, closedAuction, null);
                }
            }

            // Send notification to seller (within 1 minute requirement)
            notificationEventService.notifySellerAuctionEnded(
                auction.seller,
                auction,
                winner ? { name: winner.profile?.firstName || 'Winner', amount: winningBid.amount } : null
            ).catch(err => logger.error('Failed to send seller auction ended notification:', err.message));

            // Get all unique bidders and notify them (within 1 minute requirement)
            const allBids = await bidRepository.findByAuction(auctionId, { page: 1, limit: 1000 });
            const uniqueBidderIds = [...new Set(allBids.bids.map(bid => 
                (bid.bidder._id || bid.bidder).toString()
            ))];
            
            if (uniqueBidderIds.length > 0) {
                notificationEventService.notifyBiddersAuctionEnded(
                    uniqueBidderIds,
                    auction,
                    winner ? (winner._id || winner).toString() : null
                ).catch(err => logger.error('Failed to send bidders auction ended notifications:', err.message));
            }

            // Queue webhook to AI module for auction end
            try {
                const closedAuction = await auctionRepository.findById(auctionId);
                await aiWebhookService.queueAuctionEnded(closedAuction, winningBid);
            } catch (error) {
                logger.error('Failed to queue auction-ended webhook:', error.message);
                // Don't fail auction closure if webhook fails
            }

            logger.info(`Expired auction closed: ${auctionId}`);
        } catch (error) {
            logger.error(`Error closing expired auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Process all expired auctions (for scheduled job)
     */
    async processExpiredAuctions() {
        try {
            const expiredAuctions = await auctionRepository.findExpired();

            logger.info(`Processing ${expiredAuctions.length} expired auctions`);

            for (const auction of expiredAuctions) {
                await this.closeExpiredAuction(auction._id);
            }

            return {
                processed: expiredAuctions.length
            };
        } catch (error) {
            logger.error('Error processing expired auctions:', error.message);
            throw error;
        }
    }

    /**
     * Get auction statistics
     * @returns {Promise<Object>} - Auction statistics
     */
    async getStatistics() {
        try {
            const stats = await auctionRepository.getStatistics();
            return stats;
        } catch (error) {
            logger.error('Error getting auction statistics:', error.message);
            throw error;
        }
    }
}

export default new AuctionService();
