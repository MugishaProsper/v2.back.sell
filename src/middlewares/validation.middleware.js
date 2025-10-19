import Joi from 'joi';
import logger from '../config/logger.js';

/**
 * Middleware factory to validate request data using Joi schemas
 * @param {Object} schema - Joi validation schema object with body, query, params keys
 * @returns {Function} Express middleware function
 */
export const validate = (schema) => {
    return (req, res, next) => {
        const validationOptions = {
            abortEarly: false, // Return all errors, not just the first one
            allowUnknown: true, // Allow unknown keys that will be ignored
            stripUnknown: true, // Remove unknown keys from validated data
        };

        const toValidate = {};
        
        if (schema.body) {
            toValidate.body = req.body;
        }
        
        if (schema.query) {
            toValidate.query = req.query;
        }
        
        if (schema.params) {
            toValidate.params = req.params;
        }

        const schemaToValidate = Joi.object(schema);
        const { error, value } = schemaToValidate.validate(toValidate, validationOptions);

        if (error) {
            const errors = error.details.map((detail) => ({
                field: detail.path.join('.'),
                message: detail.message.replace(/['"]/g, ''),
            }));

            logger.warn('Validation failed', {
                path: req.path,
                method: req.method,
                errors,
            });

            return res.status(400).json({
                success: false,
                error: {
                    code: 'VALIDATION_FAILED',
                    message: 'Request validation failed',
                    details: errors,
                    timestamp: new Date().toISOString(),
                    path: req.path,
                },
            });
        }

        // Replace request data with validated and sanitized data
        if (value.body) {
            req.body = value.body;
        }
        
        if (value.query) {
            req.query = value.query;
        }
        
        if (value.params) {
            req.params = value.params;
        }

        next();
    };
};

/**
 * Common Joi validation schemas
 */
export const schemas = {
    // MongoDB ObjectId validation
    objectId: Joi.string().regex(/^[0-9a-fA-F]{24}$/).message('Invalid ID format'),
    
    // Email validation
    email: Joi.string().email().lowercase().trim().max(255),
    
    // Password validation (min 8 chars, at least one letter and one number)
    password: Joi.string()
        .min(8)
        .max(128)
        .pattern(/^(?=.*[A-Za-z])(?=.*\d)/)
        .message('Password must be at least 8 characters and contain at least one letter and one number'),
    
    // Pagination
    pagination: {
        page: Joi.number().integer().min(1).default(1),
        limit: Joi.number().integer().min(1).max(100).default(10),
    },
    
    // Common string validations
    string: {
        required: Joi.string().trim().required(),
        optional: Joi.string().trim().allow('', null),
        notEmpty: Joi.string().trim().min(1).required(),
    },
    
    // Number validations
    number: {
        positive: Joi.number().positive().required(),
        nonNegative: Joi.number().min(0).required(),
        integer: Joi.number().integer().required(),
    },
    
    // Date validations
    date: {
        future: Joi.date().greater('now').required(),
        past: Joi.date().less('now').required(),
        any: Joi.date().required(),
    },
    
    // Array validations
    array: {
        strings: Joi.array().items(Joi.string().trim()),
        objectIds: Joi.array().items(Joi.string().regex(/^[0-9a-fA-F]{24}$/)),
    },
};

/**
 * Validation schemas for authentication endpoints
 */
export const authValidation = {
    register: {
        body: Joi.object({
            email: schemas.email.required(),
            password: schemas.password.required(),
            firstName: Joi.string().trim().min(1).max(50).required(),
            lastName: Joi.string().trim().min(1).max(50).required(),
            phone: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/).optional(),
            role: Joi.string().valid('buyer', 'seller').default('buyer'),
        }),
    },
    
    login: {
        body: Joi.object({
            email: schemas.email.required(),
            password: Joi.string().required(),
        }),
    },
    
    refreshToken: {
        body: Joi.object({
            refreshToken: Joi.string().required(),
        }),
    },
};

/**
 * Validation schemas for user endpoints
 */
export const userValidation = {
    getUserById: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
    },
    
    updateUser: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
        body: Joi.object({
            firstName: Joi.string().trim().min(1).max(50),
            lastName: Joi.string().trim().min(1).max(50),
            phone: Joi.string().trim().pattern(/^\+?[1-9]\d{1,14}$/),
            address: Joi.object({
                street: Joi.string().trim().max(200),
                city: Joi.string().trim().max(100),
                state: Joi.string().trim().max(100),
                zipCode: Joi.string().trim().max(20),
                country: Joi.string().trim().max(100),
            }),
            notificationPreferences: Joi.object({
                email: Joi.boolean(),
                inApp: Joi.boolean(),
                bidUpdates: Joi.boolean(),
                auctionUpdates: Joi.boolean(),
                marketing: Joi.boolean(),
            }),
        }).min(1),
    },
    
    deleteUser: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
    },
};

