import auctionRepository from '../repositories/auction.repository.js';
import bidRepository from '../repositories/bid.repository.js';
import realtimeService from '../services/realtime.service.js';
import logger from '../config/logger.js';

/**
 * AI Webhook Controller
 * Handles incoming webhooks from AI module
 */

/**
 * Handle price prediction update from AI module
 * POST /api/v1/webhooks/ai/prediction-update
 */
export const handlePredictionUpdate = async (req, res) => {
    try {
        const { auctionId, predictedPrice, confidence, priceRange, timestamp } = req.body;

        // Validate required fields
        if (!auctionId || predictedPrice === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Missing required fields: auctionId, predictedPrice'
                }
            });
        }

        // Find auction
        const auction = await auctionRepository.findById(auctionId);
        if (!auction) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'AUCTION_NOT_FOUND',
                    message: `Auction ${auctionId} not found`
                }
            });
        }

        // Update auction with AI insights
        const updatedAuction = await auctionRepository.update(auctionId, {
            aiInsights: {
                predictedPrice,
                priceRange: priceRange || { min: 0, max: 0 },
                confidence: confidence || 0,
                lastUpdated: timestamp ? new Date(timestamp) : new Date()
            }
        });

        logger.info(`Price prediction updated for auction ${auctionId}: ${predictedPrice}`);

        // Emit real-time update if auction is active
        if (auction.status === 'active' && realtimeService.isInitialized()) {
            realtimeService.emitAuctionUpdate(auctionId, updatedAuction, 'ai-insights');
        }

        res.status(200).json({
            success: true,
            message: 'Price prediction updated successfully',
            data: {
                auctionId,
                aiInsights: updatedAuction.aiInsights
            }
        });
    } catch (error) {
        logger.error('Error handling prediction update webhook:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to process prediction update'
            }
        });
    }
};

/**
 * Handle fraud alert from AI module
 * POST /api/v1/webhooks/ai/fraud-alert
 */
export const handleFraudAlert = async (req, res) => {
    try {
        const { bidId, riskScore, reasons, recommendedAction, timestamp } = req.body;

        // Validate required fields
        if (!bidId || riskScore === undefined) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Missing required fields: bidId, riskScore'
                }
            });
        }

        // Find bid
        const bid = await bidRepository.findById(bidId);
        if (!bid) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'BID_NOT_FOUND',
                    message: `Bid ${bidId} not found`
                }
            });
        }

        // Determine if bid should be flagged (risk score > 0.7)
        const isFlagged = riskScore > 0.7;

        // Update bid with fraud analysis
        const updatedBid = await bidRepository.update(bidId, {
            fraudAnalysis: {
                riskScore,
                isFlagged,
                reasons: reasons || [],
                analyzedAt: timestamp ? new Date(timestamp) : new Date()
            }
        });

        logger.warn(`Fraud alert received for bid ${bidId}: risk=${riskScore}, flagged=${isFlagged}`);

        // If high risk, emit alert to admins
        if (isFlagged && realtimeService.isInitialized()) {
            realtimeService.emitFraudAlert(bid.auction, updatedBid, {
                riskScore,
                reasons,
                recommendedAction: recommendedAction || 'REVIEW_REQUIRED'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Fraud alert processed successfully',
            data: {
                bidId,
                riskScore,
                isFlagged,
                recommendedAction: recommendedAction || 'REVIEW_REQUIRED'
            }
        });
    } catch (error) {
        logger.error('Error handling fraud alert webhook:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to process fraud alert'
            }
        });
    }
};

/**
 * Handle general AI insights from AI module
 * POST /api/v1/webhooks/ai/insights
 */
export const handleInsights = async (req, res) => {
    try {
        const { type, entityId, insights, timestamp } = req.body;

        // Validate required fields
        if (!type || !entityId || !insights) {
            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Missing required fields: type, entityId, insights'
                }
            });
        }

        let updated = false;

        // Handle different insight types
        switch (type) {
            case 'auction':
                // Update auction with insights
                const auction = await auctionRepository.findById(entityId);
                if (auction) {
                    await auctionRepository.update(entityId, {
                        'aiInsights.additionalInsights': insights,
                        'aiInsights.lastUpdated': timestamp ? new Date(timestamp) : new Date()
                    });
                    updated = true;
                    logger.info(`AI insights updated for auction ${entityId}`);
                }
                break;

            case 'bid':
                // Update bid with insights
                const bid = await bidRepository.findById(entityId);
                if (bid) {
                    await bidRepository.update(entityId, {
                        'fraudAnalysis.additionalInsights': insights,
                        'fraudAnalysis.analyzedAt': timestamp ? new Date(timestamp) : new Date()
                    });
                    updated = true;
                    logger.info(`AI insights updated for bid ${entityId}`);
                }
                break;

            case 'user':
                // Could update user insights if needed
                logger.info(`User insights received for ${entityId}`);
                updated = true;
                break;

            default:
                return res.status(400).json({
                    success: false,
                    error: {
                        code: 'INVALID_INSIGHT_TYPE',
                        message: `Invalid insight type: ${type}`
                    }
                });
        }

        if (!updated) {
            return res.status(404).json({
                success: false,
                error: {
                    code: 'ENTITY_NOT_FOUND',
                    message: `${type} ${entityId} not found`
                }
            });
        }

        res.status(200).json({
            success: true,
            message: 'AI insights processed successfully',
            data: {
                type,
                entityId,
                timestamp: timestamp || new Date().toISOString()
            }
        });
    } catch (error) {
        logger.error('Error handling insights webhook:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Failed to process AI insights'
            }
        });
    }
};
