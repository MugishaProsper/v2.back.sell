import logger from '../config/logger.js';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request logging middleware with Winston
 * Logs incoming requests and outgoing responses with timing information
 * Includes request ID for distributed tracing
 */
const loggerMiddleware = (req, res, next) => {
    // Generate unique request ID for tracing
    req.id = req.headers['x-request-id'] || uuidv4();
    res.setHeader('X-Request-Id', req.id);

    // Capture request start time
    const startTime = Date.now();
    const { method, originalUrl, ip, headers } = req;

    // Extract user information if available
    const userId = req.user?.id || req.user?._id || null;
    const userRole = req.user?.role || null;

    // Log incoming request with structured data
    logger.info('Incoming Request', {
        requestId: req.id,
        method,
        url: originalUrl,
        ip: ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
        userAgent: headers['user-agent'],
        userId,
        userRole,
        contentType: headers['content-type'],
        contentLength: headers['content-length'],
        referer: headers['referer'] || headers['referrer'],
        timestamp: new Date().toISOString()
    });

    // Capture response
    const originalSend = res.send;
    const originalJson = res.json;
    
    // Override res.send
    res.send = function (data) {
        res.send = originalSend;
        logResponse(data);
        return res.send(data);
    };
    
    // Override res.json
    res.json = function (data) {
        res.json = originalJson;
        logResponse(data);
        return res.json(data);
    };

    // Function to log response
    const logResponse = (data) => {
        const duration = Date.now() - startTime;
        const { statusCode } = res;
        
        // Determine response size
        let responseSize = 0;
        if (data) {
            responseSize = typeof data === 'string' ? data.length : JSON.stringify(data).length;
        }

        // Determine log level based on status code
        const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
        
        // Structured response log
        const logData = {
            requestId: req.id,
            method,
            url: originalUrl,
            statusCode,
            duration,
            durationMs: `${duration}ms`,
            responseSize,
            userId,
            userRole,
            timestamp: new Date().toISOString()
        };

        // Add error details if present
        if (statusCode >= 400 && data) {
            try {
                const parsedData = typeof data === 'string' ? JSON.parse(data) : data;
                if (parsedData.error) {
                    logData.errorCode = parsedData.error.code;
                    logData.errorMessage = parsedData.error.message;
                }
            } catch (e) {
                // Ignore parsing errors
            }
        }

        logger[logLevel]('Outgoing Response', logData);
        
        // Log slow requests (> 1 second) as warnings
        if (duration > 1000 && statusCode < 400) {
            logger.warn('Slow Request Detected', {
                requestId: req.id,
                method,
                url: originalUrl,
                duration,
                durationMs: `${duration}ms`,
                threshold: '1000ms'
            });
        }
    };

    // Handle response finish event (for cases where send/json aren't called)
    res.on('finish', () => {
        if (!res.headersSent) {
            return;
        }
        
        // Only log if we haven't already logged via send/json
        if (res.send === originalSend && res.json === originalJson) {
            const duration = Date.now() - startTime;
            const { statusCode } = res;
            const logLevel = statusCode >= 500 ? 'error' : statusCode >= 400 ? 'warn' : 'info';
            
            logger[logLevel]('Outgoing Response', {
                requestId: req.id,
                method,
                url: originalUrl,
                statusCode,
                duration,
                durationMs: `${duration}ms`,
                userId,
                userRole,
                timestamp: new Date().toISOString()
            });
        }
    });

    next();
};

export default loggerMiddleware;