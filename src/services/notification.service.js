import notificationRepository from '../repositories/notification.repository.js';
import userRepository from '../repositories/user.repository.js';
import { emailQueue } from '../config/queue.config.js';
import logger from '../config/logger.js';

/**
 * NotificationService - Business logic for notification management
 * Handles notification creation, queuing, and delivery across multiple channels
 */
class NotificationService {
    /**
     * Notification templates for different event types
     */
    static templates = {
        bid_outbid: {
            title: 'You have been outbid!',
            message: (data) => `Your bid of $${data.amount} on "${data.auctionTitle}" has been outbid. Place a new bid to stay in the game!`
        },
        bid_won: {
            title: 'Congratulations! You won the auction',
            message: (data) => `You won the auction "${data.auctionTitle}" with a bid of $${data.amount}. Please proceed to payment.`
        },
        auction_ended: {
            title: 'Auction has ended',
            message: (data) => `The auction "${data.auctionTitle}" has ended. ${data.hasWinner ? `Winner: ${data.winnerName}` : 'No bids were placed.'}`
        },
        new_bid_received: {
            title: 'New bid on your auction',
            message: (data) => `Your auction "${data.auctionTitle}" received a new bid of $${data.amount}.`
        },
        payment_received: {
            title: 'Payment received',
            message: (data) => `Payment of $${data.amount} has been received for auction "${data.auctionTitle}".`
        },
        system: {
            title: 'System notification',
            message: (data) => data.message || 'You have a new notification.'
        }
    };

    /**
     * Create and queue a notification
     * @param {Object} notificationData - Notification data
     * @returns {Promise<Object>} - Created notification
     */
    async createNotification(notificationData) {
        try {
            // Validate user exists
            const user = await userRepository.findById(notificationData.user);
            if (!user) {
                throw new Error('User not found');
            }

            // Check user notification preferences
            const preferences = user.notificationPreferences || {};
            
            // Create notification
            const notification = await notificationRepository.create(notificationData);

            // Queue email if user has email notifications enabled
            if (preferences.email !== false && notificationData.channels?.email !== false) {
                await this.queueEmailNotification(notification, user);
            }

            logger.info(`Notification created: ${notification._id} for user: ${user._id}`);
            return notification;
        } catch (error) {
            logger.error('Error creating notification:', error.message);
            throw error;
        }
    }

    /**
     * Create notification from template
     * @param {string} userId - User ID
     * @param {string} type - Notification type
     * @param {Object} data - Template data
     * @param {string} priority - Notification priority
     * @returns {Promise<Object>} - Created notification
     */
    async createFromTemplate(userId, type, data, priority = 'medium') {
        try {
            const template = NotificationService.templates[type];
            if (!template) {
                throw new Error(`Invalid notification type: ${type}`);
            }

            const notificationData = {
                user: userId,
                type,
                title: template.title,
                message: typeof template.message === 'function' 
                    ? template.message(data) 
                    : template.message,
                data: {
                    auctionId: data.auctionId,
                    bidId: data.bidId,
                    amount: data.amount
                },
                priority,
                channels: {
                    email: { sent: false },
                    inApp: { read: false }
                }
            };

            return await this.createNotification(notificationData);
        } catch (error) {
            logger.error('Error creating notification from template:', error.message);
            throw error;
        }
    }

    /**
     * Queue email notification for delivery
     * @param {Object} notification - Notification object
     * @param {Object} user - User object
     * @returns {Promise<void>}
     */
    async queueEmailNotification(notification, user) {
        try {
            await emailQueue.add('send-email', {
                notificationId: notification._id.toString(),
                to: user.email,
                subject: notification.title,
                text: notification.message,
                html: this.generateEmailHTML(notification),
                priority: notification.priority
            }, {
                priority: notification.priority === 'high' ? 1 : notification.priority === 'medium' ? 5 : 10
            });

            logger.info(`Email queued for notification: ${notification._id}`);
        } catch (error) {
            logger.error('Error queuing email notification:', error.message);
            throw error;
        }
    }

    /**
     * Generate HTML content for email
     * @param {Object} notification - Notification object
     * @returns {string} - HTML content
     */
    generateEmailHTML(notification) {
        return `
            <!DOCTYPE html>
            <html>
            <head>
                <style>
                    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                    .header { background-color: #4CAF50; color: white; padding: 20px; text-align: center; }
                    .content { padding: 20px; background-color: #f9f9f9; }
                    .footer { padding: 20px; text-align: center; font-size: 12px; color: #666; }
                    .button { display: inline-block; padding: 10px 20px; background-color: #4CAF50; color: white; text-decoration: none; border-radius: 5px; }
                </style>
            </head>
            <body>
                <div class="container">
                    <div class="header">
                        <h1>${notification.title}</h1>
                    </div>
                    <div class="content">
                        <p>${notification.message}</p>
                        ${notification.data?.auctionId ? `<p><a href="${process.env.FRONTEND_URL}/auctions/${notification.data.auctionId}" class="button">View Auction</a></p>` : ''}
                    </div>
                    <div class="footer">
                        <p>This is an automated notification from AI Auction Platform.</p>
                        <p>To manage your notification preferences, visit your account settings.</p>
                    </div>
                </div>
            </body>
            </html>
        `;
    }

