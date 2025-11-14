import logger from '../config/logger.js';

/**
 * Mock AI Service for Development
 * Provides mock implementations of AI features when AI module is unavailable
 */
class MockAIService {
    /**
     * Mock price prediction for auctions
     * @param {object} auctionData - Auction data
     * @returns {object} Price prediction
     */
    predictPrice(auctionData) {
        const { startingPrice, category, title, description } = auctionData;
        
        // Simple mock logic: predict 1.3x to 2x starting price based on category
        const categoryMultipliers = {
            'electronics': 1.8,
            'art': 2.0,
            'collectibles': 1.9,
            'jewelry': 1.7,
            'vehicles': 1.5,
            'real-estate': 1.4,
            'furniture': 1.3,
            'default': 1.5
        };
        
        const multiplier = categoryMultipliers[category?.toLowerCase()] || categoryMultipliers.default;
        const predictedPrice = startingPrice * multiplier;
        const variance = startingPrice * 0.3;
        
        const prediction = {
            predictedPrice: Math.round(predictedPrice * 100) / 100,
            confidence: 0.75 + Math.random() * 0.15, // 0.75 - 0.90
            priceRange: {
                min: Math.round((predictedPrice - variance) * 100) / 100,
                max: Math.round((predictedPrice + variance) * 100) / 100
            },
            factors: [
                'Historical category performance',
                'Starting price analysis',
                'Market trends'
            ],
            timestamp: new Date().toISOString()
        };
        
        logger.debug(`Mock price prediction for auction: ${prediction.predictedPrice}`);
        return prediction;
    }

    /**
     * Mock fraud detection for bids
     * @param {object} bidData - Bid data
     * @returns {object} Fraud analysis
     */
    detectFraud(bidData) {
        const { amount, userId, auctionId, userHistory } = bidData;
        
        // Simple mock logic: flag as suspicious if bid is unusually high
        const averageBid = userHistory?.averageBidAmount || 100;
        const bidRatio = amount / averageBid;
        
        let riskScore = 0;
        const reasons = [];
        
        // Check for unusual bid patterns
        if (bidRatio > 10) {
            riskScore += 0.4;
            reasons.push('Bid amount significantly higher than user average');
        }
        
        if (userHistory?.suspiciousActivities > 0) {
            riskScore += 0.3;
            reasons.push('User has previous suspicious activities');
        }
        
        // Add some randomness for realism (but keep it low)
        riskScore += Math.random() * 0.1;
        
        const isFraudulent = riskScore > 0.7;
        
        const analysis = {
            bidId: bidData.bidId,
            riskScore: Math.round(riskScore * 100) / 100,
            isFraudulent,
            reasons,
            confidence: 0.80 + Math.random() * 0.15, // 0.80 - 0.95
            recommendedAction: isFraudulent ? 'REVIEW_REQUIRED' : 'APPROVE',
            analyzedAt: new Date().toISOString()
        };
        
        logger.debug(`Mock fraud detection for bid ${bidData.bidId}: risk=${analysis.riskScore}`);
        return analysis;
    }

    /**
     * Mock personalized recommendations
     * @param {object} userData - User data
     * @param {array} availableAuctions - Available auctions to recommend from
     * @returns {object} Recommendations
     */
    getRecommendations(userData, availableAuctions = []) {
        const { userId, bidHistory, interests, recentViews } = userData;
        
        // Simple mock logic: recommend random auctions with scores
        const numRecommendations = Math.min(10, availableAuctions.length);
        const auctionIds = [];
        const scores = [];
        
        if (availableAuctions.length > 0) {
            // Shuffle and take first N auctions
            const shuffled = [...availableAuctions].sort(() => Math.random() - 0.5);
            
            for (let i = 0; i < numRecommendations; i++) {
                const auction = shuffled[i];
                const score = 0.6 + Math.random() * 0.4; // 0.6 - 1.0
                auctionIds.push(auction._id || auction.id);
                scores.push(Math.round(score * 100) / 100);
            }
        } else {
            // Generate mock auction IDs if no auctions provided
            for (let i = 0; i < 5; i++) {
                auctionIds.push(`mock-auction-${i + 1}`);
                scores.push(Math.round((0.6 + Math.random() * 0.4) * 100) / 100);
            }
        }
        
        const result = {
            auctions: auctionIds,
            scores,
            userId,
            generatedAt: new Date().toISOString(),
            algorithm: 'mock-collaborative-filtering'
        };
        
        logger.debug(`Mock recommendations generated for user ${userId}: ${auctionIds.length} items`);
        return result;
    }

    /**
     * Mock bid pattern analysis
     * @param {object} auctionData - Auction with bid history
     * @returns {object} Pattern analysis
     */
    analyzeBidPatterns(auctionData) {
        const { auctionId, bids } = auctionData;
        
        const analysis = {
            auctionId,
            totalBids: bids?.length || 0,
            uniqueBidders: new Set(bids?.map(b => b.bidderId) || []).size,
            bidVelocity: 'NORMAL', // SLOW, NORMAL, HIGH
            suspiciousPatterns: [],
            insights: [
                'Healthy bidding activity',
                'Competitive auction',
                'Normal bid increments'
            ],
            analyzedAt: new Date().toISOString()
        };
        
        // Add some mock suspicious patterns occasionally
        if (Math.random() > 0.9) {
            analysis.suspiciousPatterns.push('Potential shill bidding detected');
            analysis.bidVelocity = 'HIGH';
        }
        
        logger.debug(`Mock bid pattern analysis for auction ${auctionId}`);
        return analysis;
    }

    /**
     * Mock market insights
     * @param {string} category - Auction category
     * @returns {object} Market insights
     */
    getMarketInsights(category) {
        const insights = {
            category,
            averagePrice: 500 + Math.random() * 1000,
            priceGrowth: (Math.random() * 20 - 5).toFixed(2) + '%', // -5% to +15%
            popularityTrend: Math.random() > 0.5 ? 'RISING' : 'STABLE',
            competitionLevel: ['LOW', 'MEDIUM', 'HIGH'][Math.floor(Math.random() * 3)],
            bestTimeToSell: 'Weekend evenings',
            insights: [
                `${category} items are performing well`,
                'High buyer interest in this category',
                'Competitive pricing recommended'
            ],
            generatedAt: new Date().toISOString()
        };
        
        logger.debug(`Mock market insights for category ${category}`);
        return insights;
    }
}

// Export singleton instance
const mockAIService = new MockAIService();
export default mockAIService;
