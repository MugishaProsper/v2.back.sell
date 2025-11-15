import prometheusMetrics from '../services/prometheus-metrics.service.js';

/**
 * Prometheus metrics middleware
 * Tracks HTTP requests for Prometheus monitoring
 */
const prometheusMiddleware = (req, res, next) => {
    const startTime = Date.now();
    
    // Normalize route for better metric grouping
    const route = normalizeRoute(req.route?.path || req.path || req.url);
    const method = req.method;

    // Track request start
    prometheusMetrics.trackRequestStart(method, route);

    // Capture response finish event
    res.on('finish', () => {
        const duration = Date.now() - startTime;
        const statusCode = res.statusCode;
        
        // Track request completion
        prometheusMetrics.trackHttpRequest(method, route, statusCode, duration);
        prometheusMetrics.trackRequestEnd(method, route);
    });

    next();
};

/**
 * Normalize route path for better metric grouping
 * Replaces dynamic segments with placeholders
 */
function normalizeRoute(path) {
    if (!path) return '/unknown';
    
    // Replace MongoDB ObjectIds (24 hex characters)
    let normalized = path.replace(/\/[0-9a-fA-F]{24}/g, '/:id');
    
    // Replace UUIDs
    normalized = normalized.replace(
        /\/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi,
        '/:id'
    );
    
    // Replace numeric IDs
    normalized = normalized.replace(/\/\d+/g, '/:id');
    
    // Remove query strings
    normalized = normalized.split('?')[0];
    
    return normalized;
}

export default prometheusMiddleware;
