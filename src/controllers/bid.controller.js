import bidService from '../services/bid.service.js';
import logger from '../config/logger.js';

/**
 * Place a new bid on an auction
 * POST /api/v1/bids
 */
export const placeBid = async (req, res) => {
    try {
        const { auctionId, amount, bidMethod } = req.body;

        // Validate required fields
        if (!auctionId || amount === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Missing required fields',
                    details: 'auctionId and amount are required',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        // Validate amount is a number
        const bidAmount = parseFloat(amount);
        if (isNaN(bidAmount) || bidAmount <= 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_BID_AMOUNT',
                    message: 'Bid amount must be a positive number',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        // Capture request metadata
        const metadata = {
            ipAddress: req.ip || req.connection.remoteAddress,
            userAgent: req.get('user-agent')
        };

        // Place bid
        const bidData = {
            auctionId,
            amount: bidAmount,
            bidMethod: bidMethod || 'manual'
        };

        const result = await bidService.placeBid(bidData, req.user.id, metadata);

        res.status(201).json({
            success: true,
            data: result,
            message: 'Bid placed successfully'
        });
    } catch (error) {
        logger.error('Place bid controller error:', error);

        const errorResponses = {
            'AUCTION_NOT_FOUND': { status: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found' },
            'AUCTION_NOT_ACTIVE': { status: 422, code: 'AUCTION_NOT_ACTIVE', message: 'Auction is not active' },
            'AUCTION_NOT_STARTED': { status: 422, code: 'AUCTION_NOT_STARTED', message: 'Auction has not started yet' },
            'AUCTION_ENDED': { status: 422, code: 'AUCTION_ENDED', message: 'Auction has already ended' },
            'SELLER_CANNOT_BID_ON_OWN_AUCTION': { status: 403, code: 'FORBIDDEN', message: 'Sellers cannot bid on their own auctions' },
            'BID_AMOUNT_TOO_LOW': { status: 422, code: 'BID_TOO_LOW', message: 'Bid amount must be higher than the current price' },
            'BID_AMOUNT_MUST_BE_POSITIVE': { status: 400, code: 'INVALID_BID_AMOUNT', message: 'Bid amount must be a positive number' },
            'BID_AMOUNT_MUST_BE_HIGHER_THAN_CURRENT_BID': { status: 422, code: 'BID_TOO_LOW', message: 'Bid amount must be higher than the current highest bid' }
        };

        const errorResponse = errorResponses[error.message];
        if (errorResponse) {
            return res.status(errorResponse.status).json({
                success: false,
                error: {
                    code: errorResponse.code,
                    message: errorResponse.message,
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while placing the bid',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get bid history for an auction
 * GET /api/v1/bids/auction/:auctionId
 */
export const getBidHistoryByAuction = async (req, res) => {
    try {
        const { auctionId } = req.params;
        const {
            page = 1,
            limit = 50,
            sortBy = 'amount'
        } = req.query;

        // Build sort object
        let sort = {};
        switch (sortBy) {
            case 'amount':
                sort = { amount: -1, timestamp: -1 };
                break;
            case 'time':
                sort = { timestamp: -1 };
                break;
            default:
                sort = { amount: -1, timestamp: -1 };
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort,
            populate: true
        };

        const result = await bidService.getBidHistoryByAuction(auctionId, options);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Get bid history by auction controller error:', error);

        if (error.message === 'AUCTION_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'AUCTION_NOT_FOUND',
                    message: 'Auction not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching bid history',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get bid history for a user
 * GET /api/v1/bids/user/:userId
 */
export const getBidHistoryByUser = async (req, res) => {
    try {
        const { userId } = req.params;
        const {
            page = 1,
            limit = 50
        } = req.query;

        // Check authorization - users can only view their own bid history unless admin
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                error: {
                    code: 'UNAUTHORIZED',
                    message: 'You are not authorized to view this bid history',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { timestamp: -1 },
            populate: true
        };

        const result = await bidService.getBidHistoryByUser(userId, options);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Get bid history by user controller error:', error);

        if (error.message === 'USER_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching bid history',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get bid by ID
 * GET /api/v1/bids/:id
 */
export const getBidById = async (req, res) => {
    try {
        const { id } = req.params;

        const bid = await bidService.getBidById(id, true);

        res.status(200).json({
            success: true,
            data: {
                bid
            }
        });
    } catch (error) {
        logger.error('Get bid controller error:', error);

        if (error.message === 'BID_NOT_FOUND') {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'BID_NOT_FOUND',
                    message: 'Bid not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching the bid',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get highest bid for an auction
 * GET /api/v1/bids/auction/:auctionId/highest
 */
export const getHighestBid = async (req, res) => {
    try {
        const { auctionId } = req.params;

        const bid = await bidService.getHighestBid(auctionId);

        if (!bid) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'NO_BIDS_FOUND',
                    message: 'No bids found for this auction',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(200).json({
            success: true,
            data: {
                bid
            }
        });
    } catch (error) {
        logger.error('Get highest bid controller error:', error);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching the highest bid',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get my bids (authenticated user's bids)
 * GET /api/v1/bids/me
 */
export const getMyBids = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 50
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            sort: { timestamp: -1 },
            populate: true
        };

        const result = await bidService.getBidHistoryByUser(req.user.id, options);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Get my bids controller error:', error);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while fetching your bids',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};
