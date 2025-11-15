import logger from '../config/logger.js';

/**
 * API Versioning Middleware
 * Supports version negotiation via Accept header
 * Format: application/vnd.auction-api.v1+json
 */

/**
 * Extract API version from Accept header
 * @param {string} acceptHeader - Accept header value
 * @returns {string|null} Version string (e.g., 'v1') or null
 */
const extractVersionFromHeader = (acceptHeader) => {
    if (!acceptHeader) return null;

    // Match pattern: application/vnd.auction-api.v{version}+json
    const versionMatch = acceptHeader.match(/application\/vnd\.auction-api\.(v\d+)\+json/);
    
    if (versionMatch && versionMatch[1]) {
        return versionMatch[1];
    }

    return null;
};

/**
 * Validate if the requested version is supported
 * @param {string} version - Version string (e.g., 'v1')
 * @returns {boolean} True if version is supported
 */
const isSupportedVersion = (version) => {
    const supportedVersions = ['v1']; // Add more versions as they are released
    return supportedVersions.includes(version);
};

/**
 * API Version Negotiation Middleware
 * Checks Accept header for version specification
 * Falls back to URL-based versioning if not specified
 */
export const versionNegotiation = (req, res, next) => {
    const acceptHeader = req.get('Accept');
    const requestedVersion = extractVersionFromHeader(acceptHeader);

    // If version is specified in Accept header
    if (requestedVersion) {
        if (isSupportedVersion(requestedVersion)) {
            req.apiVersion = requestedVersion;
            logger.debug(`API version ${requestedVersion} requested via Accept header`);
        } else {
            return res.status(406).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_API_VERSION',
                    message: `API version ${requestedVersion} is not supported`,
                    supportedVersions: ['v1'],
                    timestamp: new Date().toISOString(),
                    path: req.path,
                },
            });
        }
    } else {
        // Extract version from URL path (e.g., /api/v1/...)
        const urlVersionMatch = req.path.match(/^\/api\/(v\d+)\//);
        if (urlVersionMatch && urlVersionMatch[1]) {
            req.apiVersion = urlVersionMatch[1];
        } else {
            // Default to v1 if no version specified
            req.apiVersion = 'v1';
        }
    }

    // Add version to response headers
    res.setHeader('X-API-Version', req.apiVersion);
    
    next();
};

/**
 * Deprecation Warning Middleware
 * Adds deprecation headers for endpoints that will be removed
 */
export const deprecationWarning = (deprecatedVersion, sunsetDate, alternativeEndpoint) => {
    return (req, res, next) => {
        const currentVersion = req.apiVersion || 'v1';

        if (currentVersion === deprecatedVersion) {
            res.setHeader('Deprecation', 'true');
            res.setHeader('Sunset', sunsetDate);
            
            if (alternativeEndpoint) {
                res.setHeader('Link', `<${alternativeEndpoint}>; rel="alternate"`);
            }

            logger.warn(`Deprecated endpoint accessed: ${req.path} (version: ${currentVersion})`);
        }

        next();
    };
};

/**
 * Version-specific route handler wrapper
 * Allows different implementations for different API versions
 */
export const versionedHandler = (handlers) => {
    return (req, res, next) => {
        const version = req.apiVersion || 'v1';
        const handler = handlers[version];

        if (!handler) {
            return res.status(406).json({
                success: false,
                error: {
                    code: 'UNSUPPORTED_API_VERSION',
                    message: `This endpoint does not support API version ${version}`,
                    supportedVersions: Object.keys(handlers),
                    timestamp: new Date().toISOString(),
                    path: req.path,
                },
            });
        }

        handler(req, res, next);
    };
};

/**
 * Get supported API versions
 */
export const getSupportedVersions = () => {
    return ['v1'];
};

export default {
    versionNegotiation,
    deprecationWarning,
    versionedHandler,
    getSupportedVersions,
};
