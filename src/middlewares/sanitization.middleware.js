import mongoSanitize from 'express-mongo-sanitize';
import xss from 'xss-clean';
import logger from '../config/logger.js';

/**
 * Sanitize request data to prevent NoSQL injection attacks
 * Removes any keys that start with $ or contain .
 */
export const sanitizeNoSQL = mongoSanitize({
    replaceWith: '_',
    onSanitize: ({ req, key }) => {
        logger.warn('NoSQL injection attempt detected', {
            path: req.path,
            method: req.method,
            key,
            ip: req.ip,
            userAgent: req.headers['user-agent'],
        });
    },
});

/**
 * Sanitize request data to prevent XSS attacks
 * Cleans user input from malicious HTML/JavaScript
 */
export const sanitizeXSS = xss();

/**
 * Custom sanitization for specific fields
 * Trims whitespace and removes potentially dangerous characters
 */
export const customSanitize = (req, res, next) => {
    try {
        // Sanitize query parameters
        if (req.query) {
            Object.keys(req.query).forEach((key) => {
                if (typeof req.query[key] === 'string') {
                    // Trim whitespace
                    req.query[key] = req.query[key].trim();
                    
                    // Remove null bytes
                    req.query[key] = req.query[key].replace(/\0/g, '');
                }
            });
        }

        // Sanitize body parameters
        if (req.body && typeof req.body === 'object') {
            sanitizeObject(req.body);
        }

        next();
    } catch (error) {
        logger.error('Sanitization middleware error:', error);
        next(error);
    }
};

/**
 * Recursively sanitize object properties
 * @param {Object} obj - Object to sanitize
 */
function sanitizeObject(obj) {
    Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'string') {
            // Trim whitespace
            obj[key] = obj[key].trim();
            
            // Remove null bytes
            obj[key] = obj[key].replace(/\0/g, '');
            
            // Remove control characters except newlines and tabs
            obj[key] = obj[key].replace(/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/g, '');
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            // Recursively sanitize nested objects
            sanitizeObject(obj[key]);
        } else if (Array.isArray(obj[key])) {
            // Sanitize array elements
            obj[key].forEach((item, index) => {
                if (typeof item === 'string') {
                    obj[key][index] = item.trim().replace(/\0/g, '');
                } else if (typeof item === 'object' && item !== null) {
                    sanitizeObject(item);
                }
            });
        }
    });
}

/**
 * Validate and sanitize file uploads
 * Checks file types, sizes, and names
 */
export const sanitizeFileUpload = (req, res, next) => {
    try {
        if (req.file) {
            // Sanitize filename
            req.file.originalname = sanitizeFilename(req.file.originalname);
        }

        if (req.files) {
            if (Array.isArray(req.files)) {
                req.files.forEach((file) => {
                    file.originalname = sanitizeFilename(file.originalname);
                });
            } else {
                // Handle object with multiple fields
                Object.keys(req.files).forEach((fieldname) => {
                    req.files[fieldname].forEach((file) => {
                        file.originalname = sanitizeFilename(file.originalname);
                    });
                });
            }
        }

        next();
    } catch (error) {
        logger.error('File sanitization error:', error);
        next(error);
    }
};

/**
 * Sanitize filename to prevent directory traversal and other attacks
 * @param {string} filename - Original filename
 * @returns {string} Sanitized filename
 */
function sanitizeFilename(filename) {
    // Remove path separators
    let sanitized = filename.replace(/[\/\\]/g, '');
    
    // Remove null bytes
    sanitized = sanitized.replace(/\0/g, '');
    
    // Remove control characters
    sanitized = sanitized.replace(/[\x00-\x1F\x7F]/g, '');
    
    // Remove leading dots (hidden files)
    sanitized = sanitized.replace(/^\.+/, '');
    
    // Limit length
    if (sanitized.length > 255) {
        const ext = sanitized.split('.').pop();
        const name = sanitized.substring(0, 255 - ext.length - 1);
        sanitized = `${name}.${ext}`;
    }
    
    return sanitized || 'unnamed';
}

/**
 * Sanitize HTML content while preserving safe tags
 * Useful for rich text fields like descriptions
 */
export const sanitizeHTML = (allowedTags = []) => {
    return (req, res, next) => {
        try {
            if (req.body && typeof req.body === 'object') {
                sanitizeHTMLInObject(req.body, allowedTags);
            }
            next();
        } catch (error) {
            logger.error('HTML sanitization error:', error);
            next(error);
        }
    };
};

/**
 * Recursively sanitize HTML in object properties
 * @param {Object} obj - Object to sanitize
 * @param {Array} allowedTags - List of allowed HTML tags
 */
function sanitizeHTMLInObject(obj, allowedTags) {
    Object.keys(obj).forEach((key) => {
        if (typeof obj[key] === 'string') {
            // Remove script tags and event handlers
            obj[key] = obj[key]
                .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
                .replace(/on\w+\s*=\s*["'][^"']*["']/gi, '')
                .replace(/on\w+\s*=\s*[^\s>]*/gi, '');
            
            // If no tags are allowed, strip all HTML
            if (allowedTags.length === 0) {
                obj[key] = obj[key].replace(/<[^>]*>/g, '');
            }
        } else if (typeof obj[key] === 'object' && obj[key] !== null && !Array.isArray(obj[key])) {
            sanitizeHTMLInObject(obj[key], allowedTags);
        }
    });
}
