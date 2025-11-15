import logger from '../config/logger.js';

/**
 * Queue Utilities
 * Helper functions for queue management and monitoring
 */

/**
 * Retry a failed job manually
 * @param {Queue} queue - Bull queue instance
 * @param {string} jobId - Job ID to retry
 * @returns {Promise<Object>} Retried job
 */
export const retryFailedJob = async (queue, jobId) => {
    try {
        const job = await queue.getJob(jobId);
        
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        if (job.finishedOn && !job.failedReason) {
            throw new Error(`Job ${jobId} has not failed`);
        }
        
        await job.retry();
        logger.info(`Job ${jobId} retried successfully`);
        
        return job;
    } catch (error) {
        logger.error(`Error retrying job ${jobId}:`, error.message);
        throw error;
    }
};

/**
 * Get detailed job information
 * @param {Queue} queue - Bull queue instance
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Job details
 */
export const getJobDetails = async (queue, jobId) => {
    try {
        const job = await queue.getJob(jobId);
        
        if (!job) {
            return null;
        }
        
        const state = await job.getState();
        const logs = await queue.getJobLogs(jobId);
        
        return {
            id: job.id,
            name: job.name,
            data: job.data,
            opts: job.opts,
            progress: job.progress(),
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            returnvalue: job.returnvalue,
            finishedOn: job.finishedOn,
            processedOn: job.processedOn,
            timestamp: job.timestamp,
            state,
            logs
        };
    } catch (error) {
        logger.error(`Error getting job details for ${jobId}:`, error.message);
        throw error;
    }
};

/**
 * Get failed jobs from a queue
 * @param {Queue} queue - Bull queue instance
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} Failed jobs
 */
export const getFailedJobs = async (queue, start = 0, end = 10) => {
    try {
        const jobs = await queue.getFailed(start, end);
        
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            attemptsMade: job.attemptsMade,
            failedReason: job.failedReason,
            stacktrace: job.stacktrace,
            timestamp: job.timestamp,
            finishedOn: job.finishedOn
        }));
    } catch (error) {
        logger.error('Error getting failed jobs:', error.message);
        throw error;
    }
};

/**
 * Get active jobs from a queue
 * @param {Queue} queue - Bull queue instance
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} Active jobs
 */
export const getActiveJobs = async (queue, start = 0, end = 10) => {
    try {
        const jobs = await queue.getActive(start, end);
        
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            progress: job.progress(),
            attemptsMade: job.attemptsMade,
            timestamp: job.timestamp,
            processedOn: job.processedOn
        }));
    } catch (error) {
        logger.error('Error getting active jobs:', error.message);
        throw error;
    }
};

/**
 * Get waiting jobs from a queue
 * @param {Queue} queue - Bull queue instance
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} Waiting jobs
 */
export const getWaitingJobs = async (queue, start = 0, end = 10) => {
    try {
        const jobs = await queue.getWaiting(start, end);
        
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            timestamp: job.timestamp
        }));
    } catch (error) {
        logger.error('Error getting waiting jobs:', error.message);
        throw error;
    }
};

/**
 * Get completed jobs from a queue
 * @param {Queue} queue - Bull queue instance
 * @param {number} start - Start index
 * @param {number} end - End index
 * @returns {Promise<Array>} Completed jobs
 */
export const getCompletedJobs = async (queue, start = 0, end = 10) => {
    try {
        const jobs = await queue.getCompleted(start, end);
        
        return jobs.map(job => ({
            id: job.id,
            name: job.name,
            data: job.data,
            returnvalue: job.returnvalue,
            timestamp: job.timestamp,
            processedOn: job.processedOn,
            finishedOn: job.finishedOn,
            duration: job.finishedOn - job.processedOn
        }));
    } catch (error) {
        logger.error('Error getting completed jobs:', error.message);
        throw error;
    }
};

/**
 * Remove a job from the queue
 * @param {Queue} queue - Bull queue instance
 * @param {string} jobId - Job ID to remove
 * @returns {Promise<void>}
 */
export const removeJob = async (queue, jobId) => {
    try {
        const job = await queue.getJob(jobId);
        
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        await job.remove();
        logger.info(`Job ${jobId} removed successfully`);
    } catch (error) {
        logger.error(`Error removing job ${jobId}:`, error.message);
        throw error;
    }
};

