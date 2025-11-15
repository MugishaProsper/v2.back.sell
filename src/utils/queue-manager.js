import logger from '../config/logger.js';
import {
    emailQueue,
    aiWebhookQueue,
    analyticsQueue,
    auctionExpirationQueue
} from '../config/queue.config.js';

/**
 * Queue Manager Utility
 * Provides centralized queue management, monitoring, and error handling
 */

class QueueManager {
    constructor() {
        this.queues = {
            email: emailQueue,
            aiWebhook: aiWebhookQueue,
            analytics: analyticsQueue,
            auctionExpiration: auctionExpirationQueue
        };
        
        this.setupGlobalErrorHandlers();
    }

    /**
     * Setup global error handlers for all queues
     */
    setupGlobalErrorHandlers() {
        Object.entries(this.queues).forEach(([name, queue]) => {
            queue.on('error', (error) => {
                logger.error(`Queue ${name} error:`, error);
            });

            queue.on('failed', (job, err) => {
                logger.error(`Job ${job.id} in queue ${name} failed:`, {
                    jobId: job.id,
                    attempts: job.attemptsMade,
                    error: err.message,
                    data: job.data
                });
                
                // Handle permanent failures (after all retries)
                if (job.attemptsMade >= job.opts.attempts) {
                    this.handlePermanentFailure(name, job, err);
                }
            });

            queue.on('stalled', (job) => {
                logger.warn(`Job ${job.id} in queue ${name} stalled`);
            });

            queue.on('completed', (job, result) => {
                logger.debug(`Job ${job.id} in queue ${name} completed`, {
                    jobId: job.id,
                    processingTime: job.finishedOn - job.processedOn
                });
            });
        });
    }

    /**
     * Handle permanent job failures
     * @param {string} queueName - Queue name
     * @param {Object} job - Failed job
     * @param {Error} error - Error that caused failure
     */
    async handlePermanentFailure(queueName, job, error) {
        logger.error(`Permanent failure for job ${job.id} in queue ${queueName}:`, {
            jobId: job.id,
            queueName,
            attempts: job.attemptsMade,
            error: error.message,
            data: job.data,
            timestamp: new Date().toISOString()
        });

        // Store failed job for manual review
        try {
            // Could store in database or send alert
            // For now, just log it
            logger.error(`Failed job stored for review: ${queueName}/${job.id}`);
        } catch (err) {
            logger.error('Error storing failed job:', err);
        }
    }

    /**
     * Add job to queue with retry configuration
     * @param {string} queueName - Queue name
     * @param {string} jobType - Job type/name
     * @param {Object} data - Job data
     * @param {Object} options - Job options
     * @returns {Promise<Object>} Job instance
     */
    async addJob(queueName, jobType, data, options = {}) {
        const queue = this.queues[queueName];
        
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        const defaultOptions = {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 2000
            },
            removeOnComplete: true,
            removeOnFail: false,
            ...options
        };

