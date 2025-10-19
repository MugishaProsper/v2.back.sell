import mongoose from 'mongoose';

const auditLogSchema = new mongoose.Schema({
    // User who performed the action
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false, // Some actions may not have a user (e.g., failed login)
    },
    
    // Email for tracking (especially for failed auth attempts)
    email: {
        type: String,
        trim: true,
    },
    
    // Action type
    action: {
        type: String,
        required: true,
        enum: [
            // Authentication actions
            'AUTH_LOGIN_SUCCESS',
            'AUTH_LOGIN_FAILED',
            'AUTH_LOGOUT',
            'AUTH_REGISTER',
            'AUTH_TOKEN_REFRESH',
            'AUTH_PASSWORD_RESET',
            
            // User actions
            'USER_UPDATE',
            'USER_DELETE',
            'USER_PROFILE_VIEW',
            
            // Auction actions
            'AUCTION_CREATE',
            'AUCTION_UPDATE',
            'AUCTION_DELETE',
            'AUCTION_VIEW',
            
            // Bid actions
            'BID_PLACE',
            'BID_RETRACT',
            
            // Payment actions
            'PAYMENT_INITIATE',
            'PAYMENT_COMPLETE',
            'PAYMENT_FAILED',
            'PAYMENT_REFUND',
            
            // Security events
            'SECURITY_SUSPICIOUS_ACTIVITY',
            'SECURITY_RATE_LIMIT_EXCEEDED',
            'SECURITY_UNAUTHORIZED_ACCESS',
            'SECURITY_CSRF_VIOLATION',
            'SECURITY_XSS_ATTEMPT',
            'SECURITY_SQL_INJECTION_ATTEMPT',
            
            // Admin actions
            'ADMIN_USER_BAN',
            'ADMIN_USER_UNBAN',
            'ADMIN_AUCTION_REMOVE',
        ],
    },
    
    // Resource type and ID
    resourceType: {
        type: String,
        enum: ['user', 'auction', 'bid', 'payment', 'notification', 'system'],
    },
    
    resourceId: {
        type: mongoose.Schema.Types.ObjectId,
    },
    
    // Request details
    ipAddress: {
        type: String,
        required: true,
    },
    
    userAgent: {
        type: String,
    },
    
    method: {
        type: String,
        enum: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    },
    
    path: {
        type: String,
    },
    
    // Status and result
    status: {
        type: String,
        enum: ['success', 'failure', 'warning'],
        required: true,
    },
    
    statusCode: {
        type: Number,
    },
    
    // Additional details
    details: {
        type: mongoose.Schema.Types.Mixed,
    },
    
    // Error information (for failed actions)
    error: {
        code: String,
        message: String,
    },
    
    // Metadata
    metadata: {
        duration: Number, // Request duration in ms
        location: String, // Geolocation if available
        device: String, // Device type
    },
    
    // Timestamp
    timestamp: {
        type: Date,
        default: Date.now,
        required: true,
    },
}, {
    timestamps: false, // We use custom timestamp field
});

// Indexes for efficient querying
auditLogSchema.index({ user: 1, timestamp: -1 });
auditLogSchema.index({ email: 1, timestamp: -1 });
auditLogSchema.index({ action: 1, timestamp: -1 });
auditLogSchema.index({ status: 1, timestamp: -1 });
auditLogSchema.index({ ipAddress: 1, timestamp: -1 });
auditLogSchema.index({ resourceType: 1, resourceId: 1 });
auditLogSchema.index({ timestamp: -1 }); // For time-based queries

// TTL index - automatically delete logs older than 90 days
auditLogSchema.index({ timestamp: 1 }, { expireAfterSeconds: 7776000 }); // 90 days

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

export default AuditLog;
