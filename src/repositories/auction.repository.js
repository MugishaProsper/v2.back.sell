import Auction from '../models/auction.model.js';
import logger from '../config/logger.js';

/**
 * AuctionRepository - Data access layer for Auction entity
 * Handles all database operations for auctions with query optimization
 */
class AuctionRepository {
    /**
     * Create a new auction
     * @param {Object} auctionData - Auction data
     * @returns {Promise<Object>} - Created auction
     */
    async create(auctionData) {
        try {
            const auction = new Auction(auctionData);
            await auction.save();
            logger.info(`Auction created: ${auction._id} by seller ${auction.seller}`);
            return auction;
        } catch (error) {
            logger.error('Error creating auction:', error.message);
            throw error;
        }
    }

    /**
     * Find auction by ID with optional field projection and population
     * @param {string} auctionId - Auction ID
     * @param {Object} projection - Fields to include/exclude
     * @param {string|Array} populate - Fields to populate
     * @returns {Promise<Object|null>} - Auction or null
     */
    async findById(auctionId, projection = {}, populate = null) {
        try {
            let query = Auction.findById(auctionId).select(projection);
            
            if (populate) {
                query = query.populate(populate);
            }
            
            const auction = await query.lean();
            return auction;
        } catch (error) {
            logger.error(`Error finding auction by ID ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update auction by ID
     * @param {string} auctionId - Auction ID
     * @param {Object} updateData - Data to update
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async update(auctionId, updateData) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $set: updateData },
                { new: true, runValidators: true }
            ).lean();
            
            if (auction) {
                logger.info(`Auction updated: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error updating auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete auction by ID
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} - Deleted auction or null
     */
    async delete(auctionId) {
        try {
            const auction = await Auction.findByIdAndDelete(auctionId).lean();
            
            if (auction) {
                logger.info(`Auction deleted: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error deleting auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find auctions with pagination
     * @param {Object} filter - Filter criteria
     * @param {number} page - Page number (default: 1)
     * @param {number} limit - Items per page (10-100, default: 10)
     * @param {Object} sort - Sort criteria
     * @returns {Promise<Object>} - Auctions and pagination info
     */
    async findWithPagination(filter = {}, page = 1, limit = 10, sort = { createdAt: -1 }) {
        try {
            // Ensure limit is within bounds (10-100)
            limit = Math.max(10, Math.min(100, limit));
            const skip = (page - 1) * limit;
            
            const [auctions, total] = await Promise.all([
                Auction.find(filter)
                    .sort(sort)
                    .skip(skip)
                    .limit(limit)
                    .populate('seller', 'email profile.firstName profile.lastName')
                    .lean(),
                Auction.countDocuments(filter)
            ]);

            return {
                auctions,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error finding auctions with pagination:', error.message);
            throw error;
        }
    }

    /**
     * Search auctions with text search and filters
     * @param {Object} searchParams - Search parameters
     * @returns {Promise<Object>} - Search results with pagination
     */
    async search(searchParams) {
        try {
            const {
                query,
                category,
                minPrice,
                maxPrice,
                status,
                page = 1,
                limit = 10,
                sortBy = 'relevance'
            } = searchParams;

            // Ensure limit is within bounds (10-100)
            const validLimit = Math.max(10, Math.min(100, limit));
            const skip = (page - 1) * validLimit;

            // Build filter object
            const filter = {};

            // Text search
            if (query) {
                filter.$text = { $search: query };
            }

            // Category filter
            if (category) {
                filter.category = category;
            }

            // Price range filter
            if (minPrice !== undefined || maxPrice !== undefined) {
                filter['pricing.currentPrice'] = {};
                if (minPrice !== undefined) {
                    filter['pricing.currentPrice'].$gte = minPrice;
                }
                if (maxPrice !== undefined) {
                    filter['pricing.currentPrice'].$lte = maxPrice;
                }
            }

            // Status filter
            if (status) {
                filter.status = status;
            }

            // Build sort object
            let sort = {};
            switch (sortBy) {
                case 'price_asc':
                    sort = { 'pricing.currentPrice': 1 };
                    break;
                case 'price_desc':
                    sort = { 'pricing.currentPrice': -1 };
                    break;
                case 'ending_soon':
                    sort = { 'timing.endTime': 1 };
                    break;
                case 'newest':
                    sort = { createdAt: -1 };
                    break;
                case 'relevance':
                default:
                    // If text search is used, sort by text score
                    if (query) {
                        sort = { score: { $meta: 'textScore' } };
                    } else {
                        sort = { createdAt: -1 };
                    }
                    break;
            }

            // Build query
            let queryBuilder = Auction.find(filter);

            // Add text score for relevance sorting
            if (query && sortBy === 'relevance') {
                queryBuilder = queryBuilder.select({ score: { $meta: 'textScore' } });
            }

            const [auctions, total] = await Promise.all([
                queryBuilder
                    .sort(sort)
                    .skip(skip)
                    .limit(validLimit)
                    .populate('seller', 'email profile.firstName profile.lastName')
                    .lean(),
                Auction.countDocuments(filter)
            ]);

            return {
                auctions,
                pagination: {
                    page,
                    limit: validLimit,
                    total,
                    pages: Math.ceil(total / validLimit)
                },
                filters: {
                    query,
                    category,
                    minPrice,
                    maxPrice,
                    status,
                    sortBy
                }
            };
        } catch (error) {
            logger.error('Error searching auctions:', error.message);
            throw error;
        }
    }

    /**
     * Find auctions by seller
     * @param {string} sellerId - Seller user ID
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} - Auctions and pagination info
     */
    async findBySeller(sellerId, page = 1, limit = 10) {
        try {
            return await this.findWithPagination(
                { seller: sellerId },
                page,
                limit,
                { createdAt: -1 }
            );
        } catch (error) {
            logger.error(`Error finding auctions by seller ${sellerId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find active auctions
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} - Active auctions and pagination info
     */
    async findActive(page = 1, limit = 10) {
        try {
            const now = new Date();
            return await this.findWithPagination(
                {
                    status: 'active',
                    'timing.startTime': { $lte: now },
                    'timing.endTime': { $gt: now }
                },
                page,
                limit,
                { 'timing.endTime': 1 }
            );
        } catch (error) {
            logger.error('Error finding active auctions:', error.message);
            throw error;
        }
    }

    /**
     * Find expired auctions that need to be closed
     * @returns {Promise<Array>} - Expired auctions
     */
    async findExpired() {
        try {
            const now = new Date();
            const auctions = await Auction.find({
                status: 'active',
                'timing.endTime': { $lte: now }
            }).lean();
            
            return auctions;
        } catch (error) {
            logger.error('Error finding expired auctions:', error.message);
            throw error;
        }
    }

    /**
     * Update auction status
     * @param {string} auctionId - Auction ID
     * @param {string} status - New status
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async updateStatus(auctionId, status) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $set: { status } },
                { new: true }
            ).lean();
            
            if (auction) {
                logger.info(`Auction status updated: ${auctionId} to ${status}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error updating auction status ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Increment bid count and update current price
     * @param {string} auctionId - Auction ID
     * @param {number} newPrice - New current price
     * @param {string} highestBidId - Highest bid ID
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async updateBidInfo(auctionId, newPrice, highestBidId) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                {
                    $inc: { 'bidding.totalBids': 1 },
                    $set: {
                        'pricing.currentPrice': newPrice,
                        'bidding.highestBid': highestBidId
                    }
                },
                { new: true }
            ).lean();
            
            if (auction) {
                logger.info(`Auction bid info updated: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error updating auction bid info ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Set auction winner
     * @param {string} auctionId - Auction ID
     * @param {string} winnerId - Winner user ID
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async setWinner(auctionId, winnerId) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $set: { 'bidding.winner': winnerId, status: 'closed' } },
                { new: true }
            ).lean();
            
            if (auction) {
                logger.info(`Auction winner set: ${auctionId} - winner: ${winnerId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error setting auction winner ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Update AI insights for auction
     * @param {string} auctionId - Auction ID
     * @param {Object} insights - AI insights data
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async updateAIInsights(auctionId, insights) {
        try {
            const updateData = {
                'aiInsights.predictedPrice': insights.predictedPrice,
                'aiInsights.priceRange': insights.priceRange,
                'aiInsights.confidence': insights.confidence,
                'aiInsights.lastUpdated': new Date()
            };

            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $set: updateData },
                { new: true }
            ).lean();
            
            if (auction) {
                logger.info(`Auction AI insights updated: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error updating auction AI insights ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Increment auction views
     * @param {string} auctionId - Auction ID
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async incrementViews(auctionId) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $inc: { 'metadata.views': 1 } },
                { new: true }
            ).select('metadata.views').lean();
            
            return auction;
        } catch (error) {
            logger.error(`Error incrementing auction views ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Add watcher to auction
     * @param {string} auctionId - Auction ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async addWatcher(auctionId, userId) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $addToSet: { 'metadata.watchers': userId } },
                { new: true }
            ).select('metadata.watchers').lean();
            
            if (auction) {
                logger.info(`Watcher added to auction: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error adding watcher to auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Remove watcher from auction
     * @param {string} auctionId - Auction ID
     * @param {string} userId - User ID
     * @returns {Promise<Object|null>} - Updated auction or null
     */
    async removeWatcher(auctionId, userId) {
        try {
            const auction = await Auction.findByIdAndUpdate(
                auctionId,
                { $pull: { 'metadata.watchers': userId } },
                { new: true }
            ).select('metadata.watchers').lean();
            
            if (auction) {
                logger.info(`Watcher removed from auction: ${auctionId}`);
            }
            
            return auction;
        } catch (error) {
            logger.error(`Error removing watcher from auction ${auctionId}:`, error.message);
            throw error;
        }
    }

    /**
     * Get auction statistics
     * @returns {Promise<Object>} - Auction statistics
     */
    async getStatistics() {
        try {
            const stats = await Auction.aggregate([
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
                        totalValue: [
                            {
                                $match: { status: { $in: ['active', 'closed'] } }
                            },
                            {
                                $group: {
                                    _id: null,
                                    total: { $sum: '$pricing.currentPrice' }
                                }
                            }
                        ],
                        averagePrice: [
                            {
                                $match: { status: { $in: ['active', 'closed'] } }
                            },
                            {
                                $group: {
                                    _id: null,
                                    average: { $avg: '$pricing.currentPrice' }
                                }
                            }
                        ],
                        categoryDistribution: [
                            {
                                $group: {
                                    _id: '$category',
                                    count: { $sum: 1 }
                                }
                            },
                            {
                                $sort: { count: -1 }
                            },
                            {
                                $limit: 10
                            }
                        ]
                    }
                }
            ]);

            return stats[0];
        } catch (error) {
            logger.error('Error getting auction statistics:', error.message);
            throw error;
        }
    }

    /**
     * Check if auction exists
     * @param {string} auctionId - Auction ID
     * @returns {Promise<boolean>} - True if exists
     */
    async exists(auctionId) {
        try {
            const count = await Auction.countDocuments({ _id: auctionId });
            return count > 0;
        } catch (error) {
            logger.error(`Error checking auction existence ${auctionId}:`, error.message);
            throw error;
        }
    }
}

export default new AuctionRepository();
