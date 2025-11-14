import bidRepository from '../repositories/bid.repository.js';
import auctionRepository from '../repositories/auction.repository.js';
import userRepository from '../repositories/user.repository.js';
import logger from '../config/logger.js';

/**
 * BidService - Business logic layer for Bid operations
 * Handles bid placement, validation, status updates, and winner determination
 */
class BidService {
    /**
     * Place a new bid on an auction
     * @param {Object} bidData - Bid data
     * @param {string} bidderId - Bidder user ID
     * @param {Object} metadata - Request metadata (IP, user agent)
     * @returns {Promise<Object>} - Created bid and updated auction
     */
    async placeBid(bidData, bidderId, metadata = {}) {
        try {
            const { auctionId, amount, bidMethod = 'manual' } = bidData;

            // Validate auction exists
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Validate auction is active
            if (auction.status !== 'active') {
                throw new Error('AUCTION_NOT_ACTIVE');
            }

            // Check if auction has started and not ended
            const now = new Date();
            if (now < new Date(auction.timing.startTime)) {
                throw new Error('AUCTION_NOT_STARTED');
            }

            if (now >= new Date(auction.timing.endTime)) {
                throw new Error('AUCTION_ENDED');
            }

            // Validate bidder is not the seller
            if (auction.seller.toString() === bidderId.toString()) {
                throw new Error('SELLER_CANNOT_BID_ON_OWN_AUCTION');
            }

            // Validate bid amount is greater than current price
            if (amount <= auction.pricing.currentPrice) {
                throw new Error('BID_AMOUNT_TOO_LOW');
            }

            // Validate bid amount is a positive number
            if (amount <= 0) {
                throw new Error('BID_AMOUNT_MUST_BE_POSITIVE');
            }

            // Get the current highest bid
            const currentHighestBid = await bidRepository.findHighestBid(auctionId);

            // If there's a current highest bid, ensure new bid is higher
            if (currentHighestBid && amount <= currentHighestBid.amount) {
                throw new Error('BID_AMOUNT_MUST_BE_HIGHER_THAN_CURRENT_BID');
            }

            // Create bid
            const bid = await bidRepository.create({
                auction: auctionId,
                bidder: bidderId,
                amount,
                timestamp: new Date(),
                status: 'active',
                metadata: {
                    ipAddress: metadata.ipAddress || null,
                    userAgent: metadata.userAgent || null,
                    bidMethod
                }
            });

            // Mark previous active bids as outbid
            await bidRepository.markPreviousBidsAsOutbid(auctionId, bid._id);

            // Update auction with new bid info
            const updatedAuction = await auctionRepository.updateBidInfo(
                auctionId,
                amount,
                bid._id
            );

            // Increment user's bid count
            await userRepository.incrementStats(bidderId, { totalBids: 1 });

            logger.info(`Bid placed: ${bid._id} on auction ${auctionId} by bidder ${bidderId}`);

            // Return bid with populated fields
            const populatedBid = await bidRepository.findById(bid._id, ['bidder', 'auction']);

            return {
                bid: populatedBid,
                auction: updatedAuction
            };
        } catch (error) {
            logger.error('Error placing bid:', error.message);
            throw error;
        }
    }

