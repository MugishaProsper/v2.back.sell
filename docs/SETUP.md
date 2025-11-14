# Project Setup Documentation

## Core Infrastructure Setup Complete

This document describes the core infrastructure that has been set up for the AI-powered auction backend.

## ✅ Completed Setup

### 1. Project Structure

```
src/
├── config/              # Configuration files
│   ├── db.config.js         # MongoDB with connection pooling
│   ├── redis.config.js      # Redis for caching and queues
│   ├── logger.js            # Winston logger configuration
│   └── email.config.js      # Email service configuration
├── controllers/         # Route controllers
├── middlewares/         # Express middlewares
│   ├── auth.middlewares.js
│   ├── error.middleware.js  # Centralized error handling
│   └── logger.middleware.js # Request/response logging
├── models/             # Mongoose models
├── repositories/       # Data access layer (repository pattern)
├── routes/             # API routes
├── services/           # Business logic layer
├── utils/              # Utility functions
│   ├── asyncHandler.js      # Async error wrapper
│   └── testConnections.js   # Connection testing utility
└── server.js           # Application entry point
```

### 2. Dependencies Installed

**Core Framework:**
- `express` (v5.1.0) - Web framework
- `dotenv` - Environment variable management

**Database & Caching:**
- `mongoose` - MongoDB ODM with connection pooling
- `ioredis` - Redis client for caching
- `redis` - Alternative Redis client
- `bull` - Job queue system (Redis-based)

**Security:**
- `helmet` - Security headers
- `cors` - Cross-origin resource sharing
- `express-rate-limit` - Rate limiting
- `bcrypt` - Password hashing
- `jsonwebtoken` - JWT authentication

**Utilities:**
- `winston` - Logging framework
- `uuid` - Unique ID generation
- `cookie-parser` - Cookie parsing
- `nodemailer` - Email sending

### 3. Environment Configuration

Complete `.env.example` created with:
- MongoDB configuration (with pool size settings)
- Redis configuration
- JWT secrets and expiry settings
- AI module URLs (REST and gRPC)
- Payment gateway credentials (Stripe/PayPal)
- Email service configuration
- Rate limiting settings

### 4. MongoDB Connection

**Features:**
- Connection pooling (min: 10, max: 100 connections)
- Automatic reconnection handling
- Connection event logging
- Graceful error handling
- Server selection timeout: 5 seconds
- Socket timeout: 45 seconds

**File:** `src/config/db.config.js`

### 5. Redis Connection

**Features:**
- Two separate Redis clients:
  - `redisClient` - General caching
  - `redisQueueClient` - Bull job queues
- Automatic retry strategy
- Connection event logging
- Error handling
- Max retries per request: 3

**File:** `src/config/redis.config.js`

### 6. Centralized Error Handling

**Features:**
- Custom `ApiError` class for operational errors
- Consistent error response format
- Automatic handling of:
  - Mongoose validation errors
  - Duplicate key errors
  - Cast errors
  - JWT errors
- Error logging with context
- Request ID tracking

**Error Response Format:**
```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable message",
    "details": {},
    "timestamp": "ISO 8601 timestamp",
    "path": "/api/v1/endpoint",
    "requestId": "unique-id"
  }
}
```

**Files:**
- `src/middlewares/error.middleware.js`
- Exports: `errorHandler`, `notFoundHandler`, `ApiError`

### 7. Async Error Wrapper

**Purpose:** Eliminates try-catch boilerplate in async route handlers

**Usage:**
```javascript
import { asyncHandler } from '../utils/asyncHandler.js';

router.get('/endpoint', asyncHandler(async (req, res) => {
    // Any errors thrown here are automatically caught
    const data = await someAsyncOperation();
    res.json(data);
}));
```

**File:** `src/utils/asyncHandler.js`

### 8. Request Logging Middleware

**Features:**
- Unique request ID generation (UUID v4)
- Request logging (method, URL, IP, user agent)
- Response logging (status code, duration)
- X-Request-Id header in responses
- Automatic log level selection:
  - `error` for 5xx responses
  - `warn` for 4xx responses
  - `info` for 2xx/3xx responses

**File:** `src/middlewares/logger.middleware.js`

### 9. Winston Logger Configuration

