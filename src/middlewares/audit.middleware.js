import auditService from '../services/audit.service.js';
import logger from '../config/logger.js';

/**
 * Middleware to audit authentication attempts
 * Should be used in auth controller after login attempt
 */
export const auditAuthAttempt = async (req, res, next) => {
    // Store original res.json to intercept response
    const originalJson = res.json.bind(res);
    
    res.json = function (data) {
        // Log the authentication attempt
        const success = data.success === true;
        const userId = data.data?.user?._id || data.data?.user?.id;
        
        auditService.logAuthAttempt({
            email: req.body.email,
            success,
            userId,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            error: data.error || null,
        }).catch(err => logger.error('Failed to audit auth attempt:', err));
        
        return originalJson(data);
    };
    
    next();
};

/**
 * Middleware to audit user registration
 */
export const auditRegistration = async (req, res, next) => {
    const originalJson = res.json.bind(res);
    
    res.json = function (data) {
        const success = data.success === true;
        const userId = data.data?.user?._id || data.data?.user?.id;
        
        auditService.logRegistration({
            userId,
            email: req.body.email,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            success,
            error: data.error || null,
        }).catch(err => logger.error('Failed to audit registration:', err));
        
        return originalJson(data);
    };
    
    next();
};

/**
 * Middleware to audit logout
 */
export const auditLogout = async (req, res, next) => {
    if (req.user) {
        auditService.logLogout({
            userId: req.user.id,
            email: req.user.email,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
        }).catch(err => logger.error('Failed to audit logout:', err));
    }
    
    next();
};

/**
 * Middleware to audit sensitive resource access
 */
export const auditResourceAccess = (action, resourceType) => {
    return async (req, res, next) => {
        const originalJson = res.json.bind(res);
        
        res.json = function (data) {
            const success = data.success === true;
            const resourceId = req.params.id || data.data?._id || data.data?.id;
            
            auditService.logResourceAccess({
                userId: req.user?.id,
                action,
                resourceType,
                resourceId,
                ipAddress: req.ip,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                success,
            }).catch(err => logger.error('Failed to audit resource access:', err));
            
            return originalJson(data);
        };
        
        next();
    };
};

/**
 * Middleware to detect and log unusual bid patterns
 */
export const auditBidPattern = async (req, res, next) => {
    try {
        if (req.user) {
            // Check for rapid bidding (potential bot activity)
            const recentBids = await auditService.getAuditLogs(
                {
                    userId: req.user.id,
                    action: 'BID_PLACE',
                    startDate: new Date(Date.now() - 60000), // Last minute
                },
                { limit: 10 }
            );

            if (recentBids.logs.length >= 5) {
                // More than 5 bids in a minute - suspicious
                await auditService.logSuspiciousActivity({
                    userId: req.user.id,
                    ipAddress: req.ip,
                    userAgent: req.headers['user-agent'],
                    path: req.path,
                    method: req.method,
                    details: {
                        reason: 'Rapid bidding detected',
                        bidCount: recentBids.logs.length,
                        timeWindow: '1 minute',
                    },
                });

                logger.warn('Unusual bid pattern detected', {
                    userId: req.user.id,
                    bidCount: recentBids.logs.length,
                });
            }
        }
    } catch (error) {
        logger.error('Error in bid pattern audit:', error);
    }
    
    next();
};

/**
 * Middleware to check for account lockout due to failed logins
 */
export const checkAccountLockout = async (req, res, next) => {
    try {
        const { email } = req.body;
        const ipAddress = req.ip;

        if (!email) {
            return next();
        }

        // Check failed login attempts in last 15 minutes
        const failedAttempts = await auditService.getFailedLoginAttempts(email, ipAddress, 15 * 60 * 1000);

        if (failedAttempts >= 5) {
            logger.warn('Account lockout triggered', {
                email,
                ipAddress,
                failedAttempts,
            });

            await auditService.logSuspiciousActivity({
                ipAddress,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: {
                    reason: 'Multiple failed login attempts',
                    email,
                    attempts: failedAttempts,
                },
            });

            return res.status(429).json({
                success: false,
                error: {
                    code: 'ACCOUNT_LOCKED',
                    message: 'Too many failed login attempts. Please try again in 15 minutes.',
                    timestamp: new Date().toISOString(),
                },
            });
        }
    } catch (error) {
        logger.error('Error checking account lockout:', error);
    }
    
    next();
};

/**
 * Middleware to check for suspicious IP activity
 */
export const checkSuspiciousIP = async (req, res, next) => {
    try {
        const ipAddress = req.ip;

        // Check suspicious activity count in last hour
        const suspiciousCount = await auditService.getSuspiciousActivityCount(ipAddress, 60 * 60 * 1000);

        if (suspiciousCount >= 3) {
            logger.error('IP blocked due to suspicious activity', {
                ipAddress,
                suspiciousCount,
            });

            await auditService.logSuspiciousActivity({
                userId: req.user?.id,
                ipAddress,
                userAgent: req.headers['user-agent'],
                path: req.path,
                method: req.method,
                details: {
                    reason: 'Multiple suspicious activities from IP',
                    count: suspiciousCount,
                },
            });

            return res.status(403).json({
                success: false,
                error: {
                    code: 'IP_BLOCKED',
                    message: 'Your IP has been temporarily blocked due to suspicious activity.',
                    timestamp: new Date().toISOString(),
                },
            });
        }
    } catch (error) {
        logger.error('Error checking suspicious IP:', error);
    }
    
    next();
};

/**
 * Middleware to log unauthorized access attempts
 */
export const auditUnauthorizedAccess = (resourceType) => {
    return async (req, res, next) => {
        // This should be called when authorization fails
        await auditService.logUnauthorizedAccess({
            userId: req.user?.id,
            ipAddress: req.ip,
            userAgent: req.headers['user-agent'],
            path: req.path,
            method: req.method,
            resourceType,
            resourceId: req.params.id,
        }).catch(err => logger.error('Failed to audit unauthorized access:', err));
        
        next();
    };
};
