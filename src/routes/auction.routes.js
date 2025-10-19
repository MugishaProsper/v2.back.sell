import express from 'express';
import {
    createAuction,
    getAuctionById,
    listAuctions,
    searchAuctions,
    updateAuction,
    deleteAuction,
    uploadImages,
    getRecommendations
} from '../controllers/auction.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { uploadMultiple, handleUploadError } from '../middlewares/upload.middleware.js';
import { validate, auctionValidation } from '../middlewares/validation.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/auctions/recommendations
 * @desc    Get AI-powered personalized recommendations
 * @access  Private (Authenticated users)
 */
router.get('/recommendations', authenticate, getRecommendations);

/**
 * @route   GET /api/v1/auctions/search
 * @desc    Search auctions with filters
 * @access  Public
 */
router.get('/search', validate(auctionValidation.searchAuctions), searchAuctions);

/**
 * @route   GET /api/v1/auctions
 * @desc    List auctions with pagination
 * @access  Public
 */
router.get('/', validate(auctionValidation.listAuctions), listAuctions);

/**
 * @route   GET /api/v1/auctions/:id
 * @desc    Get auction by ID
 * @access  Public
 */
router.get('/:id', validate(auctionValidation.getAuctionById), getAuctionById);

/**
 * @route   POST /api/v1/auctions
 * @desc    Create a new auction
 * @access  Private (Authenticated sellers only)
 */
router.post('/', authenticate, authorize('seller', 'admin'), validate(auctionValidation.createAuction), createAuction);

/**
 * @route   PUT /api/v1/auctions/:id
 * @desc    Update auction (owner only, no bids)
 * @access  Private (Owner only)
 */
router.put('/:id', authenticate, validate(auctionValidation.updateAuction), updateAuction);

/**
 * @route   DELETE /api/v1/auctions/:id
 * @desc    Delete auction (owner only, no bids)
 * @access  Private (Owner only)
 */
router.delete('/:id', authenticate, validate(auctionValidation.deleteAuction), deleteAuction);

/**
 * @route   POST /api/v1/auctions/:id/images
 * @desc    Upload images to auction
 * @access  Private (Owner only)
 */
router.post('/:id/images', authenticate, uploadMultiple, handleUploadError, uploadImages);

export default router;
