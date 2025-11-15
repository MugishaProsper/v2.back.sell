import analyticsRepository from '../repositories/analytics.repository.js';
import User from '../models/user.model.js';
import Auction from '../models/auction.model.js';
import Bid from '../models/bid.model.js';
import logger from '../config/logger.js';
import cacheService from './cache.service.js';
import Bull from 'bull';
import { configDotenv } from 'dotenv';

configDotenv();

/**
 * AnalyticsService - Business logic layer for Analytics operations
 * Handles data aggregation, reporting, and scheduled analytics jobs
 */
class AnalyticsService {
    constructor() {
        // Initialize Bull queue for analytics aggregation
        this.analyticsQueue = new Bull('analytics-aggregation', {
            redis: {
                host: process.env.REDIS_HOST || 'localhost',
                port: process.env.REDIS_PORT || 6379,
                password: process.env.REDIS_PASSWORD || undefined
            }
        });

        // Process analytics aggregation jobs
        this.analyticsQueue.process(async (job) => {
            const { date } = job.data;
            await this.aggregateDailyStatistics(date);
        });

        // Schedule daily analytics aggregation at midnight
        this.scheduleDailyAggregation();

        logger.info('AnalyticsService initialized with Bull queue');
    }

    /**
     * Schedule daily analytics aggregation
     */
    async scheduleDailyAggregation() {
        try {
            // Remove existing repeatable jobs
            const repeatableJobs = await this.analyticsQueue.getRepeatableJobs();
            for (const job of repeatableJobs) {
                await this.analyticsQueue.removeRepeatableByKey(job.key);
            }

            // Schedule job to run daily at midnight
            await this.analyticsQueue.add(
                { date: new Date() },
                {
                    repeat: {
                        cron: '0 0 * * *' // Every day at midnight
                    },
                    jobId: 'daily-analytics-aggregation'
                }
            );

            logger.info('Daily analytics aggregation scheduled');
        } catch (error) {
            logger.error('Error scheduling daily aggregation:', error.message);
        }
    }