    /**
     * Get notifications for a user with pagination
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Object>} - Notifications and pagination info
     */
    async getUserNotifications(userId, options = {}) {
        try {
            return await notificationRepository.findByUser(userId, options);
        } catch (error) {
            logger.error('Error getting user notifications:', error.message);
            throw error;
        }
    }

    /**
     * Get unread notifications for a user
     * @param {string} userId - User ID
     * @param {Object} options - Query options
     * @returns {Promise<Array>} - Array of unread notifications
     */
    async getUnreadNotifications(userId, options = {}) {
        try {
            return await notificationRepository.findUnreadByUser(userId, options);
        } catch (error) {
            logger.error('Error getting unread notifications:', error.message);
            throw error;
        }
    }

    /**
     * Get unread notification count for a user
     * @param {string} userId - User ID
     * @returns {Promise<number>} - Count of unread notifications
     */
    async getUnreadCount(userId) {
        try {
            return await notificationRepository.countUnreadByUser(userId);
        } catch (error) {
            logger.error('Error getting unread count:', error.message);
            throw error;
        }
    }

    /**
     * Mark notification as read
     * @param {string} notificationId - Notification ID
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<Object>} - Updated notification
     */
    async markAsRead(notificationId, userId) {
        try {
            // Verify notification belongs to user
            const notification = await notificationRepository.findById(notificationId);
            if (!notification) {
                throw new Error('Notification not found');
            }

            if (notification.user.toString() !== userId.toString()) {
                throw new Error('Unauthorized to mark this notification as read');
            }

            return await notificationRepository.markAsRead(notificationId);
        } catch (error) {
            logger.error('Error marking notification as read:', error.message);
            throw error;
        }
    }

    /**
     * Mark all notifications as read for a user
     * @param {string} userId - User ID
     * @returns {Promise<Object>} - Update result
     */
    async markAllAsRead(userId) {
        try {
            return await notificationRepository.markAllAsReadForUser(userId);
        } catch (error) {
            logger.error('Error marking all notifications as read:', error.message);
            throw error;
        }
    }

    /**
     * Delete notification
     * @param {string} notificationId - Notification ID
     * @param {string} userId - User ID (for authorization)
     * @returns {Promise<Object>} - Deleted notification
     */
    async deleteNotification(notificationId, userId) {
        try {
            // Verify notification belongs to user
            const notification = await notificationRepository.findById(notificationId);
            if (!notification) {
                throw new Error('Notification not found');
            }

            if (notification.user.toString() !== userId.toString()) {
                throw new Error('Unauthorized to delete this notification');
            }

            return await notificationRepository.delete(notificationId);
        } catch (error) {
            logger.error('Error deleting notification:', error.message);
            throw error;
        }
    }

    /**
     * Update user notification preferences
     * @param {string} userId - User ID
     * @param {Object} preferences - Notification preferences
     * @returns {Promise<Object>} - Updated user
     */
    async updatePreferences(userId, preferences) {
        try {
            const user = await userRepository.findById(userId);
            if (!user) {
                throw new Error('User not found');
            }

            const updatedUser = await userRepository.update(userId, {
                notificationPreferences: {
                    ...user.notificationPreferences,
                    ...preferences
                }
            });

            logger.info(`Notification preferences updated for user: ${userId}`);
            return updatedUser;
        } catch (error) {
            logger.error('Error updating notification preferences:', error.message);
            throw error;
        }
    }

    /**
     * Process pending email notifications (called by queue processor)
     * @param {Object} job - Bull job object
     * @returns {Promise<void>}
     */
    async processEmailNotification(job) {
        const { notificationId, to, subject, text, html } = job.data;

        try {
            // Send email using nodemailer
            const emailConfig = (await import('../config/email.config.js')).default;
            
            await emailConfig.sendMail({
                from: process.env.EMAIL_FROM || 'noreply@aiauction.com',
                to,
                subject,
                text,
                html
            });

            // Mark email as sent
            await notificationRepository.markEmailSent(notificationId);

            logger.info(`Email sent for notification: ${notificationId}`);
        } catch (error) {
            logger.error(`Error sending email for notification ${notificationId}:`, error.message);
            throw error; // Will trigger retry
        }
    }
}

export default new NotificationService();