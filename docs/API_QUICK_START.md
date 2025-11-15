# API Quick Start Guide

## Getting Started with the AI Auction Platform API

This guide will help you quickly get started with the API documentation, health checks, and versioning features.

## 1. Start the Server

```bash
# Install dependencies (if not already done)
npm install

# Start the development server
npm run dev

# Or start production server
npm start
```

The server will start on `http://localhost:5000` (or the port specified in your `.env` file).

## 2. Access API Documentation

Once the server is running, open your browser and navigate to:

```
http://localhost:5000/api-docs
```

You'll see the interactive Swagger UI with all available endpoints.

## 3. Check System Health

### Basic Health Check

```bash
curl http://localhost:5000/api/v1/health
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T10:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0"
}
```

### Detailed Health Check

```bash
curl http://localhost:5000/api/v1/health/detailed
```

**Response:**
```json
{
  "status": "healthy",
  "timestamp": "2025-11-15T10:00:00.000Z",
  "uptime": 86400,
  "version": "1.0.0",
  "services": {
    "database": {
      "status": "connected",
      "responseTime": 15
    },
    "redis": {
      "status": "connected",
      "responseTime": 5
    },
    "aiModule": {
      "status": "available",
      "responseTime": 120
    }
  },
  "memory": {
    "used": 256,
    "total": 512,
    "percentage": 50,
    "rss": 300
  },
  "responseTime": 145
}
```

## 4. Get API Version Information

```bash
curl http://localhost:5000/api/versions
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
        "documentation": "http://localhost:5000/api-docs",
        "features": [
          "Authentication & Authorization",
          "Auction Management",
          "Real-time Bidding",
          "Payment Processing",
          "AI Integration",
          "Notifications",
          "Analytics & Reporting"
        ]
      }
    }
  }
}
```

## 5. Test Authentication in Swagger UI

### Step 1: Register a User

1. In Swagger UI, find the **Authentication** section
2. Click on `POST /api/v1/auth/register`
3. Click **"Try it out"**
4. Enter the request body:

```json
{
  "email": "test@example.com",
  "password": "SecurePass123!",
  "profile": {
    "firstName": "John",
    "lastName": "Doe"
  },
  "role": "buyer"
}
```

5. Click **"Execute"**
6. Copy the `accessToken` from the response

### Step 2: Authorize in Swagger UI

1. Click the **"Authorize"** button at the top right
2. In the "bearerAuth" field, enter: `Bearer YOUR_ACCESS_TOKEN`
3. Click **"Authorize"**
4. Click **"Close"**

Now you can test all authenticated endpoints!

## 6. Test an Authenticated Endpoint

### Get Current User

1. Find `GET /api/v1/auth/me` in the Authentication section
2. Click **"Try it out"**
3. Click **"Execute"**
4. You should see your user profile in the response

## 7. Using API Versioning

### URL-Based Versioning (Recommended)

```bash
curl http://localhost:5000/api/v1/auctions
```

### Accept Header Versioning

```bash
curl http://localhost:5000/api/auctions \
  -H "Accept: application/vnd.auction-api.v1+json"
```

Both methods work, but URL-based versioning is more explicit and recommended.

## 8. Common API Calls

### List Auctions

```bash
curl http://localhost:5000/api/v1/auctions
```

### Search Auctions

```bash
curl "http://localhost:5000/api/v1/auctions/search?q=camera&category=Electronics"
```

### Get Auction Details

```bash
curl http://localhost:5000/api/v1/auctions/AUCTION_ID
```

### Place a Bid (Authenticated)

```bash
curl -X POST http://localhost:5000/api/v1/bids \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "auction": "AUCTION_ID",
    "amount": 150
  }'
```

## 9. Export OpenAPI Specification

### Download JSON Spec

```bash
curl http://localhost:5000/api-docs.json > openapi-spec.json
```

### Import into Postman

1. Open Postman
2. Click **"Import"**
3. Select **"Link"**
4. Enter: `http://localhost:5000/api-docs.json`
5. Click **"Continue"** and **"Import"**

## 10. Monitor Health in Production

### Set Up Health Check Monitoring

Add these endpoints to your monitoring system:

- **Liveness Probe**: `GET /api/v1/health` (should return 200)
- **Readiness Probe**: `GET /api/v1/health/detailed` (checks all services)

### Example with curl in a loop

```bash
# Check health every 30 seconds
while true; do
  curl -s http://localhost:5000/api/v1/health | jq .
  sleep 30
done
```

## 11. Rate Limiting

Be aware of rate limits:

- **IP-based**: 100 requests per minute
- **User-based**: 1000 requests per hour
- **Auth endpoints**: 10 requests per minute

Check rate limit headers in responses:

```bash
curl -I http://localhost:5000/api/v1/auctions
```

Look for:
```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 95
X-RateLimit-Reset: 1637000000
```

## 12. Error Handling

All errors follow this format:

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

## 13. WebSocket Connection (Real-time)

For real-time bidding updates:

```javascript
const io = require('socket.io-client');

const socket = io('http://localhost:5000', {
  auth: {
    token: 'YOUR_JWT_TOKEN'
  }
});

// Join an auction room
socket.emit('join:auction', { auctionId: 'AUCTION_ID' });

// Listen for new bids
socket.on('bid:new', (data) => {
  console.log('New bid placed:', data);
});

// Listen for auction updates
socket.on('auction:update', (data) => {
  console.log('Auction updated:', data);
});
```

## 14. Useful Endpoints Summary

| Endpoint | Method | Description | Auth Required |
|----------|--------|-------------|---------------|
| `/api-docs` | GET | Interactive API documentation | No |
| `/api-docs.json` | GET | OpenAPI JSON specification | No |
| `/api/versions` | GET | API version information | No |
| `/api/v1/health` | GET | Basic health check | No |
| `/api/v1/health/detailed` | GET | Detailed health check | No |
| `/api/v1/auth/register` | POST | Register new user | No |
| `/api/v1/auth/login` | POST | Login user | No |
| `/api/v1/auth/me` | GET | Get current user | Yes |
| `/api/v1/auctions` | GET | List auctions | No |
| `/api/v1/auctions/:id` | GET | Get auction details | No |
| `/api/v1/bids` | POST | Place a bid | Yes |
| `/api/v1/notifications` | GET | Get notifications | Yes |

## 15. Next Steps

- Read the [API Documentation Guide](./API_DOCUMENTATION_GUIDE.md) for detailed information
- Review the [API Versioning Strategy](./API_VERSIONING.md) for version management
- Check the [Security Documentation](./SECURITY.md) for security best practices
- Explore all endpoints in Swagger UI at `/api-docs`

## Support

Need help?

- **Documentation**: http://localhost:5000/api-docs
- **Health Status**: http://localhost:5000/api/v1/health/detailed
- **Version Info**: http://localhost:5000/api/versions

---

**Happy coding!** 🚀
