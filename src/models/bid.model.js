import mongoose from 'mongoose';

const bidSchema = new mongoose.Schema({
    auction: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Auction',
        required: [true, 'Auction is required'],
        index: true
    },
    bidder: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Bidder is required'],
        index: true
    },
    amount: {
        type: Number,
        required: [true, 'Bid amount is required'],
        min: [0, 'Bid amount must be greater than 0'],
        validate: {
            validator: function(value) {
                return value > 0;
            },
            message: 'Bid amount must be a positive number'
        }
    },
    timestamp: {
        type: Date,
        default: Date.now,
        index: true
    },
    status: {
        type: String,
        enum: {
            values: ['active', 'outbid', 'won', 'lost'],
            message: '{VALUE} is not a valid bid status'
        },
        default: 'active'
    },
    fraudAnalysis: {
        riskScore: {
            type: Number,
            min: 0,
            max: 1,
            default: 0
        },
        isFlagged: {
            type: Boolean,
            default: false
        },
        reasons: [{
            type: String
        }],
        analyzedAt: {
            type: Date
        }
    },
    metadata: {
        ipAddress: {
            type: String,
            trim: true
        },
        userAgent: {
            type: String,
            trim: true
        },
        bidMethod: {
            type: String,
            enum: ['manual', 'auto'],
            default: 'manual'
        }
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes
bidSchema.index({ auction: 1 });
bidSchema.index({ bidder: 1 });
bidSchema.index({ timestamp: 1 });
// Compound index for auction and amount (descending for finding highest bid)
bidSchema.index({ auction: 1, amount: -1 });

// Instance method to check if bid is winning
bidSchema.methods.isWinning = function() {
    return this.status === 'active' || this.status === 'won';
};

// Instance method to mark bid as outbid
bidSchema.methods.markAsOutbid = async function() {
    this.status = 'outbid';
    return await this.save();
};

// Instance method to mark bid as won
bidSchema.methods.markAsWon = async function() {
    this.status = 'won';
    return await this.save();
};

// Instance method to mark bid as lost
bidSchema.methods.markAsLost = async function() {
    this.status = 'lost';
    return await this.save();
};

// Static method to find highest bid for an auction
bidSchema.statics.findHighestBid = function(auctionId) {
    return this.findOne({ auction: auctionId })
        .sort({ amount: -1 })
        .populate('bidder', 'email profile');
};

// Static method to find all bids for an auction
bidSchema.statics.findByAuction = function(auctionId, options = {}) {
    const query = this.find({ auction: auctionId });
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ amount: -1, timestamp: -1 });
    }
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    if (options.populate) {
        query.populate('bidder', 'email profile');
    }
    
    return query;
};

// Static method to find all bids by a user
bidSchema.statics.findByBidder = function(bidderId, options = {}) {
    const query = this.find({ bidder: bidderId });
    
    if (options.sort) {
        query.sort(options.sort);
    } else {
        query.sort({ timestamp: -1 });
    }
    
    if (options.limit) {
        query.limit(options.limit);
    }
    
    if (options.populate) {
        query.populate('auction', 'title status pricing timing');
    }
    
    return query;
};

const Bid = mongoose.model('Bid', bidSchema);

export default Bid;
