import logger from '../config/logger.js';
import { emitToAuctionRoom, emitToUser } from '../config/socket.config.js';
import prometheusMetrics from './prometheus-metrics.service.js';

/**
 * RealtimeService - Handles real-time event broadcasting via Socket.IO
 * Emits events for bids, auctions, and notifications
 */
class RealtimeService {
    constructor() {
        this.io = null;
    }

    /**
     * Set Socket.IO instance
     * @param {Object} ioInstance - Socket.IO server instance
     */
    setIO(ioInstance) {
        this.io = ioInstance;
        logger.info('RealtimeService initialized with Socket.IO instance');
    }

    /**
     * Get Socket.IO instance
     * @returns {Object|null} - Socket.IO instance or null
     */
    getIO() {
        return this.io;
    }

    /**
     * Emit new bid event to auction room
     * @param {string} auctionId - Auction ID
     * @param {Object} bidData - Bid data
     * @param {Object} auctionData - Updated auction data
     */
    emitNewBid(auctionId, bidData, auctionData) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit new bid event');
                return;
            }

            const eventData = {
                bid: {
                    id: bidData._id,
                    amount: bidData.amount,
                    bidder: {
                        id: bidData.bidder._id || bidData.bidder,
                        email: bidData.bidder.email,
                        name: bidData.bidder.profile?.firstName 
                            ? `${bidData.bidder.profile.firstName} ${bidData.bidder.profile.lastName || ''}`.trim()
                            : 'Anonymous'
                    },
                    timestamp: bidData.timestamp || bidData.createdAt,
                    status: bidData.status
                },
                auction: {
                    id: auctionData._id,
                    currentPrice: auctionData.pricing.currentPrice,
                    totalBids: auctionData.bidding.totalBids
                },
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'bid:new', eventData);
            
            // Track WebSocket message metric
            prometheusMetrics.trackWebSocketMessage('bid:new', 'outbound');
            
            logger.info(`New bid event emitted for auction ${auctionId}`);
        } catch (error) {
            logger.error('Error emitting new bid event:', error.message);
        }
    }

    /**
     * Emit bid status update event
     * @param {string} auctionId - Auction ID
     * @param {Object} bidData - Bid data with updated status
     */
    emitBidUpdate(auctionId, bidData) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit bid update event');
                return;
            }

            const eventData = {
                bid: {
                    id: bidData._id,
                    amount: bidData.amount,
                    bidder: bidData.bidder,
                    status: bidData.status,
                    timestamp: bidData.timestamp || bidData.createdAt
                },
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'bid:update', eventData);
            
            // Track WebSocket message metric
            prometheusMetrics.trackWebSocketMessage('bid:update', 'outbound');
            
            // Also emit to the specific bidder
            if (bidData.bidder) {
                const bidderId = bidData.bidder._id || bidData.bidder;
                emitToUser(this.io, bidderId.toString(), 'bid:status', eventData);
                prometheusMetrics.trackWebSocketMessage('bid:status', 'outbound');
            }
            
            logger.info(`Bid update event emitted for auction ${auctionId}`);
        } catch (error) {
            logger.error('Error emitting bid update event:', error.message);
        }
    }

    /**
     * Emit auction update event
     * @param {string} auctionId - Auction ID
     * @param {Object} auctionData - Updated auction data
     * @param {string} updateType - Type of update (price, status, details)
     */
    emitAuctionUpdate(auctionId, auctionData, updateType = 'details') {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit auction update event');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    status: auctionData.status,
                    pricing: auctionData.pricing,
                    bidding: auctionData.bidding,
                    timing: auctionData.timing
                },
                updateType,
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'auction:update', eventData);
            
            // Track WebSocket message metric
            prometheusMetrics.trackWebSocketMessage('auction:update', 'outbound');
            
            logger.info(`Auction update event emitted for auction ${auctionId} (type: ${updateType})`);
        } catch (error) {
            logger.error('Error emitting auction update event:', error.message);
        }
    }

    /**
     * Emit auction closed event
     * @param {string} auctionId - Auction ID
     * @param {Object} auctionData - Closed auction data
     * @param {Object} winnerData - Winner information (if any)
     */
    emitAuctionClosed(auctionId, auctionData, winnerData = null) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit auction closed event');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    status: auctionData.status,
                    finalPrice: auctionData.pricing.currentPrice,
                    totalBids: auctionData.bidding.totalBids
                },
                winner: winnerData ? {
                    hasWinner: winnerData.hasWinner,
                    userId: winnerData.winner,
                    finalPrice: winnerData.finalPrice
                } : null,
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'auction:closed', eventData);
            
            // Track WebSocket message metric
            prometheusMetrics.trackWebSocketMessage('auction:closed', 'outbound');
            
            // Emit to winner if exists
            if (winnerData && winnerData.hasWinner && winnerData.winner) {
                emitToUser(this.io, winnerData.winner.toString(), 'auction:won', {
                    auction: eventData.auction,
                    timestamp: eventData.timestamp
                });
                prometheusMetrics.trackWebSocketMessage('auction:won', 'outbound');
            }
            
            logger.info(`Auction closed event emitted for auction ${auctionId}`);
        } catch (error) {
            logger.error('Error emitting auction closed event:', error.message);
        }
    }

    /**
     * Emit outbid notification to user
     * @param {string} userId - User ID who was outbid
     * @param {Object} auctionData - Auction data
     * @param {Object} previousBidData - User's previous bid
     * @param {Object} newBidData - New highest bid
     */
    emitOutbidNotification(userId, auctionData, previousBidData, newBidData) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit outbid notification');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    currentPrice: auctionData.pricing.currentPrice
                },
                yourBid: {
                    id: previousBidData._id,
                    amount: previousBidData.amount
                },
                newBid: {
                    amount: newBidData.amount
                },
                message: 'You have been outbid',
                timestamp: new Date().toISOString()
            };

            emitToUser(this.io, userId.toString(), 'bid:outbid', eventData);
            
            logger.info(`Outbid notification emitted to user ${userId}`);
        } catch (error) {
            logger.error('Error emitting outbid notification:', error.message);
        }
    }

    /**
     * Emit new bid notification to seller
     * @param {string} sellerId - Seller user ID
     * @param {Object} auctionData - Auction data
     * @param {Object} bidData - New bid data
     */
    emitNewBidToSeller(sellerId, auctionData, bidData) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit new bid to seller');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    currentPrice: auctionData.pricing.currentPrice,
                    totalBids: auctionData.bidding.totalBids
                },
                bid: {
                    id: bidData._id,
                    amount: bidData.amount,
                    timestamp: bidData.timestamp || bidData.createdAt
                },
                message: 'New bid received on your auction',
                timestamp: new Date().toISOString()
            };

            emitToUser(this.io, sellerId.toString(), 'auction:newBid', eventData);
            
            logger.info(`New bid notification emitted to seller ${sellerId}`);
        } catch (error) {
            logger.error('Error emitting new bid to seller:', error.message);
        }
    }

    /**
     * Emit auction starting soon notification
     * @param {string} auctionId - Auction ID
     * @param {Object} auctionData - Auction data
     */
    emitAuctionStartingSoon(auctionId, auctionData) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit auction starting soon');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    startTime: auctionData.timing.startTime
                },
                message: 'Auction starting soon',
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'auction:startingSoon', eventData);
            
            logger.info(`Auction starting soon event emitted for auction ${auctionId}`);
        } catch (error) {
            logger.error('Error emitting auction starting soon event:', error.message);
        }
    }

    /**
     * Emit auction ending soon notification
     * @param {string} auctionId - Auction ID
     * @param {Object} auctionData - Auction data
     * @param {number} minutesRemaining - Minutes until auction ends
     */
    emitAuctionEndingSoon(auctionId, auctionData, minutesRemaining) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit auction ending soon');
                return;
            }

            const eventData = {
                auction: {
                    id: auctionData._id,
                    title: auctionData.title,
                    endTime: auctionData.timing.endTime,
                    currentPrice: auctionData.pricing.currentPrice
                },
                minutesRemaining,
                message: `Auction ending in ${minutesRemaining} minutes`,
                timestamp: new Date().toISOString()
            };

            emitToAuctionRoom(this.io, auctionId, 'auction:endingSoon', eventData);
            
            logger.info(`Auction ending soon event emitted for auction ${auctionId}`);
        } catch (error) {
            logger.error('Error emitting auction ending soon event:', error.message);
        }
    }

    /**
     * Emit notification to user
     * @param {string} userId - User ID
     * @param {Object} notification - Notification object
     */
    emitNotification(userId, notification) {
        try {
            if (!this.io) {
                logger.warn('Socket.IO not initialized, cannot emit notification');
                return;
            }

            const eventData = {
                notification: {
                    id: notification._id,
                    type: notification.type,
                    title: notification.title,
                    message: notification.message,
                    data: notification.data,
                    priority: notification.priority,
                    createdAt: notification.createdAt
                },
                timestamp: new Date().toISOString()
            };

            emitToUser(this.io, userId.toString(), 'notification:new', eventData);
            
            // Track WebSocket message metric
            prometheusMetrics.trackWebSocketMessage('notification:new', 'outbound');
            
            logger.info(`Notification emitted to user ${userId}`);
        } catch (error) {
            logger.error('Error emitting notification:', error.message);
        }
    }

    /**
     * Check if Socket.IO is initialized
     * @returns {boolean} - True if initialized
     */
    isInitialized() {
        return this.io !== null;
    }
}

export default new RealtimeService();
