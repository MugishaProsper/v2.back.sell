import Queue from 'bull';
import { redisQueueClient } from './redis.config.js';
import logger from './logger.js';

/**
 * Create a Bull queue with Redis connection
 * @param {string} name - Queue name
 * @param {object} options - Queue options
 * @returns {Queue} Bull queue instance
 */
export const createQueue = (name, options = {}) => {
    const queue = new Queue(name, {
        createClient: (type) => {
            switch (type) {
                case 'client':
                    return redisQueueClient.duplicate();
                case 'subscriber':
                    return redisQueueClient.duplicate();
                case 'bclient':
                    return redisQueueClient.duplicate();
                default:
                    return redisQueueClient.duplicate();
            }
        },
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: {
                age: 3600, // Keep completed jobs for 1 hour
                count: 1000 // Keep last 1000 completed jobs
            },
            removeOnFail: {
                age: 86400 // Keep failed jobs for 24 hours
            },
            ...options.defaultJobOptions
        },
        settings: {
            stalledInterval: 30000, // Check for stalled jobs every 30 seconds
            maxStalledCount: 2, // Max number of times a job can be recovered from stalled state
            ...options.settings
        },
        ...options
    });

    // Queue event listeners for monitoring and debugging
    queue.on('error', (error) => {
        logger.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} in queue ${name} failed after ${job.attemptsMade} attempts:`, {
            error: err.message,
            stack: err.stack,
            jobData: job.data,
            failedReason: job.failedReason
        });
    });

    queue.on('completed', (job, result) => {
        logger.debug(`Job ${job.id} in queue ${name} completed`, {
            duration: job.finishedOn - job.processedOn,
            attempts: job.attemptsMade
        });
    });

    queue.on('stalled', (job) => {
        logger.warn(`Job ${job.id} in queue ${name} stalled`, {
            attemptsMade: job.attemptsMade,
            data: job.data
        });
    });

    queue.on('progress', (job, progress) => {
        logger.debug(`Job ${job.id} in queue ${name} progress: ${progress}%`);
    });

    queue.on('active', (job) => {
        logger.debug(`Job ${job.id} in queue ${name} started processing`);
    });

    queue.on('waiting', (jobId) => {
        logger.debug(`Job ${jobId} in queue ${name} is waiting`);
    });

    queue.on('removed', (job) => {
        logger.debug(`Job ${job.id} in queue ${name} removed`);
    });

    logger.info(`Queue ${name} initialized`);
    return queue;
};

// AI Webhook Queue
export const aiWebhookQueue = createQueue('ai-webhooks', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        },
        timeout: 10000 // 10 seconds
    }
});

// Email Notification Queue
export const emailQueue = createQueue('email-notifications', {
    defaultJobOptions: {
        attempts: 5,
        backoff: {
            type: 'exponential',
            delay: 2000
        }
    }
});

// Analytics Queue
export const analyticsQueue = createQueue('analytics', {
    defaultJobOptions: {
        attempts: 2,
        backoff: {
            type: 'fixed',
            delay: 5000
        }
    }
});

// Auction Expiration Queue
export const auctionExpirationQueue = createQueue('auction-expiration', {
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 1000
        }
    }
});

logger.info('All queues initialized successfully');
