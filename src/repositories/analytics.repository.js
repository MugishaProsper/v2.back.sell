import Analytics from '../models/analytics.model.js';
import logger from '../config/logger.js';

/**
 * AnalyticsRepository - Data access layer for Analytics entity
 * Handles all database operations for analytics with query optimization
 */
class AnalyticsRepository {
    /**
     * Create or update analytics for a specific date
     * @param {Date} date - Date for analytics
     * @param {Object} metrics - Metrics data
     * @returns {Promise<Object>} - Created or updated analytics
     */
    async upsert(date, metrics) {
        try {
            const analytics = await Analytics.findOneAndUpdate(
                { date },
                { $set: { metrics, createdAt: new Date() } },
                { upsert: true, new: true, runValidators: true }
            ).lean();
            
            logger.info(`Analytics upserted for date: ${date.toISOString().split('T')[0]}`);
            return analytics;
        } catch (error) {
            logger.error('Error upserting analytics:', error.message);
            throw error;
        }
    }

    /**
     * Find analytics by date
     * @param {Date} date - Date to find
     * @returns {Promise<Object|null>} - Analytics or null
     */
    async findByDate(date) {
        try {
            const analytics = await Analytics.findOne({ date }).lean();
            return analytics;
        } catch (error) {
            logger.error(`Error finding analytics by date ${date}:`, error.message);
            throw error;
        }
    }

    /**
     * Find analytics by date range
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of analytics
     */
    async findByDateRange(startDate, endDate, options = {}) {
        try {
            const analytics = await Analytics.findByDateRange(startDate, endDate, options);
            return analytics;
        } catch (error) {
            logger.error('Error finding analytics by date range:', error.message);
            throw error;
        }
    }

    /**
     * Get latest analytics
     * @param {number} days - Number of days to retrieve
     * @returns {Promise<Array>} - Array of analytics
     */
    async getLatest(days = 7) {
        try {
            const analytics = await Analytics.getLatest(days);
            return analytics;
        } catch (error) {
            logger.error('Error getting latest analytics:', error.message);
            throw error;
        }
    }

    /**
     * Aggregate metrics over a period
     * @param {Date} startDate - Start date
     * @param {Date} endDate - End date
     * @returns {Promise<Object|null>} - Aggregated metrics or null
     */
    async aggregateMetrics(startDate, endDate) {
        try {
            const result = await Analytics.aggregateMetrics(startDate, endDate);
            return result;
        } catch (error) {
            logger.error('Error aggregating metrics:', error.message);
            throw error;
        }
    }

    /**
     * Update specific metric for a date
     * @param {Date} date - Date to update
     * @param {string} category - Metric category
     * @param {string} field - Metric field
     * @param {number} value - New value
     * @returns {Promise<Object|null>} - Updated analytics or null
     */
    async updateMetric(date, category, field, value) {
        try {
            const updatePath = `metrics.${category}.${field}`;
            const analytics = await Analytics.findOneAndUpdate(
                { date },
                { $set: { [updatePath]: value } },
                { new: true, runValidators: true }
            ).lean();
            
            if (analytics) {
                logger.info(`Metric updated for date ${date}: ${category}.${field} = ${value}`);
            }
            
            return analytics;
        } catch (error) {
            logger.error('Error updating metric:', error.message);
            throw error;
        }
    }

    /**
     * Increment specific metric for a date
     * @param {Date} date - Date to update
     * @param {string} category - Metric category
     * @param {string} field - Metric field
     * @param {number} amount - Amount to increment
     * @returns {Promise<Object|null>} - Updated analytics or null
     */
    async incrementMetric(date, category, field, amount = 1) {
        try {
            const updatePath = `metrics.${category}.${field}`;
            const analytics = await Analytics.findOneAndUpdate(
                { date },
                { $inc: { [updatePath]: amount } },
                { new: true, upsert: true, runValidators: true }
            ).lean();
            
            if (analytics) {
                logger.info(`Metric incremented for date ${date}: ${category}.${field} += ${amount}`);
            }
            
            return analytics;
        } catch (error) {
            logger.error('Error incrementing metric:', error.message);
            throw error;
        }
    }

    /**
     * Delete analytics for a specific date
     * @param {Date} date - Date to delete
     * @returns {Promise<Object|null>} - Deleted analytics or null
     */
    async deleteByDate(date) {
        try {
            const analytics = await Analytics.findOneAndDelete({ date }).lean();
            
            if (analytics) {
                logger.info(`Analytics deleted for date: ${date.toISOString().split('T')[0]}`);
            }
            
            return analytics;
        } catch (error) {
            logger.error('Error deleting analytics:', error.message);
            throw error;
        }
    }

    /**
     * Get all analytics with pagination
     * @param {number} page - Page number
     * @param {number} limit - Items per page
     * @returns {Promise<Object>} - Analytics and pagination info
     */
    async findAll(page = 1, limit = 30) {
        try {
            const skip = (page - 1) * limit;
            
            const [analytics, total] = await Promise.all([
                Analytics.find()
                    .sort({ date: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Analytics.countDocuments()
            ]);

            return {
                analytics,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error('Error finding all analytics:', error.message);
            throw error;
        }
    }
}

export default new AnalyticsRepository();
