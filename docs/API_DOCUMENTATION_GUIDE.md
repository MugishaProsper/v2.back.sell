# API Documentation Guide

## Overview

The AI-Powered Auction Platform API provides comprehensive documentation through Swagger/OpenAPI 3.0. This guide explains how to access and use the API documentation.

## Accessing API Documentation

### Swagger UI (Interactive Documentation)

The interactive API documentation is available at:

```
http://localhost:5000/api-docs
```

**Production:**
```
https://api.auction-platform.com/api-docs
```

### Features:
- Browse all available endpoints
- View request/response schemas
- Test API endpoints directly from the browser
- Authenticate with JWT tokens
- View example requests and responses

### OpenAPI JSON Specification

The raw OpenAPI specification is available at:

```
http://localhost:5000/api-docs.json
```

This can be imported into tools like:
- Postman
- Insomnia
- API testing frameworks
- Code generators

## Using Swagger UI

### 1. Authentication

Most endpoints require authentication. To test authenticated endpoints:

1. Click the **"Authorize"** button at the top right
2. Enter your JWT token in the format: `Bearer YOUR_TOKEN`
3. Click **"Authorize"**
4. Click **"Close"**

**Getting a Token:**

First, register or login:

```bash
# Register
curl -X POST http://localhost:5000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!",
    "role": "buyer"
  }'

# Login
curl -X POST http://localhost:5000/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePass123!"
  }'
```

Copy the `accessToken` from the response and use it in Swagger UI.

### 2. Testing Endpoints

1. Navigate to the endpoint you want to test
2. Click on the endpoint to expand it
3. Click **"Try it out"**
4. Fill in the required parameters
5. Click **"Execute"**
6. View the response below

### 3. Viewing Schemas

All request and response schemas are documented under the **"Schemas"** section at the bottom of the page.

Common schemas:
- `User` - User account information
- `Auction` - Auction details
- `Bid` - Bid information
- `Notification` - Notification data
- `Error` - Error response format

## API Endpoints Overview

### Authentication
- `POST /api/v1/auth/register` - Register new user
- `POST /api/v1/auth/login` - Login user
- `POST /api/v1/auth/refresh-token` - Refresh access token
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout user

### Users
- `GET /api/v1/users/:id` - Get user by ID
- `PUT /api/v1/users/:id` - Update user profile
- `DELETE /api/v1/users/:id` - Delete user account
- `GET /api/v1/users/:id/auctions` - Get user's auctions

### Auctions
- `GET /api/v1/auctions` - List all auctions
- `GET /api/v1/auctions/:id` - Get auction details
- `POST /api/v1/auctions` - Create new auction
- `PUT /api/v1/auctions/:id` - Update auction
- `DELETE /api/v1/auctions/:id` - Delete auction
- `POST /api/v1/auctions/:id/images` - Upload auction images
- `GET /api/v1/auctions/search` - Search auctions

### Bids
- `GET /api/v1/bids/auction/:auctionId` - Get auction bid history
- `POST /api/v1/bids` - Place a bid
- `GET /api/v1/bids/user/:userId` - Get user's bid history

### Notifications
- `GET /api/v1/notifications` - Get user notifications
- `PUT /api/v1/notifications/:id/read` - Mark notification as read
- `PUT /api/v1/notifications/preferences` - Update notification preferences

### Analytics (Admin Only)
- `GET /api/v1/analytics/dashboard` - Get dashboard statistics
- `GET /api/v1/analytics/auctions/stats` - Get auction statistics
- `GET /api/v1/analytics/users/stats` - Get user statistics
- `GET /api/v1/analytics/export` - Export analytics data

### Health & System
- `GET /api/v1/health` - Basic health check
- `GET /api/v1/health/detailed` - Detailed health check
- `GET /api/versions` - Get API version information

## Response Format

### Success Response

```json
{
  "success": true,
  "data": {
    // Response data
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2025-11-15T10:00:00.000Z",
    "path": "/api/v1/endpoint",
    "requestId": "uuid"
  }
}
```

## Common Error Codes

| Code | Status | Description |
|------|--------|-------------|
| `AUTH_INVALID_TOKEN` | 401 | Invalid or expired JWT token |
| `AUTH_INVALID_CREDENTIALS` | 401 | Invalid email or password |
| `AUTH_INSUFFICIENT_PERMISSIONS` | 403 | User lacks required permissions |
| `VALIDATION_FAILED` | 400 | Request validation failed |
| `RESOURCE_NOT_FOUND` | 404 | Requested resource not found |
| `BID_TOO_LOW` | 422 | Bid amount is too low |
| `AUCTION_CLOSED` | 422 | Auction is no longer active |
| `RATE_LIMIT_EXCEEDED` | 429 | Too many requests |
| `INTERNAL_SERVER_ERROR` | 500 | Server error occurred |

