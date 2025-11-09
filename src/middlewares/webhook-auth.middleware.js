import { configDotenv } from 'dotenv';
import logger from '../config/logger.js';

configDotenv();

/**
 * Webhook Authentication Middleware
 * Validates incoming webhooks from AI module using shared secret
 */
export const validateWebhookAuth = (req, res, next) => {
    try {
        const webhookSecret = req.headers['x-webhook-secret'];
        const expectedSecret = process.env.AI_WEBHOOK_SECRET;

        // Check if secret is configured
        if (!expectedSecret) {
            logger.error('AI_WEBHOOK_SECRET not configured');
            return res.status(500).json({
                success: false,
                error: {
                    code: 'WEBHOOK_AUTH_NOT_CONFIGURED',
                    message: 'Webhook authentication not configured'
                }
            });
        }

        // Check if secret is provided
        if (!webhookSecret) {
            logger.warn('Webhook request without authentication header');
            return res.status(401).json({
                success: false,
                error: {
                    code: 'WEBHOOK_AUTH_MISSING',
                    message: 'Webhook authentication header missing'
                }
            });
        }

        // Validate secret
        if (webhookSecret !== expectedSecret) {
            logger.warn('Invalid webhook authentication attempt');
            return res.status(403).json({
                success: false,
                error: {
                    code: 'WEBHOOK_AUTH_INVALID',
                    message: 'Invalid webhook authentication'
                }
            });
        }

        // Authentication successful
        logger.debug('Webhook authentication successful');
        next();
    } catch (error) {
        logger.error('Error in webhook authentication:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Webhook authentication failed'
            }
        });
    }
};

/**
 * Optional: IP Whitelist Middleware
 * Restricts webhook access to specific IP addresses
 */
export const validateWebhookIP = (req, res, next) => {
    try {
        const allowedIPs = process.env.AI_MODULE_ALLOWED_IPS 
            ? process.env.AI_MODULE_ALLOWED_IPS.split(',') 
            : [];

        // Skip IP validation if no IPs configured
        if (allowedIPs.length === 0) {
            return next();
        }

        // Get client IP
        const clientIP = req.ip || req.connection.remoteAddress;

        // Check if IP is allowed
        if (!allowedIPs.includes(clientIP)) {
            logger.warn(`Webhook request from unauthorized IP: ${clientIP}`);
            return res.status(403).json({
                success: false,
                error: {
                    code: 'WEBHOOK_IP_FORBIDDEN',
                    message: 'Webhook access forbidden from this IP'
                }
            });
        }

        next();
    } catch (error) {
        logger.error('Error in webhook IP validation:', error);
        res.status(500).json({
            success: false,
            error: {
                code: 'INTERNAL_SERVER_ERROR',
                message: 'Webhook IP validation failed'
            }
        });
    }
};
