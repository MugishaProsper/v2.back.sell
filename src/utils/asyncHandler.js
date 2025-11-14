/**
 * Async error wrapper utility for route handlers
 * Wraps async route handlers to catch errors and pass them to error handling middleware
 * 
 * @param {Function} fn - Async route handler function
 * @returns {Function} - Wrapped function with error handling
 */
export const asyncHandler = (fn) => {
    return (req, res, next) => {
        Promise.resolve(fn(req, res, next)).catch(next);
    };
};