## Rate Limits

- **IP-based**: 100 requests per minute per IP
- **User-based**: 1000 requests per hour per authenticated user
- **Strict endpoints** (auth): 10 requests per minute

Rate limit headers are included in responses:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637000000
```

## Pagination

List endpoints support pagination:

**Query Parameters:**
- `page` - Page number (default: 1)
- `limit` - Items per page (default: 10, max: 100)
- `sort` - Sort field (e.g., `createdAt`, `-price`)

**Example:**
```
GET /api/v1/auctions?page=2&limit=20&sort=-createdAt
```

**Response includes pagination metadata:**
```json
{
  "success": true,
  "data": [...],
  "pagination": {
    "page": 2,
    "limit": 20,
    "total": 150,
    "pages": 8
  }
}
```

## Filtering and Search

### Text Search
```
GET /api/v1/auctions/search?q=vintage+camera
```

### Filtering
```
GET /api/v1/auctions?category=Electronics&status=active
```

### Price Range
```
GET /api/v1/auctions?minPrice=100&maxPrice=500
```

### Combined
```
GET /api/v1/auctions/search?q=camera&category=Electronics&minPrice=100&maxPrice=500&sort=-createdAt
```

## WebSocket Events (Real-time)

Connect to Socket.IO for real-time updates:

```javascript
const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Join auction room
socket.emit('join:auction', { auctionId: '507f1f77bcf86cd799439011' });

// Listen for new bids
socket.on('bid:new', (data) => {
  console.log('New bid:', data);
});

// Listen for auction updates
socket.on('auction:update', (data) => {
  console.log('Auction updated:', data);
});
```

## Code Examples

### Node.js (axios)

```javascript
const axios = require('axios');

const API_URL = 'http://localhost:5000/api/v1';
const token = 'YOUR_JWT_TOKEN';

// Get auctions
const getAuctions = async () => {
  try {
    const response = await axios.get(`${API_URL}/auctions`, {
      headers: {
        'Authorization': `Bearer ${token}`
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
};

// Place a bid
const placeBid = async (auctionId, amount) => {
  try {
    const response = await axios.post(`${API_URL}/bids`, {
      auction: auctionId,
      amount: amount
    }, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    console.log(response.data);
  } catch (error) {
    console.error(error.response.data);
  }
};
```

### Python (requests)

```python
import requests

API_URL = 'http://localhost:5000/api/v1'
token = 'YOUR_JWT_TOKEN'

headers = {
    'Authorization': f'Bearer {token}',
    'Content-Type': 'application/json'
}

# Get auctions
response = requests.get(f'{API_URL}/auctions', headers=headers)
print(response.json())

# Place a bid
bid_data = {
    'auction': '507f1f77bcf86cd799439011',
    'amount': 150
}
response = requests.post(f'{API_URL}/bids', json=bid_data, headers=headers)
print(response.json())
```

### cURL

```bash
# Get auctions
curl -X GET http://localhost:5000/api/v1/auctions \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"

# Place a bid
curl -X POST http://localhost:5000/api/v1/bids \
  -H "Authorization: Bearer YOUR_JWT_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auction": "507f1f77bcf86cd799439011",
    "amount": 150
  }'
```

## Generating Client Code

You can generate client libraries from the OpenAPI specification:

### Using OpenAPI Generator

```bash
# Install OpenAPI Generator
npm install @openapitools/openapi-generator-cli -g

# Generate TypeScript client
openapi-generator-cli generate \
  -i http://localhost:5000/api-docs.json \
  -g typescript-axios \
  -o ./generated-client

# Generate Python client
openapi-generator-cli generate \
  -i http://localhost:5000/api-docs.json \
  -g python \
  -o ./generated-client
```

## Postman Collection

Import the OpenAPI spec into Postman:

1. Open Postman
2. Click **"Import"**
3. Select **"Link"**
4. Enter: `http://localhost:5000/api-docs.json`
5. Click **"Continue"** and **"Import"**

## Support

For API documentation issues or questions:

- **GitHub Issues**: Report documentation bugs
- **Email**: api-support@auction-platform.com
- **Documentation**: https://docs.auction-platform.com

## Best Practices

1. **Always authenticate**: Include JWT token in Authorization header
2. **Handle errors**: Check `success` field and handle error responses
3. **Respect rate limits**: Implement exponential backoff for retries
4. **Use pagination**: Don't fetch all records at once
5. **Cache responses**: Cache data when appropriate
6. **Monitor deprecations**: Check for deprecation headers
7. **Use HTTPS**: Always use HTTPS in production
8. **Validate input**: Validate data before sending requests
9. **Handle timeouts**: Set appropriate timeout values
10. **Log requests**: Log API requests for debugging

---

**Last Updated**: November 15, 2025  
**API Version**: v1.0.0