    /**
     * Aggregate daily statistics for a specific date
     * @param {Date} date - Date to aggregate (defaults to yesterday)
     * @returns {Promise<Object>} - Aggregated analytics
     */
    async aggregateDailyStatistics(date = null) {
        try {
            // Default to yesterday if no date provided
            if (!date) {
                date = new Date();
                date.setDate(date.getDate() - 1);
            }

            // Normalize date to start of day
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);

            const nextDate = new Date(targetDate);
            nextDate.setDate(nextDate.getDate() + 1);

            logger.info(`Aggregating statistics for ${targetDate.toISOString().split('T')[0]}`);

            // Aggregate auction metrics
            const auctionMetrics = await this.aggregateAuctionMetrics(targetDate, nextDate);

            // Aggregate user metrics
            const userMetrics = await this.aggregateUserMetrics(targetDate, nextDate);

            // Aggregate bid metrics
            const bidMetrics = await this.aggregateBidMetrics(targetDate, nextDate);

            // Aggregate payment metrics (placeholder - will be implemented when payment model exists)
            const paymentMetrics = await this.aggregatePaymentMetrics(targetDate, nextDate);

            // Aggregate AI metrics (placeholder - tracking AI service calls)
            const aiMetrics = await this.aggregateAIMetrics(targetDate, nextDate);

            // Combine all metrics
            const metrics = {
                auctions: auctionMetrics,
                users: userMetrics,
                bids: bidMetrics,
                payments: paymentMetrics,
                ai: aiMetrics
            };

            // Upsert analytics record
            const analytics = await analyticsRepository.upsert(targetDate, metrics);

            logger.info(`Statistics aggregated successfully for ${targetDate.toISOString().split('T')[0]}`);

            return analytics;
        } catch (error) {
            logger.error('Error aggregating daily statistics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate auction metrics for a date range (optimized with single aggregation)
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - Auction metrics
     */
    async aggregateAuctionMetrics(startDate, endDate) {
        try {
            // Use single aggregation pipeline for better performance
            const result = await Auction.aggregate([
                {
                    $facet: {
                        created: [
                            {
                                $match: {
                                    createdAt: { $gte: startDate, $lt: endDate }
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ],
                        active: [
                            {
                                $match: {
                                    status: 'active',
                                    'timing.startTime': { $lte: endDate },
                                    'timing.endTime': { $gte: startDate }
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ],
                        closed: [
                            {
                                $match: {
                                    status: 'closed',
                                    updatedAt: { $gte: startDate, $lt: endDate }
                                }
                            },
                            {
                                $group: {
                                    _id: null,
                                    count: { $sum: 1 },
                                    totalValue: { $sum: '$pricing.currentPrice' }
                                }
                            }
                        ]
                    }
                }
            ]);

            const metrics = result[0];
            
            return {
                created: metrics.created[0]?.count || 0,
                active: metrics.active[0]?.count || 0,
                closed: metrics.closed[0]?.count || 0,
                totalValue: metrics.closed[0]?.totalValue || 0
            };
        } catch (error) {
            logger.error('Error aggregating auction metrics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate user metrics for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - User metrics
     */
    async aggregateUserMetrics(startDate, endDate) {
        try {
            const [newRegistrations, activeUsers, totalUsers] = await Promise.all([
                // New user registrations in this period
                User.countDocuments({
                    createdAt: { $gte: startDate, $lt: endDate }
                }),
                // Active users (users who created auctions or placed bids in this period)
                User.aggregate([
                    {
                        $match: {
                            $or: [
                                { 'stats.auctionsCreated': { $gt: 0 } },
                                { 'stats.totalBids': { $gt: 0 } }
                            ],
                            lastLogin: { $gte: startDate, $lt: endDate }
                        }
                    },
                    {
                        $count: 'activeUsers'
                    }
                ]).then(result => result.length > 0 ? result[0].activeUsers : 0),
                // Total users up to this date
                User.countDocuments({
                    createdAt: { $lt: endDate }
                })
            ]);

            return {
                newRegistrations,
                activeUsers,
                totalUsers
            };
        } catch (error) {
            logger.error('Error aggregating user metrics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate bid metrics for a date range (optimized with single aggregation)
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - Bid metrics
     */
    async aggregateBidMetrics(startDate, endDate) {
        try {
            // Use single aggregation pipeline for better performance
            const result = await Bid.aggregate([
                {
                    $match: {
                        createdAt: { $gte: startDate, $lt: endDate }
                    }
                },
                {
                    $facet: {
                        totalAndAverage: [
                            {
                                $group: {
                                    _id: null,
                                    totalBids: { $sum: 1 },
                                    averageAmount: { $avg: '$amount' }
                                }
                            }
                        ],
                        uniqueBidders: [
                            {
                                $group: {
                                    _id: '$bidder'
                                }
                            },
                            {
                                $count: 'count'
                            }
                        ]
                    }
                }
            ]);

            const metrics = result[0];
            
            return {
                totalBids: metrics.totalAndAverage[0]?.totalBids || 0,
                uniqueBidders: metrics.uniqueBidders[0]?.count || 0,
                averageBidAmount: metrics.totalAndAverage[0]?.averageAmount || 0
            };
        } catch (error) {
            logger.error('Error aggregating bid metrics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate payment metrics for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - Payment metrics
     */
    async aggregatePaymentMetrics(startDate, endDate) {
        try {
            // Placeholder implementation - will be completed when Payment model exists
            // For now, return default values
            return {
                totalTransactions: 0,
                totalRevenue: 0,
                successRate: 0
            };

            // Future implementation when Payment model exists:
            /*
            const Payment = (await import('../models/payment.model.js')).default;
            
            const [totalTransactions, completedTransactions, revenueResult] = await Promise.all([
                Payment.countDocuments({
                    createdAt: { $gte: startDate, $lt: endDate }
                }),
                Payment.countDocuments({
                    status: 'completed',
                    'timeline.completedAt': { $gte: startDate, $lt: endDate }
                }),
                Payment.aggregate([
                    {
                        $match: {
                            status: 'completed',
                            'timeline.completedAt': { $gte: startDate, $lt: endDate }
                        }
                    },
                    {
                        $group: {
                            _id: null,
                            totalRevenue: { $sum: '$amount' }
                        }
                    }
                ])
            ]);

            const successRate = totalTransactions > 0 
                ? (completedTransactions / totalTransactions) * 100 
                : 0;

            return {
                totalTransactions,
                totalRevenue: revenueResult.length > 0 ? revenueResult[0].totalRevenue : 0,
                successRate: Math.round(successRate * 100) / 100
            };
            */
        } catch (error) {
            logger.error('Error aggregating payment metrics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate AI metrics for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - AI metrics
     */
    async aggregateAIMetrics(startDate, endDate) {
        try {
            // Track AI predictions from auction aiInsights
            const predictionsGenerated = await Auction.countDocuments({
                'aiInsights.lastUpdated': { $gte: startDate, $lt: endDate }
            });

            // Track fraud detections from bids
            const fraudDetections = await Bid.countDocuments({
                'fraudAnalysis.isFlagged': true,
                'fraudAnalysis.analyzedAt': { $gte: startDate, $lt: endDate }
            });

            // Placeholder for recommendations served
            // This would be tracked when recommendation service is called
            const recommendationsServed = 0;

            return {
                predictionsGenerated,
                fraudDetections,
                recommendationsServed
            };
        } catch (error) {
            logger.error('Error aggregating AI metrics:', error.message);
            throw error;
        }
    }

    /**
     * Get analytics for a specific date
     * @param {Date} date - Date to retrieve
     * @returns {Promise<Object|null>} - Analytics or null
     */
    async getAnalyticsByDate(date) {
        try {
            const targetDate = new Date(date);
            targetDate.setHours(0, 0, 0, 0);

            const analytics = await analyticsRepository.findByDate(targetDate);
            return analytics;
        } catch (error) {
            logger.error('Error getting analytics by date:', error.message);
            throw error;
        }
    }

    /**
     * Get analytics for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Array>} - Array of analytics
     */
    async getAnalyticsByDateRange(startDate, endDate) {
        try {
            const analytics = await analyticsRepository.findByDateRange(startDate, endDate);
            return analytics;
        } catch (error) {
            logger.error('Error getting analytics by date range:', error.message);
            throw error;
        }
    }

    /**
     * Get latest analytics
     * @param {number} days - Number of days to retrieve
     * @returns {Promise<Array>} - Array of analytics
     */
    async getLatestAnalytics(days = 7) {
        try {
            const analytics = await analyticsRepository.getLatest(days);
            return analytics;
        } catch (error) {
            logger.error('Error getting latest analytics:', error.message);
            throw error;
        }
    }

    /**
     * Get aggregated metrics over a period
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object|null>} - Aggregated metrics or null
     */
    async getAggregatedMetrics(startDate, endDate) {
        try {
            const metrics = await analyticsRepository.aggregateMetrics(startDate, endDate);
            return metrics;
        } catch (error) {
            logger.error('Error getting aggregated metrics:', error.message);
            throw error;
        }
    }

    /**
     * Trigger manual analytics aggregation for a specific date
     * @param {Date} date - Date to aggregate
     * @returns {Promise<Object>} - Job info
     */
    async triggerManualAggregation(date) {
        try {
            const targetDate = date ? new Date(date) : new Date();
            targetDate.setHours(0, 0, 0, 0);

            const job = await this.analyticsQueue.add(
                { date: targetDate },
                {
                    jobId: `manual-analytics-${targetDate.getTime()}`,
                    removeOnComplete: true
                }
            );

            logger.info(`Manual analytics aggregation triggered for ${targetDate.toISOString().split('T')[0]}`);

            return {
                jobId: job.id,
                date: targetDate,
                status: 'queued'
            };
        } catch (error) {
            logger.error('Error triggering manual aggregation:', error.message);
            throw error;
        }
    }

    /**
     * Get platform statistics (dashboard overview) with caching
     * Returns within 3 seconds as per requirements
     * @returns {Promise<Object>} - Platform statistics
     */
    async getPlatformStatistics() {
        const startTime = Date.now();
        
        try {
            // Try to get from cache first (TTL: 1 hour)
            const cacheKey = 'dashboard';
            const cached = await cacheService.getAnalytics(cacheKey);
            if (cached) {
                logger.debug('Platform statistics retrieved from cache');
                return {
                    ...cached,
                    cached: true,
                    performance: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    }
                };
            }
            
            // Get latest analytics (last 7 days)
            const latestAnalytics = await analyticsRepository.getLatest(7);

            // Get current real-time statistics
            const [
                totalUsers,
                totalAuctions,
                activeAuctions,
                totalBids,
                todayStats
            ] = await Promise.all([
                User.countDocuments(),
                Auction.countDocuments(),
                Auction.countDocuments({ status: 'active' }),
                Bid.countDocuments(),
                this.getTodayStatistics()
            ]);

            // Calculate trends from last 7 days
            const trends = this.calculateTrends(latestAnalytics);

            const executionTime = Date.now() - startTime;
            logger.info(`Platform statistics retrieved in ${executionTime}ms`);

            const result = {
                overview: {
                    totalUsers,
                    totalAuctions,
                    activeAuctions,
                    totalBids
                },
                today: todayStats,
                trends,
                recentAnalytics: latestAnalytics.slice(0, 7),
                cached: false,
                performance: {
                    executionTime,
                    timestamp: new Date().toISOString()
                }
            };
            
            // Cache the result (TTL: 1 hour)
            await cacheService.cacheAnalytics(cacheKey, result);
            
            return result;
        } catch (error) {
            logger.error('Error getting platform statistics:', error.message);
            throw error;
        }
    }

    /**
     * Get today's statistics (real-time)
     * @returns {Promise<Object>} - Today's statistics
     */
    async getTodayStatistics() {
        try {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const tomorrow = new Date(today);
            tomorrow.setDate(tomorrow.getDate() + 1);

            const [
                auctionsCreated,
                bidsPlaced,
                newUsers,
                activeAuctions
            ] = await Promise.all([
                Auction.countDocuments({
                    createdAt: { $gte: today, $lt: tomorrow }
                }),
                Bid.countDocuments({
                    createdAt: { $gte: today, $lt: tomorrow }
                }),
                User.countDocuments({
                    createdAt: { $gte: today, $lt: tomorrow }
                }),
                Auction.countDocuments({
                    status: 'active',
                    'timing.startTime': { $lte: tomorrow },
                    'timing.endTime': { $gte: today }
                })
            ]);

            return {
                auctionsCreated,
                bidsPlaced,
                newUsers,
                activeAuctions,
                date: today
            };
        } catch (error) {
            logger.error('Error getting today statistics:', error.message);
            throw error;
        }
    }

    /**
     * Calculate trends from analytics data
     * @param {Array} analytics - Array of analytics records
     * @returns {Object} - Trend calculations
     */
    calculateTrends(analytics) {
        if (!analytics || analytics.length < 2) {
            return {
                auctions: { change: 0, direction: 'stable' },
                users: { change: 0, direction: 'stable' },
                bids: { change: 0, direction: 'stable' }
            };
        }

        const latest = analytics[0];
        const previous = analytics[1];

        const calculateChange = (current, prev) => {
            if (!prev || prev === 0) return 0;
            return ((current - prev) / prev) * 100;
        };

        const getDirection = (change) => {
            if (change > 5) return 'up';
            if (change < -5) return 'down';
            return 'stable';
        };

        const auctionChange = calculateChange(
            latest.metrics.auctions.created,
            previous.metrics.auctions.created
        );

        const userChange = calculateChange(
            latest.metrics.users.newRegistrations,
            previous.metrics.users.newRegistrations
        );

        const bidChange = calculateChange(
            latest.metrics.bids.totalBids,
            previous.metrics.bids.totalBids
        );

        return {
            auctions: {
                change: Math.round(auctionChange * 100) / 100,
                direction: getDirection(auctionChange)
            },
            users: {
                change: Math.round(userChange * 100) / 100,
                direction: getDirection(userChange)
            },
            bids: {
                change: Math.round(bidChange * 100) / 100,
                direction: getDirection(bidChange)
            }
        };
    }

    /**
     * Fetch AI insights from AI module with caching
     * Returns within 5 seconds as per requirements
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - AI insights
     */
    async fetchAIInsights(params = {}) {
        const startTime = Date.now();
        
        try {
            const { startDate, endDate, type } = params;
            
            // Generate cache key based on parameters
            const cacheKey = `ai-insights-${startDate || 'default'}-${endDate || 'default'}-${type || 'all'}`;
            
            // Try to get from cache first (TTL: 1 hour)
            const cached = await cacheService.getAnalytics(cacheKey);
            if (cached) {
                logger.debug('AI insights retrieved from cache');
                return {
                    ...cached,
                    cached: true,
                    performance: {
                        executionTime: Date.now() - startTime,
                        timestamp: new Date().toISOString()
                    }
                };
            }

            // Get AI-related metrics from analytics
            const aiMetrics = await this.getAIMetricsReport(startDate, endDate);

            // Get recent AI predictions from auctions
            const recentPredictions = await Auction.find({
                'aiInsights.lastUpdated': { $exists: true }
            })
                .select('title aiInsights')
                .sort({ 'aiInsights.lastUpdated': -1 })
                .limit(10)
                .lean();

            // Get recent fraud detections from bids
            const recentFraudDetections = await Bid.find({
                'fraudAnalysis.isFlagged': true
            })
                .populate('auction', 'title')
                .populate('bidder', 'email profile.firstName profile.lastName')
                .select('amount fraudAnalysis auction bidder')
                .sort({ 'fraudAnalysis.analyzedAt': -1 })
                .limit(10)
                .lean();

            const executionTime = Date.now() - startTime;
            logger.info(`AI insights fetched in ${executionTime}ms`);

            const result = {
                metrics: aiMetrics,
                recentPredictions,
                recentFraudDetections,
                cached: false,
                performance: {
                    executionTime,
                    timestamp: new Date().toISOString()
                }
            };
            
            // Cache the result (TTL: 1 hour)
            await cacheService.cacheAnalytics(cacheKey, result);
            
            return result;
        } catch (error) {
            logger.error('Error fetching AI insights:', error.message);
            throw error;
        }
    }

    /**
     * Get AI metrics report for a date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object>} - AI metrics
     */
    async getAIMetricsReport(startDate, endDate) {
        try {
            let start, end;

            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
            } else {
                // Default to last 30 days
                end = new Date();
                start = new Date();
                start.setDate(start.getDate() - 30);
            }

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            const analytics = await analyticsRepository.findByDateRange(start, end);

            // Aggregate AI metrics
            let totalPredictions = 0;
            let totalFraudDetections = 0;
            let totalRecommendations = 0;

            analytics.forEach(record => {
                totalPredictions += record.metrics.ai.predictionsGenerated || 0;
                totalFraudDetections += record.metrics.ai.fraudDetections || 0;
                totalRecommendations += record.metrics.ai.recommendationsServed || 0;
            });

            return {
                totalPredictions,
                totalFraudDetections,
                totalRecommendations,
                period: {
                    start,
                    end,
                    days: analytics.length
                }
            };
        } catch (error) {
            logger.error('Error getting AI metrics report:', error.message);
            throw error;
        }
    }

    /**
     * Export analytics data in specified format
     * @param {Object} params - Export parameters
     * @returns {Promise<Object>} - Exported data
     */
    async exportData(params = {}) {
        try {
            const { format = 'json', startDate, endDate } = params;

            let start, end;

            if (startDate && endDate) {
                start = new Date(startDate);
                end = new Date(endDate);
            } else {
                // Default to last 30 days
                end = new Date();
                start = new Date();
                start.setDate(start.getDate() - 30);
            }

            start.setHours(0, 0, 0, 0);
            end.setHours(23, 59, 59, 999);

            const analytics = await analyticsRepository.findByDateRange(start, end);

            if (format === 'csv') {
                return this.convertToCSV(analytics);
            }

            // Default to JSON
            return {
                format: 'json',
                data: analytics,
                metadata: {
                    exportDate: new Date().toISOString(),
                    period: { start, end },
                    recordCount: analytics.length
                }
            };
        } catch (error) {
            logger.error('Error exporting data:', error.message);
            throw error;
        }
    }

    /**
     * Convert analytics data to CSV format
     * @param {Array} analytics - Analytics records
     * @returns {Object} - CSV data
     */
    convertToCSV(analytics) {
        try {
            const headers = [
                'Date',
                'Auctions Created',
                'Auctions Active',
                'Auctions Closed',
                'Total Auction Value',
                'New Users',
                'Active Users',
                'Total Users',
                'Total Bids',
                'Unique Bidders',
                'Average Bid Amount',
                'Total Transactions',
                'Total Revenue',
                'Payment Success Rate',
                'AI Predictions',
                'Fraud Detections',
                'Recommendations Served'
            ];

            const rows = analytics.map(record => [
                new Date(record.date).toISOString().split('T')[0],
                record.metrics.auctions.created,
                record.metrics.auctions.active,
                record.metrics.auctions.closed,
                record.metrics.auctions.totalValue,
                record.metrics.users.newRegistrations,
                record.metrics.users.activeUsers,
                record.metrics.users.totalUsers,
                record.metrics.bids.totalBids,
                record.metrics.bids.uniqueBidders,
                record.metrics.bids.averageBidAmount,
                record.metrics.payments.totalTransactions,
                record.metrics.payments.totalRevenue,
                record.metrics.payments.successRate,
                record.metrics.ai.predictionsGenerated,
                record.metrics.ai.fraudDetections,
                record.metrics.ai.recommendationsServed
            ]);

            const csvContent = [
                headers.join(','),
                ...rows.map(row => row.join(','))
            ].join('\n');

            return {
                format: 'csv',
                data: csvContent,
                metadata: {
                    exportDate: new Date().toISOString(),
                    recordCount: analytics.length
                }
            };
        } catch (error) {
            logger.error('Error converting to CSV:', error.message);
            throw error;
        }
    }

    /**
     * Track API performance metrics
     * @param {string} endpoint - API endpoint
     * @param {number} responseTime - Response time in ms
     * @param {boolean} isError - Whether request resulted in error
     */
    async trackAPIPerformance(endpoint, responseTime, isError = false) {
        try {
            // Store in Redis with TTL for real-time tracking
            const key = `api:performance:${endpoint}:${Date.now()}`;
            const data = {
                endpoint,
                responseTime,
                isError,
                timestamp: new Date().toISOString()
            };

            // Store with 24 hour TTL
            const { redisClient } = await import('../config/redis.config.js');
            if (redisClient && redisClient.isOpen) {
                await redisClient.setEx(key, 86400, JSON.stringify(data));
            }

            // Log slow requests (> 3 seconds)
            if (responseTime > 3000) {
                logger.warn(`Slow API request: ${endpoint} took ${responseTime}ms`);
            }
        } catch (error) {
            logger.error('Error tracking API performance:', error.message);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Get API performance metrics
     * @param {Object} params - Query parameters
     * @returns {Promise<Object>} - Performance metrics
     */
    async getAPIPerformanceMetrics(params = {}) {
        try {
            const { hours = 24 } = params;

            // This is a placeholder implementation
            // In production, you would query Redis or a time-series database
            return {
                averageResponseTime: 0,
                errorRate: 0,
                totalRequests: 0,
                slowRequests: 0,
                period: {
                    hours,
                    start: new Date(Date.now() - hours * 60 * 60 * 1000),
                    end: new Date()
                }
            };
        } catch (error) {
            logger.error('Error getting API performance metrics:', error.message);
            throw error;
        }
    }
}

export default new AnalyticsService();