    /**
     * Get bid by ID
     * @param {string} bidId - Bid ID
     * @param {boolean} populate - Whether to populate references
     * @returns {Promise<Object>} - Bid
     */
    async getBidById(bidId, populate = false) {
        try {
            const populateFields = populate ? ['bidder', 'auction'] : null;
            const bid = await bidRepository.findById(bidId, populateFields);

            if (!bid) {
                throw new Error('BID_NOT_FOUND');
            }

            return bid;
        } catch (error) {
            logger.error(`Error getting bid ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get bid history for an auction
     * @param {string} auctionId - Auction ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Bids and pagination info
     */
    async getBidHistoryByAuction(auctionId, options = {}) {
        try {
            // Validate auction exists
            const auctionExists = await auctionRepository.exists(auctionId);
            if (!auctionExists) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            const {
                page = 1,
                limit = 50,
                sort = { amount: -1, timestamp: -1 },
                populate = true
            } = options;

            const result = await bidRepository.findByAuction(auctionId, {
                page,
                limit,
                sort,
                populate
            });

            return result;
        } catch (error) {
            logger.error(`Error getting bid history for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get bid history for a user
     * @param {string} bidderId - Bidder user ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Bids and pagination info
     */
    async getBidHistoryByUser(bidderId, options = {}) {
        try {
            // Validate user exists
            const userExists = await userRepository.exists(bidderId);
            if (!userExists) {
                throw new Error('USER_NOT_FOUND');
            }

            const {
                page = 1,
                limit = 50,
                sort = { timestamp: -1 },
                populate = true
            } = options;

            const result = await bidRepository.findByBidder(bidderId, {
                page,
                limit,
                sort,
                populate
            });

            return result;
        } catch (error) {
            logger.error(`Error getting bid history for user ${bidderId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update bid status
     * @param {string} bidId - Bid ID
     * @param {string} newStatus - New status
     * @returns {Promise<Object>} - Updated bid
     */
    async updateBidStatus(bidId, newStatus) {
        try {
            // Validate status
            const validStatuses = ['active', 'outbid', 'won', 'lost'];
            if (!validStatuses.includes(newStatus)) {
                throw new Error('INVALID_BID_STATUS');
            }

            const bid = await bidRepository.findById(bidId);
            if (!bid) {
                throw new Error('BID_NOT_FOUND');
            }

            const updatedBid = await bidRepository.updateStatus(bidId, newStatus);

            logger.info(`Bid status updated: ${bidId} to ${newStatus}`);

            return updatedBid;
        } catch (error) {
            logger.error(`Error updating bid status ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Determine winner when auction closes
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object>} - Winner information
     */
    async determineWinner(auctionId) {
        try {
            // Validate auction exists
            const auction = await auctionRepository.findById(auctionId);
            if (!auction) {
                throw new Error('AUCTION_NOT_FOUND');
            }

            // Check if auction is closed
            if (auction.status !== 'closed') {
                throw new Error('AUCTION_NOT_CLOSED');
            }

            // Get the highest bid
            const winningBid = await bidRepository.findHighestBid(auctionId);

            if (!winningBid) {
                logger.info(`No winner for auction ${auctionId} - no bids placed`);
                return {
                    hasWinner: false,
                    message: 'No bids placed on this auction'
                };
            }

            // Check if reserve price is met (if set)
            if (auction.pricing.reservePrice && winningBid.amount < auction.pricing.reservePrice) {
                logger.info(`Reserve price not met for auction ${auctionId}`);
                
                // Mark all bids as lost
                const allBids = await bidRepository.findByAuction(auctionId, { populate: false });
                const bidIds = allBids.bids.map(bid => bid._id);
                await bidRepository.updateManyStatus(bidIds, 'lost');

                return {
                    hasWinner: false,
                    message: 'Reserve price not met',
                    highestBid: winningBid
                };
            }

            // Mark winning bid as won
            await bidRepository.updateStatus(winningBid._id, 'won');

            // Mark all other bids as lost
            const allBids = await bidRepository.findByAuction(auctionId, { populate: false });
            const losingBidIds = allBids.bids
                .filter(bid => bid._id.toString() !== winningBid._id.toString())
                .map(bid => bid._id);
            
            if (losingBidIds.length > 0) {
                await bidRepository.updateManyStatus(losingBidIds, 'lost');
            }

            // Update auction with winner
            await auctionRepository.setWinner(auctionId, winningBid.bidder);

            // Update winner's stats
            await userRepository.incrementStats(winningBid.bidder, {
                auctionsWon: 1,
                totalSpent: winningBid.amount
            });

            logger.info(`Winner determined for auction ${auctionId}: ${winningBid.bidder}`);

            return {
                hasWinner: true,
                winner: winningBid.bidder,
                winningBid: winningBid,
                finalPrice: winningBid.amount
            };
        } catch (error) {
            logger.error(`Error determining winner for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update fraud analysis for a bid
     * @param {string} bidId - Bid ID
     * @param {Object} fraudAnalysis - Fraud analysis data from AI module
     * @returns {Promise<Object>} - Updated bid
     */
    async updateFraudAnalysis(bidId, fraudAnalysis) {
        try {
            const bid = await bidRepository.findById(bidId);
            if (!bid) {
                throw new Error('BID_NOT_FOUND');
            }

            const updatedBid = await bidRepository.updateFraudAnalysis(bidId, {
                riskScore: fraudAnalysis.riskScore || 0,
                isFlagged: fraudAnalysis.isFlagged || false,
                reasons: fraudAnalysis.reasons || []
            });

            logger.info(`Fraud analysis updated for bid ${bidId}: risk score ${fraudAnalysis.riskScore}`);

            // If bid is flagged as high risk, log warning
            if (fraudAnalysis.isFlagged) {
                logger.warn(`Bid ${bidId} flagged as potentially fraudulent: ${fraudAnalysis.reasons.join(', ')}`);
            }

            return updatedBid;
        } catch (error) {
            logger.error(`Error updating fraud analysis for bid ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get flagged bids (potential fraud)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Flagged bids
     */
    async getFlaggedBids(options = {}) {
        try {
            const { limit = 100, minRiskScore = 0.5 } = options;

            const bids = await bidRepository.findFlaggedBids({
                limit,
                minRiskScore
            });

            return bids;
        } catch (error) {
            logger.error('Error getting flagged bids:', error.message);
            throw error;
        }
    }

    /**
     * Get bid statistics
     * @returns {Promise<Object>} - Bid statistics
     */
    async getStatistics() {
        try {
            const stats = await bidRepository.getStatistics();
            return stats;
        } catch (error) {
            logger.error('Error getting bid statistics:', error.message);
            throw error;
        }
    }

    /**
     * Check if user has bid on an auction
     * @param {string} auctionId - Auction ID
     * @param {string} bidderId - Bidder user ID
     * @returns {Promise<boolean>} - True if user has bid
     */
    async hasUserBidOnAuction(auctionId, bidderId) {
        try {
            const hasBid = await bidRepository.hasBidOnAuction(auctionId, bidderId);
            return hasBid;
        } catch (error) {
            logger.error('Error checking if user has bid on auction:', error.message);
            throw error;
        }
    }

    /**
     * Get highest bid for an auction
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} - Highest bid or null
     */
    async getHighestBid(auctionId) {
        try {
            const bid = await bidRepository.findHighestBid(auctionId);
            return bid;
        } catch (error) {
            logger.error(`Error getting highest bid for auction ${auctionId}:`, error.message);
            throw error;
        }
    }
}

export default new BidService();
