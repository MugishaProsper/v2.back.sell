import express from 'express';
import {
    placeBid,
    getBidHistoryByAuction,
    getBidHistoryByUser,
    getBidById,
    getHighestBid,
    getMyBids
} from '../controllers/bid.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';
import { auditBidPattern, auditResourceAccess } from '../middlewares/audit.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/bids/me
 * @desc    Get authenticated user's bid history
 * @access  Private (Authenticated users)
 */
router.get('/me', authenticate, getMyBids);

/**
 * @route   GET /api/v1/bids/auction/:auctionId/highest
 * @desc    Get highest bid for an auction
 * @access  Public
 */
router.get('/auction/:auctionId/highest', getHighestBid);

/**
 * @route   GET /api/v1/bids/auction/:auctionId
 * @desc    Get bid history for an auction
 * @access  Public
 */
router.get('/auction/:auctionId', getBidHistoryByAuction);

/**
 * @route   GET /api/v1/bids/user/:userId
 * @desc    Get bid history for a user
 * @access  Private (User or Admin only)
 */
router.get('/user/:userId', authenticate, getBidHistoryByUser);

/**
 * @route   GET /api/v1/bids/:id
 * @desc    Get bid by ID
 * @access  Public
 */
router.get('/:id', getBidById);

/**
 * @route   POST /api/v1/bids
 * @desc    Place a new bid on an auction
 * @access  Private (Authenticated users only)
 */
router.post('/', authenticate, auditBidPattern, auditResourceAccess('BID_PLACE', 'bid'), placeBid);

export default router;