/**
 * Promote a delayed job to be processed immediately
 * @param {Queue} queue - Bull queue instance
 * @param {string} jobId - Job ID to promote
 * @returns {Promise<void>}
 */
export const promoteJob = async (queue, jobId) => {
    try {
        const job = await queue.getJob(jobId);
        
        if (!job) {
            throw new Error(`Job ${jobId} not found`);
        }
        
        await job.promote();
        logger.info(`Job ${jobId} promoted successfully`);
    } catch (error) {
        logger.error(`Error promoting job ${jobId}:`, error.message);
        throw error;
    }
};

/**
 * Get queue metrics
 * @param {Queue} queue - Bull queue instance
 * @returns {Promise<Object>} Queue metrics
 */
export const getQueueMetrics = async (queue) => {
    try {
        const [
            jobCounts,
            completedCount,
            failedCount,
            delayedCount,
            activeCount,
            waitingCount,
            pausedCount
        ] = await Promise.all([
            queue.getJobCounts(),
            queue.getCompletedCount(),
            queue.getFailedCount(),
            queue.getDelayedCount(),
            queue.getActiveCount(),
            queue.getWaitingCount(),
            queue.getPausedCount()
        ]);
        
        return {
            name: queue.name,
            counts: jobCounts,
            completed: completedCount,
            failed: failedCount,
            delayed: delayedCount,
            active: activeCount,
            waiting: waitingCount,
            paused: pausedCount,
            isPaused: await queue.isPaused()
        };
    } catch (error) {
        logger.error('Error getting queue metrics:', error.message);
        throw error;
    }
};

/**
 * Drain queue (remove all jobs)
 * @param {Queue} queue - Bull queue instance
 * @returns {Promise<void>}
 */
export const drainQueue = async (queue) => {
    try {
        await queue.drain();
        logger.warn(`Queue ${queue.name} drained (all jobs removed)`);
    } catch (error) {
        logger.error(`Error draining queue ${queue.name}:`, error.message);
        throw error;
    }
};

/**
 * Empty queue (remove all waiting jobs)
 * @param {Queue} queue - Bull queue instance
 * @returns {Promise<void>}
 */
export const emptyQueue = async (queue) => {
    try {
        await queue.empty();
        logger.warn(`Queue ${queue.name} emptied (all waiting jobs removed)`);
    } catch (error) {
        logger.error(`Error emptying queue ${queue.name}:`, error.message);
        throw error;
    }
};

/**
 * Calculate queue processing rate
 * @param {Queue} queue - Bull queue instance
 * @param {number} timeWindowMs - Time window in milliseconds (default: 1 hour)
 * @returns {Promise<Object>} Processing rate statistics
 */
export const getProcessingRate = async (queue, timeWindowMs = 3600000) => {
    try {
        const now = Date.now();
        const startTime = now - timeWindowMs;
        
        const completedJobs = await queue.getCompleted(0, -1);
        const failedJobs = await queue.getFailed(0, -1);
        
        const recentCompleted = completedJobs.filter(
            job => job.finishedOn >= startTime
        );
        const recentFailed = failedJobs.filter(
            job => job.finishedOn >= startTime
        );
        
        const totalProcessed = recentCompleted.length + recentFailed.length;
        const successRate = totalProcessed > 0 
            ? (recentCompleted.length / totalProcessed) * 100 
            : 0;
        
        const avgProcessingTime = recentCompleted.length > 0
            ? recentCompleted.reduce((sum, job) => 
                sum + (job.finishedOn - job.processedOn), 0
              ) / recentCompleted.length
            : 0;
        
        return {
            timeWindowMs,
            totalProcessed,
            completed: recentCompleted.length,
            failed: recentFailed.length,
            successRate: successRate.toFixed(2) + '%',
            avgProcessingTimeMs: Math.round(avgProcessingTime),
            jobsPerHour: Math.round((totalProcessed / timeWindowMs) * 3600000)
        };
    } catch (error) {
        logger.error('Error calculating processing rate:', error.message);
        throw error;
    }
};

logger.info('Queue utilities loaded');
