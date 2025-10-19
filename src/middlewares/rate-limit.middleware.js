import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { redisClient } from '../config/redis.config.js';
import logger from '../config/logger.js';

/**
 * IP-based rate limiter for all API endpoints
 * 100 requests per minute per IP address
 */
export const ipRateLimiter = rateLimit({
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 60000, // 1 minute
    max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // 100 requests per window
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this IP, please try again later',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
    legacyHeaders: false, // Disable `X-RateLimit-*` headers
    // Use Redis store if available, otherwise use memory store
    store: redisClient ? new RedisStore({
        // @ts-expect-error - Known issue with the library's typings
        client: redisClient,
        prefix: 'rl:ip:',
    }) : undefined,
    handler: (req, res) => {
        logger.warn('IP rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many requests from this IP, please try again later',
                timestamp: new Date().toISOString(),
                path: req.path,
            },
        });
    },
    skip: (req) => {
        // Skip rate limiting for health check endpoints
        return req.path === '/health' || req.path === '/api/v1/health';
    },
});

/**
 * User-based rate limiter
 * 1000 requests per hour per authenticated user
 */
export const userRateLimiter = rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: parseInt(process.env.USER_RATE_LIMIT_MAX_REQUESTS) || 1000, // 1000 requests per hour
    message: {
        success: false,
        error: {
            code: 'USER_RATE_LIMIT_EXCEEDED',
            message: 'Too many requests from this account, please try again later',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    // Use user ID as key instead of IP
    keyGenerator: (req) => {
        // Use user ID if authenticated, otherwise fall back to IP
        return req.user?.id?.toString() || req.ip;
    },
    // Use Redis store if available
    store: redisClient ? new RedisStore({
        // @ts-expect-error - Known issue with the library's typings
        client: redisClient,
        prefix: 'rl:user:',
    }) : undefined,
    handler: (req, res) => {
        logger.warn('User rate limit exceeded', {
            userId: req.user?.id,
            email: req.user?.email,
            ip: req.ip,
            path: req.path,
            method: req.method,
        });
        
        res.status(429).json({
            success: false,
            error: {
                code: 'USER_RATE_LIMIT_EXCEEDED',
                message: 'Too many requests from your account, please try again later',
                timestamp: new Date().toISOString(),
                path: req.path,
            },
        });
    },
    skip: (req) => {
        // Skip rate limiting for health check endpoints
        return req.path === '/health' || req.path === '/api/v1/health';
    },
    // Only apply to authenticated users
    skipFailedRequests: false,
    skipSuccessfulRequests: false,
});

/**
 * Strict rate limiter for sensitive endpoints (auth, payment)
 * 20 requests per 15 minutes
 */
export const strictRateLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 20, // 20 requests per window
    message: {
        success: false,
        error: {
            code: 'RATE_LIMIT_EXCEEDED',
            message: 'Too many attempts, please try again later',
            timestamp: new Date().toISOString(),
        },
    },
    standardHeaders: true,
    legacyHeaders: false,
    store: redisClient ? new RedisStore({
        // @ts-expect-error - Known issue with the library's typings
        client: redisClient,
        prefix: 'rl:strict:',
    }) : undefined,
    handler: (req, res) => {
        logger.warn('Strict rate limit exceeded', {
            ip: req.ip,
            path: req.path,
            method: req.method,
            userId: req.user?.id,
        });
        
        res.status(429).json({
            success: false,
            error: {
                code: 'RATE_LIMIT_EXCEEDED',
                message: 'Too many attempts, please try again after 15 minutes',
                timestamp: new Date().toISOString(),
                path: req.path,
            },
        });
    },
});

/**
 * Middleware to add rate limit headers to all responses
 */
export const addRateLimitHeaders = (req, res, next) => {
    // Headers are automatically added by express-rate-limit
    // This middleware can be used for custom header logic if needed
    next();
};
