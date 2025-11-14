import auctionService from '../services/auction.service.js';
import logger from '../config/logger.js';
import { sanitizeInput } from '../utils/validation.js';

/**
 * Create a new auction
 * POST /api/v1/auctions
 */
export const createAuction = async (req, res) => {
    try {
        const {
            title,
            description,
            category,
            startingPrice,
            reservePrice,
            buyNowPrice,
            startTime,
            endTime,
            status,
            images
        } = req.body;

        // Validate required fields
        if (!title || !description || !category || startingPrice === undefined || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Missing required fields',
                    details: 'title, description, category, startingPrice, startTime, and endTime are required',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        // Sanitize inputs
        const auctionData = {
            title: sanitizeInput(title),
            description: sanitizeInput(description),
            category: sanitizeInput(category),
            startingPrice: parseFloat(startingPrice),
            reservePrice: reservePrice ? parseFloat(reservePrice) : undefined,
            buyNowPrice: buyNowPrice ? parseFloat(buyNowPrice) : undefined,
            startTime: new Date(startTime),
            endTime: new Date(endTime),
            status: status || 'draft',
            images: images || []
        };

        // Create auction
        const auction = await auctionService.createAuction(auctionData, req.user.id);

        res.status(201).json({
            success: true,
            data: {
                auction
            },
            message: 'Auction created successfully'
        });
    } catch (error) {
        logger.error('Create auction controller error:', error);

        const errorResponses = {
            'SELLER_NOT_FOUND': { status: 404, code: 'SELLER_NOT_FOUND', message: 'Seller not found' },
            'END_TIME_MUST_BE_AFTER_START_TIME': { status: 400, code: 'INVALID_TIMING', message: 'End time must be after start time' },
            'END_TIME_MUST_BE_IN_FUTURE': { status: 400, code: 'INVALID_TIMING', message: 'End time must be in the future' },
            'DURATION_MUST_BE_AT_LEAST_1_HOUR': { status: 400, code: 'INVALID_DURATION', message: 'Auction duration must be at least 1 hour' },
            'STARTING_PRICE_MUST_BE_POSITIVE': { status: 400, code: 'INVALID_PRICE', message: 'Starting price must be a positive number' },
            'RESERVE_PRICE_MUST_BE_GREATER_THAN_STARTING_PRICE': { status: 400, code: 'INVALID_PRICE', message: 'Reserve price must be greater than or equal to starting price' },
            'BUY_NOW_PRICE_MUST_BE_GREATER_THAN_STARTING_PRICE': { status: 400, code: 'INVALID_PRICE', message: 'Buy now price must be greater than starting price' }
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
                message: 'An error occurred while creating the auction',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get auction by ID
 * GET /api/v1/auctions/:id
 */
export const getAuctionById = async (req, res) => {
    try {
        const { id } = req.params;
        const incrementViews = req.query.incrementViews === 'true';

        const auction = await auctionService.getAuctionById(id, incrementViews);

        res.status(200).json({
            success: true,
            data: {
                auction
            }
        });
    } catch (error) {
        logger.error('Get auction controller error:', error);

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
                message: 'An error occurred while fetching the auction',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * List auctions with pagination
 * GET /api/v1/auctions
 */
export const listAuctions = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 10,
            status,
            category,
            sellerId
        } = req.query;

        const options = {
            page: parseInt(page),
            limit: parseInt(limit),
            status,
            category,
            sellerId
        };

        const result = await auctionService.listAuctions(options);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('List auctions controller error:', error);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while listing auctions',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Search auctions
 * GET /api/v1/auctions/search
 */
export const searchAuctions = async (req, res) => {
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
        } = req.query;

        const searchParams = {
            query: query ? sanitizeInput(query) : undefined,
            category: category ? sanitizeInput(category) : undefined,
            minPrice: minPrice ? parseFloat(minPrice) : undefined,
            maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
            status,
            page: parseInt(page),
            limit: parseInt(limit),
            sortBy
        };

        const result = await auctionService.searchAuctions(searchParams);

        res.status(200).json({
            success: true,
            data: result
        });
    } catch (error) {
        logger.error('Search auctions controller error:', error);

        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred while searching auctions',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Update auction
 * PUT /api/v1/auctions/:id
 */
export const updateAuction = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = {};

        // Only include fields that are provided
        if (req.body.title) updateData.title = sanitizeInput(req.body.title);
        if (req.body.description) updateData.description = sanitizeInput(req.body.description);
        if (req.body.category) updateData.category = sanitizeInput(req.body.category);
        if (req.body.startingPrice !== undefined) updateData.startingPrice = parseFloat(req.body.startingPrice);
        if (req.body.reservePrice !== undefined) updateData.reservePrice = parseFloat(req.body.reservePrice);
        if (req.body.buyNowPrice !== undefined) updateData.buyNowPrice = parseFloat(req.body.buyNowPrice);
        if (req.body.startTime) updateData.startTime = new Date(req.body.startTime);
        if (req.body.endTime) updateData.endTime = new Date(req.body.endTime);
        if (req.body.status) updateData.status = req.body.status;

        const auction = await auctionService.updateAuction(id, updateData, req.user.id);

        res.status(200).json({
            success: true,
            data: {
                auction
            },
            message: 'Auction updated successfully'
        });
    } catch (error) {
        logger.error('Update auction controller error:', error);

        const errorResponses = {
            'AUCTION_NOT_FOUND': { status: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found' },
            'UNAUTHORIZED_NOT_OWNER': { status: 403, code: 'UNAUTHORIZED', message: 'You are not authorized to update this auction' },
            'CANNOT_UPDATE_AUCTION_WITH_BIDS': { status: 422, code: 'AUCTION_HAS_BIDS', message: 'Cannot update auction that has bids' },
            'END_TIME_MUST_BE_AFTER_START_TIME': { status: 400, code: 'INVALID_TIMING', message: 'End time must be after start time' },
            'END_TIME_MUST_BE_IN_FUTURE': { status: 400, code: 'INVALID_TIMING', message: 'End time must be in the future' },
            'STARTING_PRICE_MUST_BE_POSITIVE': { status: 400, code: 'INVALID_PRICE', message: 'Starting price must be a positive number' }
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
                message: 'An error occurred while updating the auction',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Delete auction
 * DELETE /api/v1/auctions/:id
 */
export const deleteAuction = async (req, res) => {
    try {
        const { id } = req.params;

        await auctionService.deleteAuction(id, req.user.id);

        res.status(200).json({
            success: true,
            message: 'Auction deleted successfully'
        });
    } catch (error) {
        logger.error('Delete auction controller error:', error);

        const errorResponses = {
            'AUCTION_NOT_FOUND': { status: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found' },
            'UNAUTHORIZED_NOT_OWNER': { status: 403, code: 'UNAUTHORIZED', message: 'You are not authorized to delete this auction' },
            'CANNOT_DELETE_AUCTION_WITH_BIDS': { status: 422, code: 'AUCTION_HAS_BIDS', message: 'Cannot delete auction that has bids' }
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
                message: 'An error occurred while deleting the auction',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Upload images to auction
 * POST /api/v1/auctions/:id/images
 */
export const uploadImages = async (req, res) => {
    try {
        const { id } = req.params;

        // Check if files were uploaded
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'NO_FILES_UPLOADED',
                    message: 'No image files were uploaded',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        // Prepare image objects from uploaded files
        const images = req.files.map(file => ({
            url: file.path || file.location, // path for local, location for cloud storage
            publicId: file.filename || file.key,
            size: file.size
        }));

        const auction = await auctionService.addImages(id, images, req.user.id);

        res.status(200).json({
            success: true,
            data: {
                auction
            },
            message: 'Images uploaded successfully'
        });
    } catch (error) {
        logger.error('Upload images controller error:', error);

        const errorResponses = {
            'AUCTION_NOT_FOUND': { status: 404, code: 'AUCTION_NOT_FOUND', message: 'Auction not found' },
            'UNAUTHORIZED_NOT_OWNER': { status: 403, code: 'UNAUTHORIZED', message: 'You are not authorized to upload images to this auction' },
            'MAX_10_IMAGES_ALLOWED': { status: 400, code: 'MAX_IMAGES_EXCEEDED', message: 'Maximum 10 images allowed per auction' },
            'IMAGE_SIZE_EXCEEDS_5MB': { status: 400, code: 'IMAGE_TOO_LARGE', message: 'Image size must not exceed 5MB' }
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
                message: 'An error occurred while uploading images',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};
