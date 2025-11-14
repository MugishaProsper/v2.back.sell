import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'User is required'],
        index: true
    },
    type: {
        type: String,
        enum: {
            values: ['bid_outbid', 'bid_won', 'auction_ended', 'payment_received', 'system'],
            message: '{VALUE} is not a valid notification type'
        },
        required: [true, 'Notification type is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    message: {
        type: String,
        required: [true, 'Message is required'],
        trim: true,
        maxlength: [1000, 'Message cannot exceed 1000 characters']
    },
    data: {
        auctionId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Auction'
        },
        bidId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bid'
        },
        amount: {
            type: Number,
            min: 0
        }
    },
    channels: {
        email: {
            sent: {
                type: Boolean,
                default: false
            },
            sentAt: {
                type: Date
            }
        },
        inApp: {
            read: {
                type: Boolean,
                default: false
            },
            readAt: {
                type: Date
            }
        }
    },
    priority: {
        type: String,
        enum: {
            values: ['low', 'medium', 'high'],
            message: '{VALUE} is not a valid priority level'
        },
        default: 'medium'
    },
    createdAt: {
        type: Date,
        default: Date.now,
        index: true
    }
}, {
    timestamps: false // Using custom createdAt field
});

// Indexes
notificationSchema.index({ user: 1 });
notificationSchema.index({ type: 1 });
// Compound index for user and in-app read status
notificationSchema.index({ user: 1, 'channels.inApp.read': 1 });
// TTL index - automatically delete notifications after 90 days
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 7776000 }); // 90 days = 90 * 24 * 60 * 60

// Instance method to mark notification as read
notificationSchema.methods.markAsRead = async function() {
    this.channels.inApp.read = true;
    this.channels.inApp.readAt = new Date();
    return await this.save();
};

// Instance method to mark email as sent
notificationSchema.methods.markEmailSent = async function() {
    this.channels.email.sent = true;
    this.channels.email.sentAt = new Date();
    return await this.save();
};

// Instance method to check if notification is unread
notificationSchema.methods.isUnread = function() {
    return !this.channels.inApp.read;
};

// Static method to find unread notifications for a user
notificationSchema.statics.findUnreadByUser = function(userId, options = {}) {
    const query = this.find({
        user: userId,
        'channels.inApp.read': false
    });
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ createdAt: -1 });
    }
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    return query;
};

// Static method to find all notifications for a user with pagination
notificationSchema.statics.findByUser = function(userId, options = {}) {
    const query = this.find({ user: userId });
    
    if (options.type) {
        query.where('type').equals(options.type);
    }
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ createdAt: -1 });
    }
    
    if (options.skip) {
        query.skip(options.skip);
    }
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    return query;
};

// Static method to count unread notifications for a user
notificationSchema.statics.countUnreadByUser = function(userId) {
    return this.countDocuments({
        user: userId,
        'channels.inApp.read': false
    });
};

// Static method to mark all notifications as read for a user
notificationSchema.statics.markAllAsReadForUser = async function(userId) {
    return await this.updateMany(
        {
            user: userId,
            'channels.inApp.read': false
        },
        {
            $set: {
                'channels.inApp.read': true,
                'channels.inApp.readAt': new Date()
            }
        }
    );
};

const Notification = mongoose.model('Notification', notificationSchema);

export default Notification;
