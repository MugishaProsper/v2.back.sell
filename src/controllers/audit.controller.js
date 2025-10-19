import auditService from '../services/audit.service.js';
import { ApiError } from '../middlewares/error.middleware.js';

/**
 * Get audit logs with filters
 * @route   GET /api/v1/audit/logs
 * @access  Private (Admin only)
 */
export const getAuditLogs = async (req, res, next) => {
    try {
        const filters = {
            userId: req.query.userId,
            email: req.query.email,
            action: req.query.action,
            status: req.query.status,
            ipAddress: req.query.ipAddress,
            startDate: req.query.startDate,
            endDate: req.query.endDate,
        };

        const options = {
            page: parseInt(req.query.page) || 1,
            limit: parseInt(req.query.limit) || 50,
            sortBy: req.query.sortBy || 'timestamp',
            sortOrder: req.query.sortOrder || 'desc',
        };

        const result = await auditService.getAuditLogs(filters, options);

        res.status(200).json({
            success: true,
            data: result.logs,
            pagination: result.pagination,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get user security summary
 * @route   GET /api/v1/audit/users/:userId/security
 * @access  Private (Admin or own user)
 */
export const getUserSecuritySummary = async (req, res, next) => {
    try {
        const { userId } = req.params;
        const days = parseInt(req.query.days) || 30;

        // Check if user is accessing their own data or is admin
        if (req.user.id !== userId && req.user.role !== 'admin') {
            throw new ApiError(403, 'AUTH_INSUFFICIENT_PERMISSIONS', 'You can only view your own security summary');
        }

        const summary = await auditService.getUserSecuritySummary(userId, days);

        res.status(200).json({
            success: true,
            data: summary,
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get failed login attempts
 * @route   GET /api/v1/audit/failed-logins
 * @access  Private (Admin only)
 */
export const getFailedLoginAttempts = async (req, res, next) => {
    try {
        const { email, ipAddress } = req.query;
        const timeWindow = parseInt(req.query.timeWindow) || 15 * 60 * 1000; // 15 minutes default

        const count = await auditService.getFailedLoginAttempts(email, ipAddress, timeWindow);

        res.status(200).json({
            success: true,
            data: {
                count,
                email,
                ipAddress,
                timeWindow,
            },
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Get suspicious activity count
 * @route   GET /api/v1/audit/suspicious-activity
 * @access  Private (Admin only)
 */
export const getSuspiciousActivityCount = async (req, res, next) => {
    try {
        const { ipAddress } = req.query;
        const timeWindow = parseInt(req.query.timeWindow) || 60 * 60 * 1000; // 1 hour default

        if (!ipAddress) {
            throw new ApiError(400, 'VALIDATION_FAILED', 'IP address is required');
        }

        const count = await auditService.getSuspiciousActivityCount(ipAddress, timeWindow);

        res.status(200).json({
            success: true,
            data: {
                count,
                ipAddress,
                timeWindow,
            },
        });
    } catch (error) {
        next(error);
    }
};
