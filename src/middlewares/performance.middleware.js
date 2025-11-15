import performanceMonitor from '../services/performance-monitor.service.js';

/**
 * Performance monitoring middleware
 * Tracks API response times and integrates with performance monitor service
 */
const performanceMiddleware = (req, res, next) => {
    const startTime = Date.now();

    // Capture response finish event
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        
        // Track API request performance
        performanceMonitor.trackAPIRequest({
            method: req.method,
            url: req.originalUrl || req.url,
            duration,
            statusCode: res.statusCode,
            requestId: req.id || req.headers['x-request-id'] || 'unknown'
        });
    });

    next();
};

export default performanceMiddleware;
