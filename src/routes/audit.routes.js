import express from 'express';
import {
    getAuditLogs,
    getUserSecuritySummary,
    getFailedLoginAttempts,
    getSuspiciousActivityCount,
} from '../controllers/audit.controller.js';
import { authenticate, authorize } from '../middlewares/auth.middleware.js';

const router = express.Router();

/**
 * @route   GET /api/v1/audit/logs
 * @desc    Get audit logs with filters
 * @access  Private (Admin only)
 */
router.get('/logs', authenticate, authorize('admin'), getAuditLogs);

/**
 * @route   GET /api/v1/audit/users/:userId/security
 * @desc    Get user security summary
 * @access  Private (Admin or own user)
 */
router.get('/users/:userId/security', authenticate, getUserSecuritySummary);

/**
 * @route   GET /api/v1/audit/failed-logins
 * @desc    Get failed login attempts
 * @access  Private (Admin only)
 */
router.get('/failed-logins', authenticate, authorize('admin'), getFailedLoginAttempts);

/**
 * @route   GET /api/v1/audit/suspicious-activity
 * @desc    Get suspicious activity count
 * @access  Private (Admin only)
 */
router.get('/suspicious-activity', authenticate, authorize('admin'), getSuspiciousActivityCount);

export default router;
