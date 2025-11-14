import notificationService from './notification.service.js';
import realtimeService from './realtime.service.js';
import logger from '../config/logger.js';

/**
 * NotificationEventService - Handles notification triggers for auction events
 * Integrates with auction, bid, and payment events to send notifications
 */
class NotificationEventService {
    /**
     * Notify user when they are outbid
     * @param {string} userId - User ID of the outbid user
     * @param {Object} auction - Auction object
     * @param {Object} oldBid - Previous bid object
     * @param {Object} newBid - New bid object
     * @returns {Promise<void>}
     */
    async notifyUserOutbid(userId, auction, oldBid, newBid) {
        try {
            const notification = await notificationService.createFromTemplate(
                userId,
                'bid_outbid',
                {
                    auctionId: auction._id,
                    auctionTitle: auction.title,
                    amount: oldBid.amount,
                    bidId: oldBid._id
                },
                'high' // High priority for outbid notifications
            );

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(userId, notification);
            }

            logger.info(`Outbid notification sent to user: ${userId}`);
        } catch (error) {
            logger.error('Error sending outbid notification:', error.message);
            // Don't throw - notification failure shouldn't break the bid flow
        }
    }

    /**
     * Notify seller when they receive a new bid
     * @param {string} sellerId - Seller user ID
     * @param {Object} auction - Auction object
     * @param {Object} bid - New bid object
     * @returns {Promise<void>}
     */
    async notifySellerNewBid(sellerId, auction, bid) {
        try {
            const notification = await notificationService.createFromTemplate(
                sellerId,
                'new_bid_received',
                {
                    auctionId: auction._id,
                    auctionTitle: auction.title,
                    amount: bid.amount,
                    bidId: bid._id
                },
                'medium'
            );

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(sellerId, notification);
            }

            logger.info(`New bid notification sent to seller: ${sellerId}`);
        } catch (error) {
            logger.error('Error sending new bid notification to seller:', error.message);
        }
    }

    /**
     * Notify winner when auction ends
     * @param {string} winnerId - Winner user ID
     * @param {Object} auction - Auction object
     * @param {Object} winningBid - Winning bid object
     * @returns {Promise<void>}
     */
    async notifyAuctionWinner(winnerId, auction, winningBid) {
        try {
            const notification = await notificationService.createFromTemplate(
                winnerId,
                'bid_won',
                {
                    auctionId: auction._id,
                    auctionTitle: auction.title,
                    amount: winningBid.amount,
                    bidId: winningBid._id
                },
                'high'
            );

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(winnerId, notification);
            }

            logger.info(`Auction won notification sent to winner: ${winnerId}`);
        } catch (error) {
            logger.error('Error sending auction won notification:', error.message);
        }
    }

    /**
     * Notify seller when auction ends
     * @param {string} sellerId - Seller user ID
     * @param {Object} auction - Auction object
     * @param {Object} winner - Winner info (if any)
     * @returns {Promise<void>}
     */
    async notifySellerAuctionEnded(sellerId, auction, winner = null) {
        try {
            const notification = await notificationService.createFromTemplate(
                sellerId,
                'auction_ended',
                {
                    auctionId: auction._id,
                    auctionTitle: auction.title,
                    hasWinner: !!winner,
                    winnerName: winner ? winner.name : null,
                    amount: winner ? winner.amount : null
                },
                'medium'
            );

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(sellerId, notification);
            }

            logger.info(`Auction ended notification sent to seller: ${sellerId}`);
        } catch (error) {
            logger.error('Error sending auction ended notification to seller:', error.message);
        }
    }

    /**
     * Notify all bidders when auction ends (except winner)
     * @param {Array} bidderIds - Array of bidder user IDs
     * @param {Object} auction - Auction object
     * @param {string} winnerId - Winner user ID (to exclude)
     * @returns {Promise<void>}
     */
    async notifyBiddersAuctionEnded(bidderIds, auction, winnerId = null) {
        try {
            const notificationPromises = bidderIds
                .filter(bidderId => !winnerId || bidderId.toString() !== winnerId.toString())
                .map(bidderId => 
                    notificationService.createFromTemplate(
                        bidderId,
                        'auction_ended',
                        {
                            auctionId: auction._id,
                            auctionTitle: auction.title,
                            hasWinner: !!winnerId,
                            winnerName: null // Don't reveal winner name to other bidders
                        },
                        'low'
                    ).then(notification => {
                        // Emit real-time notification
                        if (realtimeService.isInitialized()) {
                            realtimeService.emitNotification(bidderId, notification);
                        }
                        return notification;
                    }).catch(error => {
                        logger.error(`Error sending auction ended notification to bidder ${bidderId}:`, error.message);
                    })
                );

            await Promise.allSettled(notificationPromises);
            logger.info(`Auction ended notifications sent to ${bidderIds.length} bidders`);
        } catch (error) {
            logger.error('Error sending auction ended notifications to bidders:', error.message);
        }
    }

    /**
     * Notify seller when payment is received
     * @param {string} sellerId - Seller user ID
     * @param {Object} auction - Auction object
     * @param {Object} payment - Payment object
     * @returns {Promise<void>}
     */
    async notifyPaymentReceived(sellerId, auction, payment) {
        try {
            const notification = await notificationService.createFromTemplate(
                sellerId,
                'payment_received',
                {
                    auctionId: auction._id,
                    auctionTitle: auction.title,
                    amount: payment.amount
                },
                'high'
            );

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(sellerId, notification);
            }

            logger.info(`Payment received notification sent to seller: ${sellerId}`);
        } catch (error) {
            logger.error('Error sending payment received notification:', error.message);
        }
    }

    /**
     * Send system notification to a user
     * @param {string} userId - User ID
     * @param {string} title - Notification title
     * @param {string} message - Notification message
     * @param {string} priority - Notification priority
     * @returns {Promise<void>}
     */
    async sendSystemNotification(userId, title, message, priority = 'medium') {
        try {
            const notification = await notificationService.createNotification({
                user: userId,
                type: 'system',
                title,
                message,
                data: {},
                priority,
                channels: {
                    email: { sent: false },
                    inApp: { read: false }
                }
            });

            // Emit real-time notification via Socket.IO
            if (realtimeService.isInitialized()) {
                realtimeService.emitNotification(userId, notification);
            }

            logger.info(`System notification sent to user: ${userId}`);
        } catch (error) {
            logger.error('Error sending system notification:', error.message);
        }
    }
}

export default new NotificationEventService();
