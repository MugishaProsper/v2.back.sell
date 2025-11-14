import express from 'express';
import {
    getUserById,
    updateUser,
    deleteUser,
    getUserAuctions,
    updateNotificationPreferences,
    getUserStats
} from '../controllers/user.controller.js';
import { authenticate } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/users/:id
 * @desc    Get user by ID
 * @access  Public
 */
router.get('/:id', getUserById);

/**
 * @route   PUT /api/v1/users/:id
 * @desc    Update user profile
 * @access  Private (user can only update their own profile)
 */
router.put('/:id', authenticate, updateUser);

/**
 * @route   DELETE /api/v1/users/:id
 * @desc    Delete user account
 * @access  Private (user can only delete their own account)
 */
router.delete('/:id', authenticate, deleteUser);

/**
 * @route   GET /api/v1/users/:id/auctions
 * @desc    Get user's auctions
 * @access  Public
 */
router.get('/:id/auctions', getUserAuctions);

/**
 * @route   PUT /api/v1/users/:id/notifications/preferences
 * @desc    Update notification preferences
 * @access  Private (user can only update their own preferences)
 */
router.put('/:id/notifications/preferences', authenticate, updateNotificationPreferences);

/**
 * @route   GET /api/v1/users/:id/stats
 * @desc    Get user statistics
 * @access  Public
 */
router.get('/:id/stats', getUserStats);

export default router;
