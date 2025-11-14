import mongoose from 'mongoose';

const analyticsSchema = new mongoose.Schema({
    date: {
        type: Date,
        required: [true, 'Date is required'],
        unique: true,
        index: true
    },
    metrics: {
        auctions: {
            created: {
                type: Number,
                default: 0,
                min: 0
            },
            active: {
                type: Number,
                default: 0,
                min: 0
            },
            closed: {
                type: Number,
                default: 0,
                min: 0
            },
            totalValue: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        users: {
            newRegistrations: {
                type: Number,
                default: 0,
                min: 0
            },
            activeUsers: {
                type: Number,
                default: 0,
                min: 0
            },
            totalUsers: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        bids: {
            totalBids: {
                type: Number,
                default: 0,
                min: 0
            },
            uniqueBidders: {
                type: Number,
                default: 0,
                min: 0
            },
            averageBidAmount: {
                type: Number,
                default: 0,
                min: 0
            }
        },
        payments: {
            totalTransactions: {
                type: Number,
                default: 0,
                min: 0
            },
            totalRevenue: {
                type: Number,
                default: 0,
                min: 0
            },
            successRate: {
                type: Number,
                default: 0,
                min: 0,
                max: 100
            }
        },
        ai: {
            predictionsGenerated: {
                type: Number,
                default: 0,
                min: 0
            },
            fraudDetections: {
                type: Number,
                default: 0,
                min: 0
            },
            recommendationsServed: {
                type: Number,
                default: 0,
                min: 0
            }
        }
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, {
    timestamps: false // Using custom createdAt field
});

// Indexes
analyticsSchema.index({ date: 1 }, { unique: true });

// Static method to find analytics by date range
analyticsSchema.statics.findByDateRange = function(startDate, endDate, options = {}) {
    const query = this.find({
        date: {
            $gte: startDate,
            $lte: endDate
        }
    });
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ date: -1 });
    }
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    return query;
};

// Static method to get latest analytics
analyticsSchema.statics.getLatest = function(days = 7) {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);
    
    return this.find({
        date: { $gte: startDate }
    }).sort({ date: -1 });
};

// Static method to aggregate metrics over a period
analyticsSchema.statics.aggregateMetrics = async function(startDate, endDate) {
    const result = await this.aggregate([
        {
            $match: {
                date: {
                    $gte: startDate,
                    $lte: endDate
                }
            }
        },
        {
            $group: {
                _id: null,
                totalAuctionsCreated: { $sum: '$metrics.auctions.created' },
                totalAuctionsClosed: { $sum: '$metrics.auctions.closed' },
                totalAuctionValue: { $sum: '$metrics.auctions.totalValue' },
                totalNewUsers: { $sum: '$metrics.users.newRegistrations' },
                totalBids: { $sum: '$metrics.bids.totalBids' },
                avgBidAmount: { $avg: '$metrics.bids.averageBidAmount' },
                totalRevenue: { $sum: '$metrics.payments.totalRevenue' },
                totalTransactions: { $sum: '$metrics.payments.totalTransactions' },
                avgSuccessRate: { $avg: '$metrics.payments.successRate' },
                totalPredictions: { $sum: '$metrics.ai.predictionsGenerated' },
                totalFraudDetections: { $sum: '$metrics.ai.fraudDetections' },
                totalRecommendations: { $sum: '$metrics.ai.recommendationsServed' }
            }
        }
    ]);
    
    return result.length > 0 ? result[0] : null;
};

// Instance method to update specific metric
analyticsSchema.methods.updateMetric = async function(category, field, value) {
    if (!this.metrics[category]) {
        throw new Error(`Invalid metric category: ${category}`);
    }
    
    if (this.metrics[category][field] === undefined) {
        throw new Error(`Invalid metric field: ${field} in category ${category}`);
    }
    
    this.metrics[category][field] = value;
    return await this.save();
};

// Instance method to increment specific metric
analyticsSchema.methods.incrementMetric = async function(category, field, amount = 1) {
    if (!this.metrics[category]) {
        throw new Error(`Invalid metric category: ${category}`);
    }
    
    if (this.metrics[category][field] === undefined) {
        throw new Error(`Invalid metric field: ${field} in category ${category}`);
    }
    
    this.metrics[category][field] += amount;
    return await this.save();
};

const Analytics = mongoose.model('Analytics', analyticsSchema);

export default Analytics;
