import { analyticsQueue, auctionExpirationQueue } from '../config/queue.config.js';
import logger from '../config/logger.js';

/**
 * Job Scheduler
 * Sets up recurring jobs for background processing
 */

/**
 * Schedule daily analytics aggregation
 * Runs every day at midnight
 */
export const scheduleDailyAnalytics = async () => {
    try {
        // Remove existing repeatable jobs to avoid duplicates
        const repeatableJobs = await analyticsQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === 'aggregate-daily') {
                await analyticsQueue.removeRepeatableByKey(job.key);
            }
        }
        
        // Schedule daily analytics aggregation at midnight
        await analyticsQueue.add(
            'aggregate-daily',
            {
                date: new Date()
            },
            {
                repeat: {
                    cron: '0 0 * * *', // Every day at midnight
                    tz: 'UTC'
                },
                jobId: 'daily-analytics-aggregation'
            }
        );
        
        logger.info('Daily analytics aggregation scheduled (runs at midnight UTC)');
    } catch (error) {
        logger.error('Error scheduling daily analytics:', error.message);
        throw error;
    }
};

/**
 * Schedule auction expiration checks
 * Runs every 5 minutes to check for expired auctions
 */
export const scheduleAuctionExpirationCheck = async () => {
    try {
        // Remove existing repeatable jobs to avoid duplicates
        const repeatableJobs = await auctionExpirationQueue.getRepeatableJobs();
        for (const job of repeatableJobs) {
            if (job.name === 'check-expired-auctions') {
                await auctionExpirationQueue.removeRepeatableByKey(job.key);
            }
        }
        
        // Schedule auction expiration check every 5 minutes
        await auctionExpirationQueue.add(
            'check-expired-auctions',
            {},
            {
                repeat: {
                    cron: '*/5 * * * *', // Every 5 minutes
                    tz: 'UTC'
                },
                jobId: 'auction-expiration-check'
            }
        );
        
        logger.info('Auction expiration check scheduled (runs every 5 minutes)');
    } catch (error) {
        logger.error('Error scheduling auction expiration check:', error.message);
        throw error;
    }
};

/**
 * Initialize all scheduled jobs
 */
export const initializeScheduledJobs = async () => {
    logger.info('Initializing scheduled jobs...');
    
    try {
        await scheduleDailyAnalytics();
        await scheduleAuctionExpirationCheck();
        
        logger.info('All scheduled jobs initialized successfully');
    } catch (error) {
        logger.error('Error initializing scheduled jobs:', error.message);
        throw error;
    }
};

/**
 * Remove all scheduled jobs
 * Useful for cleanup or testing
 */
export const removeAllScheduledJobs = async () => {
    logger.info('Removing all scheduled jobs...');
    
    try {
        const analyticsRepeatableJobs = await analyticsQueue.getRepeatableJobs();
        const auctionRepeatableJobs = await auctionExpirationQueue.getRepeatableJobs();
        
        for (const job of analyticsRepeatableJobs) {
            await analyticsQueue.removeRepeatableByKey(job.key);
        }
        
        for (const job of auctionRepeatableJobs) {
            await auctionExpirationQueue.removeRepeatableByKey(job.key);
        }
        
        logger.info('All scheduled jobs removed');
    } catch (error) {
        logger.error('Error removing scheduled jobs:', error.message);
        throw error;
    }
};

/**
 * Get all scheduled jobs
 * @returns {Promise<Object>} Scheduled jobs by queue
 */
export const getScheduledJobs = async () => {
    try {
        const [analyticsJobs, auctionJobs] = await Promise.all([
            analyticsQueue.getRepeatableJobs(),
            auctionExpirationQueue.getRepeatableJobs()
        ]);
        
        return {
            analytics: analyticsJobs,
            auctionExpiration: auctionJobs
        };
    } catch (error) {
        logger.error('Error getting scheduled jobs:', error.message);
        throw error;
    }
};

logger.info('Job scheduler initialized');
