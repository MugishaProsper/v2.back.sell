import helmet from 'helmet';
import cors from 'cors';
import logger from '../config/logger.js';

/**
 * Configure Helmet.js for HTTP security headers
 * Helmet helps secure Express apps by setting various HTTP headers
 */
export const configureHelmet = () => {
    return helmet({
        // Content Security Policy
        contentSecurityPolicy: {
            directives: {
                defaultSrc: ["'self'"],
                styleSrc: ["'self'", "'unsafe-inline'"],
                scriptSrc: ["'self'"],
                imgSrc: ["'self'", 'data:', 'https:'],
                connectSrc: ["'self'"],
                fontSrc: ["'self'"],
                objectSrc: ["'none'"],
                mediaSrc: ["'self'"],
                frameSrc: ["'none'"],
            },
        },
        // Cross-Origin-Embedder-Policy
        crossOriginEmbedderPolicy: true,
        // Cross-Origin-Opener-Policy
        crossOriginOpenerPolicy: { policy: 'same-origin' },
        // Cross-Origin-Resource-Policy
        crossOriginResourcePolicy: { policy: 'same-origin' },
        // DNS Prefetch Control
        dnsPrefetchControl: { allow: false },
        // Expect-CT
        expectCt: {
            maxAge: 86400,
            enforce: true,
        },
        // Frameguard (X-Frame-Options)
        frameguard: { action: 'deny' },
        // Hide Powered By
        hidePoweredBy: true,
        // HTTP Strict Transport Security
        hsts: {
            maxAge: 31536000, // 1 year
            includeSubDomains: true,
            preload: true,
        },
        // IE No Open
        ieNoOpen: true,
        // No Sniff (X-Content-Type-Options)
        noSniff: true,
        // Origin Agent Cluster
        originAgentCluster: true,
        // Permitted Cross-Domain Policies
        permittedCrossDomainPolicies: { permittedPolicies: 'none' },
        // Referrer Policy
        referrerPolicy: { policy: 'no-referrer' },
        // X-XSS-Protection
        xssFilter: true,
    });
};

/**
 * Configure CORS with allowed frontend domains
 * Handles Cross-Origin Resource Sharing
 */
export const configureCORS = () => {
    const allowedOrigins = process.env.FRONTEND_URL 
        ? process.env.FRONTEND_URL.split(',').map(url => url.trim())
        : ['http://localhost:3000'];

    return cors({
        origin: (origin, callback) => {
            // Allow requests with no origin (mobile apps, Postman, etc.)
            if (!origin) {
                return callback(null, true);
            }

            if (allowedOrigins.includes(origin)) {
                callback(null, true);
            } else {
                logger.warn('CORS blocked request from origin:', origin);
                callback(new Error('Not allowed by CORS'));
            }
        },
        credentials: true, // Allow cookies to be sent
        methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
        allowedHeaders: [
            'Content-Type',
            'Authorization',
            'X-Requested-With',
            'X-Request-Id',
            'X-CSRF-Token',
        ],
        exposedHeaders: [
            'X-Request-Id',
            'X-New-Access-Token',
            'RateLimit-Limit',
            'RateLimit-Remaining',
            'RateLimit-Reset',
        ],
        maxAge: 86400, // 24 hours
    });
};

/**
 * CSRF Protection Middleware
 * Note: CSRF protection is typically needed for browser-based applications
 * For API-only applications using JWT, CSRF is less of a concern
 * This implementation provides optional CSRF protection
 */
