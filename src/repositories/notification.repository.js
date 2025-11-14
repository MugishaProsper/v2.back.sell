import Notification from '../models/notification.model.js';
import logger from '../config/logger.js';

/**
 * NotificationRepository - Data access layer for Notification entity
 * Handles all database operations for notifications with query optimization
 */
class NotificationRepository {
    /**
     * Create a new notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Object>} - Created notification
     */
    async create(notificationData) {
        try {
            const notification = new Notification(notificationData);
            await notification.save();
            logger.info(`Notification created for user: ${notification.user}`);
            return notification;
        } catch (error) {
            logger.error('Error creating notification:', error.message);
            throw error;
        }
    }

    /**
     * Find notification by ID
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object|null>} - Notification or null
     */
    async findById(notificationId) {
        try {
            const notification = await Notification.findById(notificationId).lean();
            return notification;
        } catch (error) {
            logger.error(`Error finding notification by ID ${notificationId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find all notifications for a user with pagination
     * @param {string} userId - User ID
     * @param {Object} options - Query options (page, limit, type, sort)
     * @returns {Promise<Object>} - Notifications and pagination info
     */
    async findByUser(userId, options = {}) {
        try {
            const page = options.page || 1;
            const limit = options.limit || 20;
            const skip = (page - 1) * limit;

            const filter = { user: userId };
            
            // Filter by type if specified
            if (options.type) {
                filter.type = options.type;
            }

            const [notifications, total] = await Promise.all([
                Notification.find(filter)
                    .sort(options.sort || { createdAt: -1 })
                    .skip(skip)
                    .limit(limit)
                    .lean(),
                Notification.countDocuments(filter)
            ]);

            return {
                notifications,
                pagination: {
                    page,
                    limit,
                    total,
                    pages: Math.ceil(total / limit)
                }
            };
        } catch (error) {
            logger.error(`Error finding notifications for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find unread notifications for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options (limit, sort)
     * @returns {Promise<Array>} - Array of unread notifications
     */
    async findUnreadByUser(userId, options = {}) {
        try {
            const query = Notification.find({
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

            const notifications = await query.lean();
            return notifications;
        } catch (error) {
            logger.error(`Error finding unread notifications for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Count unread notifications for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} - Count of unread notifications
     */
    async countUnreadByUser(userId) {
        try {
            const count = await Notification.countDocuments({
                user: userId,
                'channels.inApp.read': false
            });
            return count;
        } catch (error) {
            logger.error(`Error counting unread notifications for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object|null>} - Updated notification or null
     */
    async markAsRead(notificationId) {
        try {
            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                {
                    $set: {
                        'channels.inApp.read': true,
                        'channels.inApp.readAt': new Date()
                    }
                },
                { new: true }
            ).lean();

            if (notification) {
                logger.info(`Notification marked as read: ${notificationId}`);
            }

            return notification;
        } catch (error) {
            logger.error(`Error marking notification as read ${notificationId}:`, error.message);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Update result
     */
    async markAllAsReadForUser(userId) {
        try {
            const result = await Notification.updateMany(
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

            logger.info(`Marked ${result.modifiedCount} notifications as read for user: ${userId}`);
            return result;
        } catch (error) {
            logger.error(`Error marking all notifications as read for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Mark email as sent for a notification
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object|null>} - Updated notification or null
     */
    async markEmailSent(notificationId) {
        try {
            const notification = await Notification.findByIdAndUpdate(
                notificationId,
                {
                    $set: {
                        'channels.email.sent': true,
                        'channels.email.sentAt': new Date()
                    }
                },
                { new: true }
            ).lean();

            if (notification) {
                logger.info(`Email marked as sent for notification: ${notificationId}`);
            }

            return notification;
        } catch (error) {
            logger.error(`Error marking email as sent ${notificationId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete notification by ID
     * @param {string} notificationId - Notification ID
     * @returns {Promise<Object|null>} - Deleted notification or null
     */
    async delete(notificationId) {
        try {
            const notification = await Notification.findByIdAndDelete(notificationId).lean();

            if (notification) {
                logger.info(`Notification deleted: ${notificationId}`);
            }

            return notification;
        } catch (error) {
            logger.error(`Error deleting notification ${notificationId}:`, error.message);
            throw error;
        }
    }

    /**
     * Delete all notifications for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Delete result
     */
    async deleteAllForUser(userId) {
        try {
            const result = await Notification.deleteMany({ user: userId });
            logger.info(`Deleted ${result.deletedCount} notifications for user: ${userId}`);
            return result;
        } catch (error) {
            logger.error(`Error deleting notifications for user ${userId}:`, error.message);
            throw error;
        }
    }

    /**
     * Find notifications pending email delivery
     * @param {number} limit - Maximum number of notifications to fetch
     * @returns {Promise<Array>} - Array of notifications
     */
    async findPendingEmailNotifications(limit = 100) {
        try {
            const notifications = await Notification.find({
                'channels.email.sent': false
            })
                .limit(limit)
                .lean();

            return notifications;
        } catch (error) {
            logger.error('Error finding pending email notifications:', error.message);
            throw error;
        }
    }

    /**
     * Cleanup old notifications (TTL-based cleanup is automatic, this is for manual cleanup)
     * @param {number} daysOld - Delete notifications older than this many days
     * @returns {Promise<Object>} - Delete result
     */
    async cleanupOldNotifications(daysOld = 90) {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - daysOld);

            const result = await Notification.deleteMany({
                createdAt: { $lt: cutoffDate }
            });

            logger.info(`Cleaned up ${result.deletedCount} old notifications (older than ${daysOld} days)`);
            return result;
        } catch (error) {
            logger.error('Error cleaning up old notifications:', error.message);
            throw error;
        }
    }

    /**
     * Get notification statistics for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Notification statistics
     */
    async getUserNotificationStats(userId) {
        try {
            const stats = await Notification.aggregate([
                { $match: { user: mongoose.Types.ObjectId(userId) } },
                {
                    $group: {
                        _id: null,
                        total: { $sum: 1 },
                        unread: {
                            $sum: {
                                $cond: [{ $eq: ['$channels.inApp.read', false] }, 1, 0]
                            }
                        },
                        byType: {
                            $push: '$type'
                        }
                    }
                }
            ]);

            return stats[0] || { total: 0, unread: 0, byType: [] };
        } catch (error) {
            logger.error(`Error getting notification stats for user ${userId}:`, error.message);
            throw error;
        }
    }
}

export default new NotificationRepository();
