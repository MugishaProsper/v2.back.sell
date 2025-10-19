import AuditLog from '../models/audit-log.model.js';
import logger from '../config/logger.js';

/**
 * Service for logging security and audit events
 */
class AuditService {
    /**
     * Log an audit event
     * @param {Object} data - Audit log data
     */
    async log(data) {
        try {
            const auditLog = new AuditLog({
                user: data.userId || null,
                email: data.email || null,
                action: data.action,
                resourceType: data.resourceType || null,
                resourceId: data.resourceId || null,
                ipAddress: data.ipAddress,
                userAgent: data.userAgent || null,
                method: data.method || null,
                path: data.path || null,
                status: data.status,
                statusCode: data.statusCode || null,
                details: data.details || null,
                error: data.error || null,
                metadata: data.metadata || {},
                timestamp: new Date(),
            });

            await auditLog.save();

            // Also log to Winston for immediate visibility
            const logLevel = data.status === 'failure' ? 'warn' : 'info';
            logger[logLevel]('Audit Log', {
                action: data.action,
                user: data.userId,
                email: data.email,
                status: data.status,
                ip: data.ipAddress,
            });
        } catch (error) {
            // Don't let audit logging failures break the application
            logger.error('Failed to create audit log:', error);
        }
    }

    /**
     * Log authentication attempt
     */
    async logAuthAttempt({ email, success, userId, ipAddress, userAgent, error }) {
        await this.log({
            userId,
            email,
            action: success ? 'AUTH_LOGIN_SUCCESS' : 'AUTH_LOGIN_FAILED',
            resourceType: 'user',
            resourceId: userId,
            ipAddress,
            userAgent,
            method: 'POST',
            path: '/api/v1/auth/login',
            status: success ? 'success' : 'failure',
            statusCode: success ? 200 : 401,
            error: error ? { code: error.code, message: error.message } : null,
        });
    }

    /**
     * Log user registration
     */
    async logRegistration({ userId, email, ipAddress, userAgent, success, error }) {
        await this.log({
            userId,
            email,
            action: 'AUTH_REGISTER',
            resourceType: 'user',
            resourceId: userId,
            ipAddress,
            userAgent,
            method: 'POST',
            path: '/api/v1/auth/register',
            status: success ? 'success' : 'failure',
            statusCode: success ? 201 : 400,
            error: error ? { code: error.code, message: error.message } : null,
        });
    }

    /**
     * Log logout
     */
    async logLogout({ userId, email, ipAddress, userAgent }) {
        await this.log({
            userId,
            email,
            action: 'AUTH_LOGOUT',
            resourceType: 'user',
            resourceId: userId,
            ipAddress,
            userAgent,
            method: 'POST',
            path: '/api/v1/auth/logout',
            status: 'success',
            statusCode: 200,
        });
    }

    /**
     * Log suspicious activity
     */
    async logSuspiciousActivity({ userId, ipAddress, userAgent, path, method, details }) {
        await this.log({
            userId,
            action: 'SECURITY_SUSPICIOUS_ACTIVITY',
            ipAddress,
            userAgent,
            method,
            path,
            status: 'warning',
            statusCode: 403,
            details,
        });

        // Also log as error for immediate attention
        logger.error('SUSPICIOUS ACTIVITY DETECTED', {
            userId,
            ipAddress,
            userAgent,
            path,
            method,
            details,
        });
    }

    /**
     * Log rate limit exceeded
     */
    async logRateLimitExceeded({ userId, email, ipAddress, userAgent, path, method }) {
        await this.log({
            userId,
            email,
            action: 'SECURITY_RATE_LIMIT_EXCEEDED',
            ipAddress,
            userAgent,
            method,
            path,
            status: 'warning',
            statusCode: 429,
        });
    }