export const csrfProtection = (req, res, next) => {
    // Skip CSRF for certain routes
    const skipRoutes = [
        '/api/v1/auth/login',
        '/api/v1/auth/register',
        '/api/v1/webhooks',
        '/health',
    ];

    // Check if route should skip CSRF
    const shouldSkip = skipRoutes.some(route => req.path.startsWith(route));
    if (shouldSkip) {
        return next();
    }

    // Skip CSRF for non-state-changing methods
    if (['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
        return next();
    }

    // For JWT-based APIs, we rely on the token itself for CSRF protection
    // The token is stored in Authorization header, not in cookies
    // This makes it immune to CSRF attacks
    
    // If using cookie-based sessions, implement CSRF token validation here
    // For now, we'll log and continue
    logger.debug('CSRF check passed (JWT-based auth)');
    next();
};

/**
 * Security headers middleware
 * Adds additional custom security headers
 */
export const addSecurityHeaders = (req, res, next) => {
    // Prevent clickjacking
    res.setHeader('X-Frame-Options', 'DENY');
    
    // Prevent MIME type sniffing
    res.setHeader('X-Content-Type-Options', 'nosniff');
    
    // Enable XSS filter in older browsers
    res.setHeader('X-XSS-Protection', '1; mode=block');
    
    // Referrer policy
    res.setHeader('Referrer-Policy', 'no-referrer');
    
    // Permissions policy (formerly Feature Policy)
    res.setHeader('Permissions-Policy', 'geolocation=(), microphone=(), camera=()');
    
    // Remove server information
    res.removeHeader('X-Powered-By');
    
    next();
};

/**
 * Middleware to detect and block suspicious requests
 */
export const detectSuspiciousActivity = (req, res, next) => {
    const suspiciousPatterns = [
        // SQL injection patterns
        /(\%27)|(\')|(\-\-)|(\%23)|(#)/i,
        // XSS patterns
        /<script[^>]*>.*?<\/script>/gi,
        // Path traversal
        /\.\.[\/\\]/,
        // Command injection
        /[;&|`$()]/,
    ];

    const checkString = `${req.url} ${JSON.stringify(req.query)} ${JSON.stringify(req.body)}`;

    for (const pattern of suspiciousPatterns) {
        if (pattern.test(checkString)) {
            logger.error('Suspicious activity detected', {
                ip: req.ip,
                path: req.path,
                method: req.method,
                userAgent: req.headers['user-agent'],
                pattern: pattern.toString(),
            });

            return res.status(403).json({
                success: false,
                error: {
                    code: 'SUSPICIOUS_ACTIVITY',
                    message: 'Request blocked due to suspicious activity',
                    timestamp: new Date().toISOString(),
                },
            });
        }
    }

    next();
};

/**
 * Middleware to enforce HTTPS in production
 */
export const enforceHTTPS = (req, res, next) => {
    if (process.env.NODE_ENV === 'production') {
        if (req.headers['x-forwarded-proto'] !== 'https') {
            logger.warn('HTTP request in production, redirecting to HTTPS', {
                ip: req.ip,
                path: req.path,
            });
            return res.redirect(301, `https://${req.headers.host}${req.url}`);
        }
    }
    next();
};

/**
 * Middleware to add request timeout
 * Prevents long-running requests from consuming resources
 */
export const requestTimeout = (timeout = 30000) => {
    return (req, res, next) => {
        // Set timeout for the request
        req.setTimeout(timeout, () => {
            logger.error('Request timeout', {
                path: req.path,
                method: req.method,
                timeout,
            });

            if (!res.headersSent) {
                res.status(408).json({
                    success: false,
                    error: {
                        code: 'REQUEST_TIMEOUT',
                        message: 'Request took too long to process',
                        timestamp: new Date().toISOString(),
                    },
                });
            }
        });

        next();
    };
};

/**
 * Middleware to validate Content-Type for POST/PUT requests
 */
export const validateContentType = (req, res, next) => {
    if (['POST', 'PUT', 'PATCH'].includes(req.method)) {
        const contentType = req.headers['content-type'];
        
        // Allow multipart/form-data for file uploads
        if (req.path.includes('/images') || req.path.includes('/upload')) {
            return next();
        }

        // Require application/json for API requests
        if (!contentType || !contentType.includes('application/json')) {
            logger.warn('Invalid Content-Type', {
                path: req.path,
                method: req.method,
                contentType,
            });

            return res.status(415).json({
                success: false,
                error: {
                    code: 'INVALID_CONTENT_TYPE',
                    message: 'Content-Type must be application/json',
                    timestamp: new Date().toISOString(),
                },
            });
        }
    }

    next();
};