/**
 * Validation schemas for auction endpoints
 */
export const auctionValidation = {
    createAuction: {
        body: Joi.object({
            title: Joi.string().trim().min(3).max(200).required(),
            description: Joi.string().trim().min(10).max(5000).required(),
            category: Joi.string().trim().min(1).max(100).required(),
            startingPrice: schemas.number.positive.required(),
            reservePrice: schemas.number.positive.optional(),
            buyNowPrice: schemas.number.positive.optional(),
            duration: Joi.number().integer().min(1).max(720).required(), // Max 30 days
            startTime: schemas.date.any.optional(),
        }),
    },
    
    updateAuction: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
        body: Joi.object({
            title: Joi.string().trim().min(3).max(200),
            description: Joi.string().trim().min(10).max(5000),
            category: Joi.string().trim().min(1).max(100),
            reservePrice: schemas.number.positive,
            buyNowPrice: schemas.number.positive,
        }).min(1),
    },
    
    getAuctionById: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
    },
    
    deleteAuction: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
    },
    
    searchAuctions: {
        query: Joi.object({
            q: Joi.string().trim().max(200),
            category: Joi.string().trim().max(100),
            minPrice: schemas.number.nonNegative,
            maxPrice: schemas.number.nonNegative,
            status: Joi.string().valid('draft', 'active', 'closed', 'cancelled'),
            sortBy: Joi.string().valid('relevance', 'price', 'endTime', 'createdAt'),
            sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
            page: schemas.pagination.page,
            limit: schemas.pagination.limit,
        }),
    },
    
    listAuctions: {
        query: Joi.object({
            page: schemas.pagination.page,
            limit: schemas.pagination.limit,
            status: Joi.string().valid('draft', 'active', 'closed', 'cancelled'),
            category: Joi.string().trim().max(100),
        }),
    },
};

/**
 * Validation schemas for bid endpoints
 */
export const bidValidation = {
    placeBid: {
        body: Joi.object({
            auctionId: schemas.objectId.required(),
            amount: schemas.number.positive.required(),
        }),
    },
    
    getBidsByAuction: {
        params: Joi.object({
            auctionId: schemas.objectId.required(),
        }),
        query: Joi.object({
            page: schemas.pagination.page,
            limit: schemas.pagination.limit,
        }),
    },
    
    getBidsByUser: {
        params: Joi.object({
            userId: schemas.objectId.required(),
        }),
        query: Joi.object({
            page: schemas.pagination.page,
            limit: schemas.pagination.limit,
        }),
    },
};

/**
 * Validation schemas for notification endpoints
 */
export const notificationValidation = {
    getNotifications: {
        query: Joi.object({
            page: schemas.pagination.page,
            limit: schemas.pagination.limit,
            type: Joi.string().valid('bid_outbid', 'bid_won', 'auction_ended', 'payment_received', 'system'),
            unreadOnly: Joi.boolean().default(false),
        }),
    },
    
    markAsRead: {
        params: Joi.object({
            id: schemas.objectId.required(),
        }),
    },
    
    updatePreferences: {
        body: Joi.object({
            email: Joi.boolean(),
            inApp: Joi.boolean(),
            bidUpdates: Joi.boolean(),
            auctionUpdates: Joi.boolean(),
            marketing: Joi.boolean(),
        }).min(1),
    },
};

/**
 * Validation schemas for analytics endpoints
 */
export const analyticsValidation = {
    getStats: {
        query: Joi.object({
            startDate: schemas.date.any.optional(),
            endDate: schemas.date.any.optional(),
            granularity: Joi.string().valid('day', 'week', 'month').default('day'),
        }),
    },
    
    exportData: {
        query: Joi.object({
            format: Joi.string().valid('json', 'csv').default('json'),
            startDate: schemas.date.any.optional(),
            endDate: schemas.date.any.optional(),
        }),
    },
};
