import logger from '../config/logger.js';

/**
 * Custom API Error class
 */
export class ApiError extends Error {
    constructor(statusCode, code, message, details = null) {
        super(message);
        this.statusCode = statusCode;
        this.code = code;
        this.details = details;
        this.isOperational = true;
        Error.captureStackTrace(this, this.constructor);
    }
}

/**
 * Error response formatter
 */
const formatErrorResponse = (err, req) => {
    return {
        success: false,
        error: {
            code: err.code || 'INTERNAL_SERVER_ERROR',
            message: err.message || 'An unexpected error occurred',
            details: err.details || null,
            timestamp: new Date().toISOString(),
            path: req.originalUrl,
            requestId: req.id || req.headers['x-request-id'] || 'unknown',
        },
    };
};

/**
 * Centralized error handling middleware
 */
export const errorHandler = (err, req, res, next) => {
    let error = err;

    // Handle Mongoose validation errors
    if (err.name === 'ValidationError') {
        const details = Object.values(err.errors).map((e) => ({
            field: e.path,
            message: e.message,
        }));
        error = new ApiError(400, 'VALIDATION_FAILED', 'Validation failed', details);
    }

    // Handle Mongoose duplicate key errors
    if (err.code === 11000) {
        const field = Object.keys(err.keyPattern)[0];
        error = new ApiError(
            400,
            'DUPLICATE_FIELD',
            `${field} already exists`,
            { field }
        );
    }

    // Handle Mongoose cast errors
    if (err.name === 'CastError') {
        error = new ApiError(
            400,
            'INVALID_INPUT',
            `Invalid ${err.path}: ${err.value}`
        );
    }

    // Handle JWT errors
    if (err.name === 'JsonWebTokenError') {
        error = new ApiError(401, 'AUTH_INVALID_TOKEN', 'Invalid token');
    }

    if (err.name === 'TokenExpiredError') {
        error = new ApiError(401, 'AUTH_TOKEN_EXPIRED', 'Token expired');
    }

    // Set default status code if not set
    const statusCode = error.statusCode || 500;
    const errorResponse = formatErrorResponse(error, req);

    // Log error with stack trace and full context
    const errorLogData = {
        errorCode: error.code || 'INTERNAL_SERVER_ERROR',
        errorMessage: error.message,
        statusCode,
        path: req.originalUrl,
        method: req.method,
        requestId: errorResponse.error.requestId,
        userId: req.user?.id || req.user?._id || null,
        userRole: req.user?.role || null,
        ip: req.ip || req.connection?.remoteAddress || req.socket?.remoteAddress,
        userAgent: req.headers['user-agent'],
        timestamp: new Date().toISOString()
    };

    // Add stack trace for server errors and in development
    if (statusCode >= 500 || process.env.NODE_ENV === 'development') {
        errorLogData.stack = error.stack;
    }

    // Add error details if present
    if (error.details) {
        errorLogData.details = error.details;
    }

    // Add request body for debugging (exclude sensitive fields)
    if (req.body && Object.keys(req.body).length > 0) {
        const sanitizedBody = { ...req.body };
        // Remove sensitive fields
        delete sanitizedBody.password;
        delete sanitizedBody.token;
        delete sanitizedBody.refreshToken;
        delete sanitizedBody.secret;
        errorLogData.requestBody = sanitizedBody;
    }

    // Log with appropriate level
    if (statusCode >= 500) {
        logger.error('Server Error', errorLogData);
    } else if (statusCode >= 400) {
        logger.warn('Client Error', errorLogData);
    }

    // Send error response
    res.status(statusCode).json(errorResponse);
};

/**
 * 404 Not Found handler
 */
export const notFoundHandler = (req, res, next) => {
    const error = new ApiError(
        404,
        'RESOURCE_NOT_FOUND',
        `Route ${req.originalUrl} not found`
    );
    next(error);
};
