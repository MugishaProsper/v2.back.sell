import analyticsService from '../services/analytics.service.js';
import logger from '../config/logger.js';

/**
 * Get dashboard analytics
 * GET /api/v1/analytics/dashboard
 * Admin only
 */
export const getDashboard = async (req, res) => {
    try {
        const statistics = await analyticsService.getPlatformStatistics();

        res.status(200).json({
            success: true,
            data: statistics,
            message: 'Dashboard analytics retrieved successfully'
        });
    } catch (error) {
        logger.error('Get dashboard controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve dashboard analytics',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get auction statistics
 * GET /api/v1/analytics/auctions/stats
 * Admin only
 */
export const getAuctionStats = async (req, res) => {
    try {
        const { startDate, endDate, days = 30 } = req.query;

        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_DATE',
                        message: 'Invalid date format',
                        timestamp: new Date().toISOString(),
                        path: req.path
                    }
                });
            }
        } else {
            // Default to last N days
            end = new Date();
            start = new Date();
            start.setDate(start.getDate() - parseInt(days));
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Get analytics for the date range
        const analytics = await analyticsService.getAnalyticsByDateRange(start, end);

        // Get aggregated metrics
        const aggregated = await analyticsService.getAggregatedMetrics(start, end);

        res.status(200).json({
            success: true,
            data: {
                period: { start, end },
                analytics,
                aggregated,
                recordCount: analytics.length
            },
            message: 'Auction statistics retrieved successfully'
        });
    } catch (error) {
        logger.error('Get auction stats controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve auction statistics',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get user statistics
 * GET /api/v1/analytics/users/stats
 * Admin only
 */
export const getUserStats = async (req, res) => {
    try {
        const { startDate, endDate, days = 30 } = req.query;

        let start, end;

        if (startDate && endDate) {
            start = new Date(startDate);
            end = new Date(endDate);

            if (isNaN(start.getTime()) || isNaN(end.getTime())) {
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_DATE',
                        message: 'Invalid date format',
                        timestamp: new Date().toISOString(),
                        path: req.path
                    }
                });
            }
        } else {
            // Default to last N days
            end = new Date();
            start = new Date();
            start.setDate(start.getDate() - parseInt(days));
        }

        start.setHours(0, 0, 0, 0);
        end.setHours(23, 59, 59, 999);

        // Get analytics for the date range
        const analytics = await analyticsService.getAnalyticsByDateRange(start, end);

        // Extract user metrics
        const userMetrics = analytics.map(record => ({
            date: record.date,
            newRegistrations: record.metrics.users.newRegistrations,
            activeUsers: record.metrics.users.activeUsers,
            totalUsers: record.metrics.users.totalUsers
        }));

        // Calculate totals
        const totals = {
            newRegistrations: userMetrics.reduce((sum, m) => sum + m.newRegistrations, 0),
            averageActiveUsers: userMetrics.length > 0 
                ? Math.round(userMetrics.reduce((sum, m) => sum + m.activeUsers, 0) / userMetrics.length)
                : 0
        };

        res.status(200).json({
            success: true,
            data: {
                period: { start, end },
                metrics: userMetrics,
                totals,
                recordCount: userMetrics.length
            },
            message: 'User statistics retrieved successfully'
        });
    } catch (error) {
        logger.error('Get user stats controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve user statistics',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get AI insights
 * GET /api/v1/analytics/ai/insights
 * Admin only
 */
export const getAIInsights = async (req, res) => {
    try {
        const { startDate, endDate, type } = req.query;

        const insights = await analyticsService.fetchAIInsights({
            startDate,
            endDate,
            type
        });

        res.status(200).json({
            success: true,
            data: insights,
            message: 'AI insights retrieved successfully'
        });
    } catch (error) {
        logger.error('Get AI insights controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve AI insights',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Export analytics data
 * GET /api/v1/analytics/export
 * Admin only
 */
export const exportAnalytics = async (req, res) => {
    try {
        const { format = 'json', startDate, endDate } = req.query;

        // Validate format
        if (!['json', 'csv'].includes(format.toLowerCase())) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_FORMAT',
                    message: 'Invalid export format. Supported formats: json, csv',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        const exportData = await analyticsService.exportData({
            format: format.toLowerCase(),
            startDate,
            endDate
        });

        if (format.toLowerCase() === 'csv') {
            res.setHeader('Content-Type', 'text/csv');
            res.setHeader('Content-Disposition', `attachment; filename="analytics-export-${Date.now()}.csv"`);
            return res.status(200).send(exportData.data);
        }

        // JSON format
        res.status(200).json({
            success: true,
            data: exportData,
            message: 'Analytics data exported successfully'
        });
    } catch (error) {
        logger.error('Export analytics controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to export analytics data',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Trigger manual analytics aggregation
 * POST /api/v1/analytics/aggregate
 * Admin only
 */
export const triggerAggregation = async (req, res) => {
    try {
        const { date } = req.body;

        const result = await analyticsService.triggerManualAggregation(date);

        res.status(200).json({
            success: true,
            data: result,
            message: 'Analytics aggregation triggered successfully'
        });
    } catch (error) {
        logger.error('Trigger aggregation controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to trigger analytics aggregation',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Get analytics by date
 * GET /api/v1/analytics/date/:date
 * Admin only
 */
export const getAnalyticsByDate = async (req, res) => {
    try {
        const { date } = req.params;

        const targetDate = new Date(date);
        if (isNaN(targetDate.getTime())) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'INVALID_DATE',
                    message: 'Invalid date format',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        const analytics = await analyticsService.getAnalyticsByDate(targetDate);

        if (!analytics) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ANALYTICS_NOT_FOUND',
                    message: 'No analytics found for the specified date',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }

        res.status(200).json({
            success: true,
            data: analytics,
            message: 'Analytics retrieved successfully'
        });
    } catch (error) {
        logger.error('Get analytics by date controller error:', error);

        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to retrieve analytics',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};
