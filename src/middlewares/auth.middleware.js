import jwt from 'jsonwebtoken';
import User from '../models/user.model.js';
import logger from '../config/logger.js';

/**
 * Middleware to verify JWT token and authenticate user
 */
export const authenticate = async (req, res, next) => {
    try {
        // Get token from header
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_TOKEN_MISSING',
                    message: 'Authentication token is required',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        const token = authHeader.substring(7); // Remove 'Bearer ' prefix
        
        // Verify token
        let decoded;
        try {
            decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
        } catch (error) {
            if (error.name === 'TokenExpiredError') {
                return res.status(401).json({
                    success: false,
                    error: {
                        code: 'AUTH_TOKEN_EXPIRED',
                        message: 'Authentication token has expired',
                        timestamp: new Date().toISOString(),
                        path: req.path
                    }
                });
            }
            
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_INVALID_TOKEN',
                    message: 'Invalid authentication token',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Get user from database
        const user = await User.findById(decoded.id);
        
        if (!user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_USER_NOT_FOUND',
                    message: 'User not found',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        // Attach user to request object
        req.user = {
            id: user._id,
            email: user.email,
            role: user.role
        };
        
        next();
    } catch (error) {
        logger.error('Authentication middleware error:', error);
        return res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'An error occurred during authentication',
                timestamp: new Date().toISOString(),
                path: req.path
            }
        });
    }
};

/**
 * Middleware to check if user has required role(s)
 * @param  {...string} roles - Allowed roles
 */
export const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                error: {
                    code: 'AUTH_REQUIRED',
                    message: 'Authentication is required',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        if (!roles.includes(req.user.role)) {
            logger.warn(`Authorization failed: User ${req.user.email} with role ${req.user.role} attempted to access ${req.path}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'AUTH_INSUFFICIENT_PERMISSIONS',
                    message: 'You do not have permission to access this resource',
                    timestamp: new Date().toISOString(),
                    path: req.path
                }
            });
        }
        
        next();
    };
};

/**
 * Optional authentication - attaches user if token is valid, but doesn't require it
 */
export const optionalAuth = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET);
            const user = await User.findById(decoded.id);
            
            if (user) {
                req.user = {
                    id: user._id,
                    email: user.email,
                    role: user.role
                };
            }
        } catch (error) {
            // Token invalid or expired, but that's okay for optional auth
            logger.debug('Optional auth: Invalid or expired token');
        }
        
        next();
    } catch (error) {
        logger.error('Optional authentication middleware error:', error);
        next();
    }
};

/**
 * Middleware to refresh token if it's about to expire
 */
export const refreshTokenIfNeeded = async (req, res, next) => {
    try {
        const authHeader = req.headers.authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return next();
        }
        
        const token = authHeader.substring(7);
        
        try {
            const decoded = jwt.verify(token, process.env.JWT_ACCESS_SECRET, { ignoreExpiration: true });
            
            // Check if token expires in less than 5 minutes
            const expiresIn = decoded.exp - Math.floor(Date.now() / 1000);
            
            if (expiresIn < 300 && expiresIn > 0) {
                // Token is about to expire, generate new one
                const user = await User.findById(decoded.id);
                
                if (user) {
                    const newAccessToken = user.generateAccessToken();
                    res.setHeader('X-New-Access-Token', newAccessToken);
                    logger.info(`Token refreshed for user: ${user.email}`);
                }
            }
        } catch (error) {
            // If there's an error, just continue
            logger.debug('Token refresh check failed:', error.message);
        }
        
        next();
    } catch (error) {
        logger.error('Token refresh middleware error:', error);
        next();
    }
};