**Features:**
- Structured JSON logging
- Console and file transports
- Color-coded console output
- Timestamp formatting
- Log levels: error, warn, info, debug
- Exception handling
- Log file: `logs/app.log`

**File:** `src/config/logger.js`

### 10. Security Middleware

**Implemented in server.js:**
- **Helmet.js** - Sets secure HTTP headers
- **CORS** - Configurable origin whitelist
- **Rate Limiting** - 100 requests/minute per IP
- **Body Parsing** - 10MB limit
- **Cookie Parser** - Secure cookie handling

### 11. Server Configuration

**Features:**
- Environment-based configuration
- Graceful startup with connection checks
- Health check endpoint (`/health`)
- Unhandled rejection handling
- Uncaught exception handling
- Process exit on critical errors

**File:** `src/server.js`

## 🧪 Testing the Setup

### Test Database and Redis Connections

```bash
npm run test:connections
```

This will:
1. Connect to MongoDB
2. Connect to Redis
3. Perform a test Redis operation
4. Report success or failure

### Start the Development Server

```bash
npm run dev
```

### Check Health Endpoint

```bash
curl http://localhost:5000/health
```

Expected response:
```json
{
  "success": true,
  "message": "API is running",
  "timestamp": "2025-11-14T10:00:00.000Z",
  "uptime": 123.456
}
```

## 📋 Next Steps

The core infrastructure is complete. You can now proceed with:

1. **Task 2:** Authentication and Authorization System
2. **Task 3:** User Management Module
3. **Task 4:** Auction Management System
4. And so on...

## 🔧 Configuration Checklist

Before running the application, ensure:

- [ ] MongoDB is running and accessible
- [ ] Redis is running and accessible
- [ ] `.env` file is created from `.env.example`
- [ ] All environment variables are configured
- [ ] JWT secrets are set to secure random strings
- [ ] Database connection string is correct
- [ ] Redis host and port are correct

## 📝 Important Notes

### Connection Pooling

MongoDB connection pool is configured for production workloads:
- Minimum 10 connections always maintained
- Maximum 100 connections under load
- Adjust `MONGO_MIN_POOL_SIZE` and `MONGO_MAX_POOL_SIZE` based on your needs

### Rate Limiting

Default rate limit is 100 requests per minute per IP address. Adjust in `.env`:
```
RATE_LIMIT_WINDOW_MS=60000
RATE_LIMIT_MAX_REQUESTS=100
```

### Logging

Logs are written to:
- Console (all environments)
- `logs/app.log` (file)

In production, consider:
- Log rotation (use `winston-daily-rotate-file`)
- External log aggregation (ELK stack, CloudWatch, etc.)

### Error Handling

All route handlers should use `asyncHandler` wrapper:
```javascript
import { asyncHandler } from '../utils/asyncHandler.js';

router.post('/endpoint', asyncHandler(async (req, res) => {
    // Your async code here
}));
```

For custom errors, use `ApiError`:
```javascript
import { ApiError } from '../middlewares/error.middleware.js';

throw new ApiError(400, 'INVALID_INPUT', 'Email is required');
```

## 🚀 Performance Considerations

### MongoDB
- Indexes will be added as models are created
- Connection pooling handles concurrent requests
- Query optimization will be done per feature

### Redis
- Used for caching frequently accessed data
- Separate client for Bull job queues
- TTL-based cache expiration

### Background Jobs
- Bull queue configured for async operations
- Email notifications
- AI webhook dispatch
- Analytics aggregation
- Auction expiration checks

## 🔒 Security Features

1. **Helmet.js** - Secure HTTP headers
2. **CORS** - Origin whitelist
3. **Rate Limiting** - DDoS protection
4. **JWT** - Stateless authentication
5. **bcrypt** - Password hashing (12 rounds)
6. **Input Validation** - To be added per endpoint
7. **Error Sanitization** - No stack traces in production

## 📚 References

- [Express.js Documentation](https://expressjs.com/)
- [Mongoose Documentation](https://mongoosejs.com/)
- [Redis Documentation](https://redis.io/docs/)
- [Winston Documentation](https://github.com/winstonjs/winston)
- [Bull Documentation](https://github.com/OptimalBits/bull)
