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
            removeOnComplete: true,
            removeOnFail: false,
            ...options.defaultJobOptions
        },
        ...options
    });

    // Queue event listeners
    queue.on('error', (error) => {
        logger.error(`Queue ${name} error:`, error);
    });

    queue.on('failed', (job, err) => {
        logger.error(`Job ${job.id} in queue ${name} failed:`, err.message);
    });

    queue.on('completed', (job) => {
        logger.debug(`Job ${job.id} in queue ${name} completed`);
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
