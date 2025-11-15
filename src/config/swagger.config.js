import swaggerJsdoc from 'swagger-jsdoc';

const options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'AI-Powered Auction Platform API',
            version: '1.0.0',
            description: 'Backend API for an AI-powered auction digital marketplace with real-time bidding, payment processing, and AI integration for price predictions, fraud detection, and personalized recommendations.',
            contact: {
                name: 'API Support',
                email: 'support@auction-platform.com',
            },
            license: {
                name: 'MIT',
                url: 'https://opensource.org/licenses/MIT',
            },
        },
        servers: [
            {
                url: 'http://localhost:5000',
                description: 'Development server',
            },
            {
                url: 'https://staging-api.auction-platform.com',
                description: 'Staging server',
            },
            {
                url: 'https://api.auction-platform.com',
                description: 'Production server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                    description: 'Enter your JWT token in the format: Bearer <token>',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        success: {
                            type: 'boolean',
                            example: false,
                        },
                        error: {
                            type: 'object',
                            properties: {
                                code: {
                                    type: 'string',
                                    example: 'VALIDATION_FAILED',
                                },
                                message: {
                                    type: 'string',
                                    example: 'Validation error occurred',
                                },
                                details: {
                                    type: 'object',
                                },
                                timestamp: {
                                    type: 'string',
                                    format: 'date-time',
                                },
                                path: {
                                    type: 'string',
                                    example: '/api/v1/auctions',
                                },
                                requestId: {
                                    type: 'string',
                                    format: 'uuid',
                                },
                            },
                        },
                    },
                },
                User: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        email: {
                            type: 'string',
                            format: 'email',
                            example: 'user@example.com',
                        },
                        profile: {
                            type: 'object',
                            properties: {
                                firstName: { type: 'string', example: 'John' },
                                lastName: { type: 'string', example: 'Doe' },
                                phone: { type: 'string', example: '+1234567890' },
                                avatar: { type: 'string', format: 'uri' },
                            },
                        },
                        role: {
                            type: 'string',
                            enum: ['buyer', 'seller', 'admin'],
                            example: 'buyer',
                        },
                        verified: {
                            type: 'boolean',
                            example: true,
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Auction: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        seller: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439012',
                        },
                        title: {
                            type: 'string',
                            example: 'Vintage Camera',
                        },
                        description: {
                            type: 'string',
                            example: 'A rare vintage camera from the 1960s',
                        },
                        category: {
                            type: 'string',
                            example: 'Electronics',
                        },
                        images: {
                            type: 'array',
                            items: {
                                type: 'object',
                                properties: {
                                    url: { type: 'string', format: 'uri' },
                                    publicId: { type: 'string' },
                                    order: { type: 'number' },
                                },
                            },
                        },
                        pricing: {
                            type: 'object',
                            properties: {
                                startingPrice: { type: 'number', example: 100 },
                                currentPrice: { type: 'number', example: 150 },
                                reservePrice: { type: 'number', example: 200 },
                                buyNowPrice: { type: 'number', example: 300 },
                            },
                        },
                        timing: {
                            type: 'object',
                            properties: {
                                startTime: { type: 'string', format: 'date-time' },
                                endTime: { type: 'string', format: 'date-time' },
                                duration: { type: 'number', example: 24 },
                            },
                        },
                        status: {
                            type: 'string',
                            enum: ['draft', 'active', 'closed', 'cancelled'],
                            example: 'active',
                        },
                        bidding: {
                            type: 'object',
                            properties: {
                                totalBids: { type: 'number', example: 5 },
                                highestBid: { type: 'string' },
                                winner: { type: 'string' },
                            },
                        },
                        aiInsights: {
                            type: 'object',
                            properties: {
                                predictedPrice: { type: 'number', example: 250 },
                                priceRange: {
                                    type: 'object',
                                    properties: {
                                        min: { type: 'number', example: 200 },
                                        max: { type: 'number', example: 300 },
                                    },
                                },
                                confidence: { type: 'number', example: 0.85 },
                                lastUpdated: { type: 'string', format: 'date-time' },
                            },
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
                Bid: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        auction: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439012',
                        },
                        bidder: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439013',
                        },
                        amount: {
                            type: 'number',
                            example: 150,
                        },
                        timestamp: {
                            type: 'string',
                            format: 'date-time',
                        },
                        status: {
                            type: 'string',
                            enum: ['active', 'outbid', 'won', 'lost'],
                            example: 'active',
                        },
                        fraudAnalysis: {
                            type: 'object',
                            properties: {
                                riskScore: { type: 'number', example: 0.15 },
                                isFlagged: { type: 'boolean', example: false },
                                reasons: { type: 'array', items: { type: 'string' } },
                                analyzedAt: { type: 'string', format: 'date-time' },
                            },
                        },
                    },
                },
                Notification: {
                    type: 'object',
                    properties: {
                        _id: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439011',
                        },
                        user: {
                            type: 'string',
                            example: '507f1f77bcf86cd799439012',
                        },
                        type: {
                            type: 'string',
                            enum: ['bid_outbid', 'bid_won', 'auction_ended', 'payment_received', 'system'],
                            example: 'bid_outbid',
                        },
                        title: {
                            type: 'string',
                            example: 'You have been outbid',
                        },
                        message: {
                            type: 'string',
                            example: 'Someone placed a higher bid on the auction you were bidding on',
                        },
                        data: {
                            type: 'object',
                            properties: {
                                auctionId: { type: 'string' },
                                bidId: { type: 'string' },
                                amount: { type: 'number' },
                            },
                        },
                        channels: {
                            type: 'object',
                            properties: {
                                email: {
                                    type: 'object',
                                    properties: {
                                        sent: { type: 'boolean' },
                                        sentAt: { type: 'string', format: 'date-time' },
                                    },
                                },
                                inApp: {
                                    type: 'object',
                                    properties: {
                                        read: { type: 'boolean' },
                                        readAt: { type: 'string', format: 'date-time' },
                                    },
                                },
                            },
                        },
                        priority: {
                            type: 'string',
                            enum: ['low', 'medium', 'high'],
                            example: 'medium',
                        },
                        createdAt: {
                            type: 'string',
                            format: 'date-time',
                        },
                    },
                },
            },
        },
        security: [
            {
                bearerAuth: [],
            },
        ],
        tags: [
            {
                name: 'Authentication',
                description: 'User authentication and authorization endpoints',
            },
            {
                name: 'Users',
                description: 'User management endpoints',
            },
            {
                name: 'Auctions',
                description: 'Auction management endpoints',
            },
            {
                name: 'Bids',
                description: 'Bidding system endpoints',
            },
            {
                name: 'Notifications',
                description: 'Notification management endpoints',
            },
            {
                name: 'Analytics',
                description: 'Analytics and reporting endpoints',
            },
            {
                name: 'AI Webhooks',
                description: 'AI module webhook endpoints',
            },
            {
                name: 'Health',
                description: 'Health check and system status endpoints',
            },
        ],
    },
    apis: ['./src/routes/*.js', './src/controllers/*.js', './src/server.js'],
};

const swaggerSpec = swaggerJsdoc(options);

export default swaggerSpec;