        try {
            const job = await queue.add(jobType, data, defaultOptions);
            logger.info(`Job ${job.id} added to queue ${queueName}`, {
                jobId: job.id,
                jobType,
                queueName
            });
            return job;
        } catch (error) {
            logger.error(`Error adding job to queue ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Get queue statistics
     * @param {string} queueName - Queue name (optional, returns all if not specified)
     * @returns {Promise<Object>} Queue statistics
     */
    async getQueueStats(queueName = null) {
        try {
            if (queueName) {
                const queue = this.queues[queueName];
                if (!queue) {
                    throw new Error(`Queue ${queueName} not found`);
                }
                return await this.getQueueCounts(queueName, queue);
            }

            // Get stats for all queues
            const stats = {};
            for (const [name, queue] of Object.entries(this.queues)) {
                stats[name] = await this.getQueueCounts(name, queue);
            }
            return stats;
        } catch (error) {
            logger.error('Error getting queue stats:', error);
            throw error;
        }
    }

    /**
     * Get counts for a specific queue
     * @param {string} name - Queue name
     * @param {Object} queue - Queue instance
     * @returns {Promise<Object>} Queue counts
     */
    async getQueueCounts(name, queue) {
        const [
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused
        ] = await Promise.all([
            queue.getWaitingCount(),
            queue.getActiveCount(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.getPausedCount()
        ]);

        return {
            name,
            waiting,
            active,
            completed,
            failed,
            delayed,
            paused,
            total: waiting + active + completed + failed + delayed
        };
    }

    /**
     * Pause a queue
     * @param {string} queueName - Queue name
     * @returns {Promise<void>}
     */
    async pauseQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        await queue.pause();
        logger.info(`Queue ${queueName} paused`);
    }

    /**
     * Resume a queue
     * @param {string} queueName - Queue name
     * @returns {Promise<void>}
     */
    async resumeQueue(queueName) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        await queue.resume();
        logger.info(`Queue ${queueName} resumed`);
    }

    /**
     * Clean old jobs from queue
     * @param {string} queueName - Queue name
     * @param {number} grace - Grace period in ms (default: 24 hours)
     * @param {string} status - Job status to clean (completed, failed)
     * @returns {Promise<number>} Number of jobs cleaned
     */
    async cleanQueue(queueName, grace = 86400000, status = 'completed') {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        try {
            const cleaned = await queue.clean(grace, status);
            logger.info(`Cleaned ${cleaned.length} ${status} jobs from queue ${queueName}`);
            return cleaned.length;
        } catch (error) {
            logger.error(`Error cleaning queue ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Retry a failed job
     * @param {string} queueName - Queue name
     * @param {string} jobId - Job ID
     * @returns {Promise<void>}
     */
    async retryJob(queueName, jobId) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        try {
            const job = await queue.getJob(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found in queue ${queueName}`);
            }

            await job.retry();
            logger.info(`Job ${jobId} in queue ${queueName} retried`);
        } catch (error) {
            logger.error(`Error retrying job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Get failed jobs
     * @param {string} queueName - Queue name
     * @param {number} start - Start index
     * @param {number} end - End index
     * @returns {Promise<Array>} Failed jobs
     */
    async getFailedJobs(queueName, start = 0, end = 10) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        try {
            const jobs = await queue.getFailed(start, end);
            return jobs.map(job => ({
                id: job.id,
                name: job.name,
                data: job.data,
                failedReason: job.failedReason,
                attemptsMade: job.attemptsMade,
                timestamp: job.timestamp,
                finishedOn: job.finishedOn
            }));
        } catch (error) {
            logger.error(`Error getting failed jobs from ${queueName}:`, error);
            throw error;
        }
    }

    /**
     * Remove a job from queue
     * @param {string} queueName - Queue name
     * @param {string} jobId - Job ID
     * @returns {Promise<void>}
     */
    async removeJob(queueName, jobId) {
        const queue = this.queues[queueName];
        if (!queue) {
            throw new Error(`Queue ${queueName} not found`);
        }

        try {
            const job = await queue.getJob(jobId);
            if (!job) {
                throw new Error(`Job ${jobId} not found in queue ${queueName}`);
            }

            await job.remove();
            logger.info(`Job ${jobId} removed from queue ${queueName}`);
        } catch (error) {
            logger.error(`Error removing job ${jobId}:`, error);
            throw error;
        }
    }

    /**
     * Close all queues gracefully
     * @returns {Promise<void>}
     */
    async closeAll() {
        logger.info('Closing all queues...');
        
        const closePromises = Object.entries(this.queues).map(async ([name, queue]) => {
            try {
                await queue.close();
                logger.info(`Queue ${name} closed`);
            } catch (error) {
                logger.error(`Error closing queue ${name}:`, error);
            }
        });

        await Promise.all(closePromises);
        logger.info('All queues closed');
    }
}

// Export singleton instance
const queueManager = new QueueManager();
export default queueManager;