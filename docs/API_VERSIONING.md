# API Versioning Strategy

## Overview

The AI-Powered Auction Platform API uses a comprehensive versioning strategy to ensure backward compatibility and smooth transitions between API versions. This document outlines the versioning approach, best practices, and migration guidelines.

## Versioning Approach

### URL-Based Versioning (Primary)

All API endpoints are prefixed with a version identifier in the URL path:

```
https://api.auction-platform.com/api/v1/auctions
https://api.auction-platform.com/api/v1/users
```

**Format**: `/api/{version}/{resource}`

**Current Version**: `v1`

### Accept Header Versioning (Alternative)

Clients can also specify the API version using the `Accept` header:

```http
Accept: application/vnd.auction-api.v1+json
```

**Format**: `application/vnd.auction-api.{version}+json`

If both URL and Accept header specify versions, the Accept header takes precedence.

## Version Negotiation

### Request Flow

1. Client makes a request to `/api/v1/auctions`
2. Version negotiation middleware extracts version from:
   - Accept header (if present)
   - URL path (fallback)
3. Middleware validates the requested version
4. Response includes `X-API-Version` header indicating the version used

### Example Requests

**URL-based versioning:**
```bash
curl -X GET https://api.auction-platform.com/api/v1/auctions \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Accept header versioning:**
```bash
curl -X GET https://api.auction-platform.com/api/auctions \
  -H "Accept: application/vnd.auction-api.v1+json" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

### Response Headers

All API responses include version information:

```http
X-API-Version: v1
```

## Supported Versions

| Version | Status | Release Date | Sunset Date | Notes |
|---------|--------|--------------|-------------|-------|
| v1      | Active | 2025-11-15   | N/A         | Current stable version |

## Deprecation Policy

### Deprecation Timeline

When a new API version is released:

1. **Announcement**: 6 months before deprecation
2. **Deprecation Headers**: Added to responses
3. **Sunset Date**: Set 6 months after announcement
4. **Removal**: Version removed after sunset date

### Deprecation Headers

Deprecated endpoints include the following headers:

```http
Deprecation: true
Sunset: Sat, 15 May 2026 00:00:00 GMT
Link: </api/v2/auctions>; rel="alternate"
```

- **Deprecation**: Indicates the endpoint is deprecated
- **Sunset**: Date when the endpoint will be removed
- **Link**: Alternative endpoint to use

### Example Deprecated Endpoint

```bash
curl -X GET https://api.auction-platform.com/api/v1/old-endpoint

# Response Headers:
# Deprecation: true
# Sunset: Sat, 15 May 2026 00:00:00 GMT
# Link: </api/v2/new-endpoint>; rel="alternate"
```

## Version-Specific Implementations

### Using Versioned Handlers

For endpoints that need different implementations across versions:

```javascript
import { versionedHandler } from '../middlewares/versioning.middleware.js';

router.get('/auctions', versionedHandler({
    v1: getAuctionsV1,
    v2: getAuctionsV2,
}));
```

### Example Implementation

```javascript
// v1 implementation
const getAuctionsV1 = async (req, res) => {
    // Legacy implementation
    const auctions = await Auction.find();
    res.json({ success: true, data: auctions });
};

// v2 implementation (with enhanced features)
const getAuctionsV2 = async (req, res) => {
    // New implementation with additional fields
    const auctions = await Auction.find().populate('seller');
    res.json({ 
        success: true, 
        data: auctions,
        meta: { version: 'v2', enhanced: true }
    });
};
```

## Error Handling

### Unsupported Version

When a client requests an unsupported version:

```http
HTTP/1.1 406 Not Acceptable
Content-Type: application/json

{
  "success": false,
  "error": {
    "code": "UNSUPPORTED_API_VERSION",
    "message": "API version v3 is not supported",
    "supportedVersions": ["v1", "v2"],
    "timestamp": "2025-11-15T10:00:00.000Z",
    "path": "/api/v3/auctions"
  }
}
```

## Best Practices

### For API Consumers

1. **Always specify version**: Use URL-based versioning for clarity
2. **Monitor deprecation headers**: Check for `Deprecation` and `Sunset` headers
3. **Plan migrations early**: Start migration when deprecation is announced
4. **Test new versions**: Use staging environment to test new API versions
5. **Handle version errors**: Implement proper error handling for 406 responses

### For API Developers

1. **Maintain backward compatibility**: Don't break existing endpoints
2. **Document changes**: Clearly document all changes between versions
3. **Provide migration guides**: Help clients transition to new versions
4. **Use semantic versioning**: Major version for breaking changes
5. **Deprecate gradually**: Give clients sufficient time to migrate

## Breaking Changes

Breaking changes require a new major version. Examples include:

- Removing endpoints or fields
- Changing response structure
- Modifying authentication requirements
- Changing data types
- Altering business logic significantly

## Non-Breaking Changes

Non-breaking changes can be added to existing versions:

- Adding new endpoints
- Adding optional fields to requests
- Adding new fields to responses
- Adding new query parameters
- Improving performance

## Migration Guide Template

When releasing a new version, provide a migration guide:

### Example: Migrating from v1 to v2

**Breaking Changes:**

1. **Auction Response Structure**
   - **v1**: `{ data: [...] }`
   - **v2**: `{ data: [...], meta: {...} }`
   - **Action**: Update response parsing to handle `meta` field

2. **Authentication**
   - **v1**: JWT in `Authorization` header
   - **v2**: JWT in `Authorization` header + API key in `X-API-Key`
   - **Action**: Add API key to all requests

**New Features:**

1. **Enhanced Search**: v2 includes AI-powered search
2. **Real-time Updates**: WebSocket support for live bidding
3. **Batch Operations**: Bulk create/update endpoints

**Migration Steps:**

1. Update client library to v2
2. Add API key to configuration
3. Update response parsing logic
4. Test all endpoints in staging
5. Deploy to production
6. Monitor for errors

## Version Lifecycle

```
Development → Beta → Stable → Deprecated → Sunset → Removed
     ↓          ↓       ↓          ↓          ↓         ↓
   Internal   Limited  Public   6 months   Sunset   Removed
   testing    release  release  warning     date
```

## API Version Information Endpoint

Get information about all API versions:

```bash
GET /api/versions
```

**Response:**
```json
{
  "success": true,
  "data": {
    "current": "v1",
    "supported": ["v1"],
    "deprecated": [],
    "versions": {
      "v1": {
        "status": "stable",
        "releaseDate": "2025-11-15",
        "sunsetDate": null,
        "documentation": "https://api.auction-platform.com/api-docs"
      }
    }
  }
}
```

## Client Libraries

Official client libraries handle versioning automatically:

**Node.js:**
```javascript
const AuctionAPI = require('@auction-platform/api-client');
const client = new AuctionAPI({ version: 'v1', apiKey: 'YOUR_KEY' });
```

**Python:**
```python
from auction_api import Client
client = Client(version='v1', api_key='YOUR_KEY')
```

## Support

For questions about API versioning:

- **Documentation**: https://docs.auction-platform.com
- **Email**: api-support@auction-platform.com
- **GitHub**: https://github.com/auction-platform/api-issues

## Changelog

### v1.0.0 (2025-11-15)
- Initial API release
- Authentication endpoints
- Auction management
- Bidding system
- Payment processing
- Notifications
- Analytics
- AI integration

---

**Last Updated**: November 15, 2025  
**Document Version**: 1.0.0
