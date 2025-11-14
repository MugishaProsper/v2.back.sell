import express from 'express';
import {
    getDashboard,
    getAuctionStats,
    getUserStats,
    getAIInsights,
    exportAnalytics,
    triggerAggregation,
    getAnalyticsByDate
} from '../controllers/analytics.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/analytics/dashboard
 * @desc    Get dashboard analytics overview
 * @access  Private (Admin only)
 */
router.get('/dashboard', authenticate, authorize('admin'), getDashboard);

/**
 * @route   GET /api/v1/analytics/auctions/stats
 * @desc    Get auction statistics for a date range
 * @access  Private (Admin only)
 */
router.get('/auctions/stats', authenticate, authorize('admin'), getAuctionStats);

/**
 * @route   GET /api/v1/analytics/users/stats
 * @desc    Get user statistics for a date range
 * @access  Private (Admin only)
 */
router.get('/users/stats', authenticate, authorize('admin'), getUserStats);

/**
 * @route   GET /api/v1/analytics/ai/insights
 * @desc    Get AI insights and metrics
 * @access  Private (Admin only)
 */
router.get('/ai/insights', authenticate, authorize('admin'), getAIInsights);

/**
 * @route   GET /api/v1/analytics/export
 * @desc    Export analytics data in JSON or CSV format
 * @access  Private (Admin only)
 */
router.get('/export', authenticate, authorize('admin'), exportAnalytics);

/**
 * @route   POST /api/v1/analytics/aggregate
 * @desc    Trigger manual analytics aggregation
 * @access  Private (Admin only)
 */
router.post('/aggregate', authenticate, authorize('admin'), triggerAggregation);

/**
 * @route   GET /api/v1/analytics/date/:date
 * @desc    Get analytics for a specific date
 * @access  Private (Admin only)
 */
router.get('/date/:date', authenticate, authorize('admin'), getAnalyticsByDate);

export default router;
