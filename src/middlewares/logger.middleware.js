import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request logging middleware with Winston
 * Logs incoming requests and outgoing responses with timing information
 */
const loggerMiddleware = (req, res, next) => {
    // Generate unique request ID
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);

    // Log request
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    logger.info('Incoming Request', {
        requestId: req.id,
        method,
        url: originalUrl,
        ip: ip || req.connection.remoteAddress,
        userAgent: headers['user-agent'],
    });

    // Capture response
    const originalSend = res.send;
    res.send = function (data) {
        res.send = originalSend;
        
        const duration = Date.now() - startTime;
        const { statusCode } = res;

        // Log response
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        logger[logLevel]('Outgoing Response', {
            requestId: req.id,
            method,
            url: originalUrl,
            statusCode,
            duration: `${duration}ms`,
        });

        return res.send(data);
    };

    next();
};

export default loggerMiddleware;