    /**
     * Log unauthorized access attempt
     */
    async logUnauthorizedAccess({ userId, ipAddress, userAgent, path, method, resourceType, resourceId }) {
        await this.log({
            userId,
            action: 'SECURITY_UNAUTHORIZED_ACCESS',
            resourceType,
            resourceId,
            ipAddress,
            userAgent,
            method,
            path,
            status: 'failure',
            statusCode: 403,
        });
    }

    /**
     * Log sensitive resource access
     */
    async logResourceAccess({ userId, action, resourceType, resourceId, ipAddress, userAgent, path, method, success }) {
        await this.log({
            userId,
            action,
            resourceType,
            resourceId,
            ipAddress,
            userAgent,
            method,
            path,
            status: success ? 'success' : 'failure',
            statusCode: success ? 200 : 400,
        });
    }

    /**
     * Get failed login attempts for a user/IP
     */
    async getFailedLoginAttempts(email, ipAddress, timeWindow = 15 * 60 * 1000) {
        const since = new Date(Date.now() - timeWindow);
        
        const query = {
            action: 'AUTH_LOGIN_FAILED',
            timestamp: { $gte: since },
        };

        if (email) {
            query.email = email;
        }
        
        if (ipAddress) {
            query.ipAddress = ipAddress;
        }

        return await AuditLog.countDocuments(query);
    }

    /**
     * Get suspicious activity count for an IP
     */
    async getSuspiciousActivityCount(ipAddress, timeWindow = 60 * 60 * 1000) {
        const since = new Date(Date.now() - timeWindow);
        
        return await AuditLog.countDocuments({
            ipAddress,
            action: { $in: ['SECURITY_SUSPICIOUS_ACTIVITY', 'SECURITY_XSS_ATTEMPT', 'SECURITY_SQL_INJECTION_ATTEMPT'] },
            timestamp: { $gte: since },
        });
    }

    /**
     * Get audit logs with filters
     */
    async getAuditLogs(filters = {}, options = {}) {
        const {
            userId,
            email,
            action,
            status,
            ipAddress,
            startDate,
            endDate,
        } = filters;

        const {
            page = 1,
            limit = 50,
            sortBy = 'timestamp',
            sortOrder = 'desc',
        } = options;

        const query = {};

        if (userId) query.user = userId;
        if (email) query.email = email;
        if (action) query.action = action;
        if (status) query.status = status;
        if (ipAddress) query.ipAddress = ipAddress;

        if (startDate || endDate) {
            query.timestamp = {};
            if (startDate) query.timestamp.$gte = new Date(startDate);
            if (endDate) query.timestamp.$lte = new Date(endDate);
        }

        const skip = (page - 1) * limit;
        const sort = { [sortBy]: sortOrder === 'asc' ? 1 : -1 };

        const [logs, total] = await Promise.all([
            AuditLog.find(query)
                .sort(sort)
                .skip(skip)
                .limit(limit)
                .populate('user', 'email firstName lastName')
                .lean(),
            AuditLog.countDocuments(query),
        ]);

        return {
            logs,
            pagination: {
                page,
                limit,
                total,
                pages: Math.ceil(total / limit),
            },
        };
    }

    /**
     * Get security summary for a user
     */
    async getUserSecuritySummary(userId, days = 30) {
        const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

        const [
            totalActions,
            failedLogins,
            suspiciousActivities,
            recentIPs,
        ] = await Promise.all([
            AuditLog.countDocuments({ user: userId, timestamp: { $gte: since } }),
            AuditLog.countDocuments({ user: userId, action: 'AUTH_LOGIN_FAILED', timestamp: { $gte: since } }),
            AuditLog.countDocuments({ 
                user: userId, 
                action: { $regex: /^SECURITY_/ }, 
                timestamp: { $gte: since } 
            }),
            AuditLog.distinct('ipAddress', { user: userId, timestamp: { $gte: since } }),
        ]);

        return {
            totalActions,
            failedLogins,
            suspiciousActivities,
            uniqueIPs: recentIPs.length,
            recentIPs: recentIPs.slice(0, 10),
        };
    }
}

export default new AuditService();
