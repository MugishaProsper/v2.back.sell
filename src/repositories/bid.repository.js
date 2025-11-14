import Bid from '../models/bid.model.js';
import logger from '../config/logger.js';

/**
 * BidRepository - Data access layer for Bid entity
 * Handles all database operations for bids with query optimization
 */
class BidRepository {
    /**
     * Create a new bid
     * @param {Object} bidData - Bid data
     * @returns {Promise<Object>} - Created bid
     */
    async create(bidData) {
        try {
            const bid = new Bid(bidData);
            await bid.save();
            logger.info(`Bid created: ${bid._id} for auction ${bid.auction} by bidder ${bid.bidder}`);
            return bid;
        } catch (error) {
            logger.error('Error creating bid:', error.message);
            throw error;
        }
    }

    /**
     * Find bid by ID with optional population
     * @param {string} bidId - Bid ID
     * @param {string|Array} populate - Fields to populate
     * @returns {Promise<Object|null>} - Bid or null
     */
    async findById(bidId, populate = null) {
        try {
            let query = Bid.findById(bidId);
            
            if (populate) {
                query = query.populate(populate);
            }
            
            const bid = await query.lean();
            return bid;
        } catch (error) {
            logger.error(`Error finding bid by ID ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update bid by ID
     * @param {string} bidId - Bid ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} - Updated bid or null
     */
    async update(bidId, updateData) {
        try {
            const bid = await Bid.findByIdAndUpdate(
                bidId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();
            
            if (bid) {
                logger.info(`Bid updated: ${bidId}`);
            }
            
            return bid;
        } catch (error) {
            logger.error(`Error updating bid ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete bid by ID
     * @param {string} bidId - Bid ID
     * @returns {Promise<Object|null>} - Deleted bid or null
     */
    async delete(bidId) {
        try {
            const bid = await Bid.findByIdAndDelete(bidId).lean();
            
            if (bid) {
                logger.info(`Bid deleted: ${bidId}`);
            }
            
            return bid;
        } catch (error) {
            logger.error(`Error deleting bid ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find all bids for an auction with pagination
     * @param {string} auctionId - Auction ID
     * @param {Object} options - Query options (page, limit, sort, populate)
     * @returns {Promise<Object>} - Bids and pagination info
     */
    async findByAuction(auctionId, options = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                sort = { amount: -1, timestamp: -1 },
                populate = false
            } = options;

            const skip = (page - 1) * limit;

            let query = Bid.find({ auction: auctionId })
                .sort(sort)
                .skip(skip)
                .limit(limit);

            if (populate) {
                query = query.populate('bidder', 'email profile.firstName profile.lastName');
            }

            const [bids, total] = await Promise.all([
                query.lean(),
                Bid.countDocuments({ auction: auctionId })
            ]);

            return {
                bids,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error(`Error finding bids by auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find all bids by a user with pagination
     * @param {string} bidderId - Bidder user ID
     * @param {Object} options - Query options (page, limit, sort, populate)
     * @returns {Promise<Object>} - Bids and pagination info
     */
    async findByBidder(bidderId, options = {}) {
        try {
            const {
                page = 1,
                limit = 50,
                sort = { timestamp: -1 },
                populate = false
            } = options;

            const skip = (page - 1) * limit;

            let query = Bid.find({ bidder: bidderId })
                .sort(sort)
                .skip(skip)
                .limit(limit);

            if (populate) {
                query = query.populate('auction', 'title status pricing timing');
            }

            const [bids, total] = await Promise.all([
                query.lean(),
                Bid.countDocuments({ bidder: bidderId })
            ]);

            return {
                bids,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error(`Error finding bids by bidder ${bidderId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find the highest bid for an auction
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} - Highest bid or null
     */
    async findHighestBid(auctionId) {
        try {
            const bid = await Bid.findOne({ auction: auctionId })
                .sort({ amount: -1 })
                .populate('bidder', 'email profile')
                .lean();
            
            return bid;
        } catch (error) {
            logger.error(`Error finding highest bid for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find the winning bid for a closed auction
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} - Winning bid or null
     */
    async findWinningBid(auctionId) {
        try {
            // The winning bid is the highest bid with status 'won' or 'active'
            const bid = await Bid.findOne({
                auction: auctionId,
                status: { $in: ['won', 'active'] }
            })
                .sort({ amount: -1 })
                .populate('bidder', 'email profile')
                .lean();
            
            return bid;
        } catch (error) {
            logger.error(`Error finding winning bid for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update bid status
     * @param {string} bidId - Bid ID
     * @param {string} status - New status
     * @returns {Promise<Object|null>} - Updated bid or null
     */
    async updateStatus(bidId, status) {
        try {
            const bid = await Bid.findByIdAndUpdate(
                bidId,
                { $set: { status } },
                { new: true }
            ).lean();
            
            if (bid) {
                logger.info(`Bid status updated: ${bidId} to ${status}`);
            }
            
            return bid;
        } catch (error) {
            logger.error(`Error updating bid status ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update multiple bids status
     * @param {Array<string>} bidIds - Array of bid IDs
     * @param {string} status - New status
     * @returns {Promise<Object>} - Update result
     */
    async updateManyStatus(bidIds, status) {
        try {
            const result = await Bid.updateMany(
                { _id: { $in: bidIds } },
                { $set: { status } }
            );
            
            logger.info(`Updated ${result.modifiedCount} bids to status ${status}`);
            return result;
        } catch (error) {
            logger.error('Error updating multiple bid statuses:', error.message);
            throw error;
        }
    }

    /**
     * Update all previous bids for an auction to 'outbid' status
     * @param {string} auctionId - Auction ID
     * @param {string} excludeBidId - Bid ID to exclude (the new highest bid)
     * @returns {Promise<Object>} - Update result
     */
    async markPreviousBidsAsOutbid(auctionId, excludeBidId) {
        try {
            const result = await Bid.updateMany(
                {
                    auction: auctionId,
                    _id: { $ne: excludeBidId },
                    status: 'active'
                },
                { $set: { status: 'outbid' } }
            );
            
            logger.info(`Marked ${result.modifiedCount} bids as outbid for auction ${auctionId}`);
            return result;
        } catch (error) {
            logger.error(`Error marking bids as outbid for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update fraud analysis for a bid
     * @param {string} bidId - Bid ID
     * @param {Object} fraudAnalysis - Fraud analysis data
     * @returns {Promise<Object|null>} - Updated bid or null
     */
    async updateFraudAnalysis(bidId, fraudAnalysis) {
        try {
            const updateData = {
                'fraudAnalysis.riskScore': fraudAnalysis.riskScore,
                'fraudAnalysis.isFlagged': fraudAnalysis.isFlagged,
                'fraudAnalysis.reasons': fraudAnalysis.reasons,
                'fraudAnalysis.analyzedAt': new Date()
            };

            const bid = await Bid.findByIdAndUpdate(
                bidId,
                { $set: updateData },
                { new: true }
            ).lean();
            
            if (bid) {
                logger.info(`Bid fraud analysis updated: ${bidId}`);
            }
            
            return bid;
        } catch (error) {
            logger.error(`Error updating bid fraud analysis ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find flagged bids (potential fraud)
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Flagged bids
     */
    async findFlaggedBids(options = {}) {
        try {
            const { limit = 100, minRiskScore = 0.5 } = options;

            const bids = await Bid.find({
                'fraudAnalysis.isFlagged': true,
                'fraudAnalysis.riskScore': { $gte: minRiskScore }
            })
                .sort({ 'fraudAnalysis.riskScore': -1, timestamp: -1 })
                .limit(limit)
                .populate('bidder', 'email profile')
                .populate('auction', 'title status')
                .lean();
            
            return bids;
        } catch (error) {
            logger.error('Error finding flagged bids:', error.message);
            throw error;
        }
    }

    /**
     * Get bid count for an auction
     * @param {string} auctionId - Auction ID
     * @returns {Promise<number>} - Bid count
     */
    async countByAuction(auctionId) {
        try {
            const count = await Bid.countDocuments({ auction: auctionId });
            return count;
        } catch (error) {
            logger.error(`Error counting bids for auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get bid count for a user
     * @param {string} bidderId - Bidder user ID
     * @returns {Promise<number>} - Bid count
     */
    async countByBidder(bidderId) {
        try {
            const count = await Bid.countDocuments({ bidder: bidderId });
            return count;
        } catch (error) {
            logger.error(`Error counting bids for bidder ${bidderId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get bid statistics
     * @returns {Promise<Object>} - Bid statistics
     */
    async getStatistics() {
        try {
            const stats = await Bid.aggregate([
                {
                    $facet: {
                        statusCounts: [
                            {
                                $group: {
                                    _id: '$status',
                                    count: { $sum: 1 }
                                }
                            }
                        ],
                        totalBids: [
                            {
                                $count: 'total'
                            }
                        ],
                        averageBidAmount: [
                            {
                                $group: {
                                    _id: null,
                                    average: { $avg: '$amount' }
                                }
                            }
                        ],
                        uniqueBidders: [
                            {
                                $group: {
                                    _id: '$bidder'
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ],
                        fraudStats: [
                            {
                                $group: {
                                    _id: null,
                                    flaggedCount: {
                                        $sum: {
                                            $cond: ['$fraudAnalysis.isFlagged', 1, 0]
                                        }
                                    },
                                    averageRiskScore: {
                                        $avg: '$fraudAnalysis.riskScore'
                                    }
                                }
                            }
                        ]
                    }
                }
            ]);

            return stats[0];
        } catch (error) {
            logger.error('Error getting bid statistics:', error.message);
            throw error;
        }
    }

    /**
     * Check if bid exists
     * @param {string} bidId - Bid ID
     * @returns {Promise<boolean>} - True if exists
     */
    async exists(bidId) {
        try {
            const count = await Bid.countDocuments({ _id: bidId });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking bid existence ${bidId}:`, error.message);
            throw error;
        }
    }

    /**
     * Check if user has bid on an auction
     * @param {string} auctionId - Auction ID
     * @param {string} bidderId - Bidder user ID
     * @returns {Promise<boolean>} - True if user has bid
     */
    async hasBidOnAuction(auctionId, bidderId) {
        try {
            const count = await Bid.countDocuments({
                auction: auctionId,
                bidder: bidderId
            });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking if user has bid on auction:`, error.message);
            throw error;
        }
    }
}

export default new BidRepository();
