import mongoose from 'mongoose';

const auctionSchema = new mongoose.Schema({
    seller: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Seller is required'],
        index: true
    },
    title: {
        type: String,
        required: [true, 'Title is required'],
        trim: true,
        minlength: [3, 'Title must be at least 3 characters long'],
        maxlength: [200, 'Title cannot exceed 200 characters']
    },
    description: {
        type: String,
        required: [true, 'Description is required'],
        trim: true,
        minlength: [10, 'Description must be at least 10 characters long'],
        maxlength: [5000, 'Description cannot exceed 5000 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        index: true,
        trim: true
    },
    images: [{
        url: {
            type: String,
            required: true
        },
        publicId: {
            type: String
        },
        order: {
            type: Number,
            default: 0
        }
    }],
    pricing: {
        startingPrice: {
            type: Number,
            required: [true, 'Starting price is required'],
            min: [0, 'Starting price must be greater than or equal to 0'],
            validate: {
                validator: function(value) {
                    return value >= 0;
                },
                message: 'Starting price must be a positive number'
            }
        },
        currentPrice: {
            type: Number,
            required: true,
            min: 0,
            default: function() {
                return this.pricing?.startingPrice || 0;
            }
        },
        reservePrice: {
            type: Number,
            min: 0,
            validate: {
                validator: function(value) {
                    if (value !== undefined && value !== null) {
                        return value >= this.pricing.startingPrice;
                    }
                    return true;
                },
                message: 'Reserve price must be greater than or equal to starting price'
            }
        },
        buyNowPrice: {
            type: Number,
            min: 0,
            validate: {
                validator: function(value) {
                    if (value !== undefined && value !== null) {
                        return value > this.pricing.startingPrice;
                    }
                    return true;
                },
                message: 'Buy now price must be greater than starting price'
            }
        }
    },
    timing: {
        startTime: {
            type: Date,
            required: [true, 'Start time is required'],
            validate: {
                validator: function(value) {
                    // Allow past dates for already started auctions
                    return value instanceof Date && !isNaN(value);
                },
                message: 'Start time must be a valid date'
            }
        },
        endTime: {
            type: Date,
            required: [true, 'End time is required'],
            index: true,
            validate: {
                validator: function(value) {
                    return value > this.timing.startTime;
                },
                message: 'End time must be after start time'
            }
        },
        duration: {
            type: Number, // Duration in hours
            required: true,
            min: [1, 'Duration must be at least 1 hour']
        }
    },
    status: {
        type: String,
        enum: {
            values: ['draft', 'active', 'closed', 'cancelled'],
            message: '{VALUE} is not a valid status'
        },
        default: 'draft',
        index: true
    },
    bidding: {
        totalBids: {
            type: Number,
            default: 0,
            min: 0
        },
        highestBid: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Bid'
        },
        winner: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }
    },
    aiInsights: {
        predictedPrice: {
            type: Number,
            min: 0
        },
        priceRange: {
            min: {
                type: Number,
                min: 0
            },
            max: {
                type: Number,
                min: 0
            }
        },
        confidence: {
            type: Number,
            min: 0,
            max: 1
        },
        lastUpdated: {
            type: Date
        }
    },
    metadata: {
        views: {
            type: Number,
            default: 0,
            min: 0
        },
        watchers: [{
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User'
        }],
        featured: {
            type: Boolean,
            default: false
        }
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Indexes
auctionSchema.index({ seller: 1 });
auctionSchema.index({ status: 1 });
auctionSchema.index({ 'timing.endTime': 1 });
auctionSchema.index({ category: 1 });
auctionSchema.index({ 'pricing.currentPrice': 1 });

// Text index for search on title and description
auctionSchema.index({ title: 'text', description: 'text' });

// Pre-save hook to calculate duration if not provided
auctionSchema.pre('save', function(next) {
    if (this.timing.startTime && this.timing.endTime && !this.timing.duration) {
        const durationMs = this.timing.endTime - this.timing.startTime;
        this.timing.duration = Math.ceil(durationMs / (1000 * 60 * 60)); // Convert to hours
    }
    next();
});

// Pre-save hook to set currentPrice to startingPrice if not set
auctionSchema.pre('save', function(next) {
    if (this.isNew && !this.pricing.currentPrice) {
        this.pricing.currentPrice = this.pricing.startingPrice;
    }
    next();
});

// Instance method to check if auction is active
auctionSchema.methods.isActive = function() {
    const now = new Date();
    return this.status === 'active' && 
           this.timing.startTime <= now && 
           this.timing.endTime > now;
};

// Instance method to check if auction has ended
auctionSchema.methods.hasEnded = function() {
    return new Date() >= this.timing.endTime;
};

// Instance method to check if user can modify auction
auctionSchema.methods.canModify = function() {
    return this.bidding.totalBids === 0;
};

// Static method to find active auctions
auctionSchema.statics.findActive = function() {
    const now = new Date();
    return this.find({
        status: 'active',
        'timing.startTime': { $lte: now },
        'timing.endTime': { $gt: now }
    });
};

// Static method to find expired auctions that need to be closed
auctionSchema.statics.findExpired = function() {
    const now = new Date();
    return this.find({
        status: 'active',
        'timing.endTime': { $lte: now }
    });
};

const Auction = mongoose.model('Auction', auctionSchema);

export default Auction;
