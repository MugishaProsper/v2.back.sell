# AI-Powered Auction Backend

Backend API for an AI-powered digital auction marketplace built with Node.js, Express, MongoDB, and Redis.

## Features

- **RESTful API** with Express.js
- **MongoDB** with Mongoose ODM and connection pooling
- **Redis** for caching and job queues
- **JWT Authentication** with access and refresh tokens
- **Real-time Communication** ready (Socket.IO support)
- **AI Module Integration** via REST and gRPC
- **Payment Gateway Integration** (Stripe/PayPal)
- **Rate Limiting** and security middleware
- **Centralized Error Handling**
- **Request Logging** with Winston
- **Background Job Processing** with Bull
- **Swagger/OpenAPI Documentation** - Interactive API documentation
- **Health Check Endpoints** - System and service monitoring
- **API Versioning** - URL and header-based version negotiation

## Prerequisites

- Node.js 18+ (LTS)
- MongoDB 6.x
- Redis 7.x
- npm or yarn

## Installation

1. Clone the repository:
```bash
git clone <repository-url>
cd backend
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
```

Edit `.env` and configure your environment variables:
- MongoDB connection string
- Redis connection details
- JWT secrets (generate secure random strings)
- AI module URLs
- Payment gateway credentials
- Email service configuration

## Environment Variables

### Required Variables

| Variable | Description | Example |
|----------|-------------|---------|
| `NODE_ENV` | Environment mode | `development`, `production` |
| `PORT` | Server port | `5000` |
| `MONGO_URI` | MongoDB connection string | `mongodb://localhost:27017/ai_auction_db` |
| `MONGO_MIN_POOL_SIZE` | Min MongoDB connections | `10` |
| `MONGO_MAX_POOL_SIZE` | Max MongoDB connections | `100` |
| `REDIS_HOST` | Redis host | `localhost` |
| `REDIS_PORT` | Redis port | `6379` |
| `JWT_ACCESS_SECRET` | JWT access token secret | `your_secret_here` |
| `JWT_REFRESH_SECRET` | JWT refresh token secret | `your_secret_here` |
| `JWT_ACCESS_EXPIRY` | Access token expiry | `15m` |
| `JWT_REFRESH_EXPIRY` | Refresh token expiry | `7d` |

See `.env.example` for complete list of environment variables.

## Project Structure

```
src/
├── config/           # Configuration files
│   ├── db.config.js      # MongoDB connection
│   ├── redis.config.js   # Redis connection
│   ├── logger.js         # Winston logger
│   └── email.config.js   # Email configuration
├── controllers/      # Route controllers
├── middlewares/      # Express middlewares
│   ├── auth.middlewares.js
│   ├── error.middleware.js
│   └── logger.middleware.js
├── models/          # Mongoose models
├── repositories/    # Data access layer
├── routes/          # API routes
├── services/        # Business logic
├── utils/           # Utility functions
│   └── asyncHandler.js
└── server.js        # Application entry point
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

## API Documentation

### Interactive Documentation (Swagger UI)

Access the interactive API documentation at:

```
http://localhost:5000/api-docs
```

Features:
- Browse all available endpoints
- Test API calls directly from the browser
- View request/response schemas
- Authenticate with JWT tokens
- See example requests and responses

### OpenAPI Specification

Download the OpenAPI JSON specification:

```
http://localhost:5000/api-docs.json
```

Import this into Postman, Insomnia, or other API tools.

### Quick Start

See [API Quick Start Guide](./docs/API_QUICK_START.md) for a step-by-step guide to using the API.

### Health Check Endpoints

**Basic Health Check:**
```
GET /api/v1/health
```
Returns server status and uptime (< 500ms response time).

**Detailed Health Check:**
```
GET /api/v1/health/detailed
```
Returns comprehensive health information including:
- Database connectivity
- Redis connectivity
- AI Module availability
- Memory usage
- Response times

### API Version Information

```
GET /api/versions
```

Returns information about all supported API versions, their status, and features.

### API Endpoints

All API endpoints are prefixed with `/api/v1`:

- `/api/v1/auth` - Authentication endpoints
- `/api/v1/users` - User management
- `/api/v1/auctions` - Auction management
- `/api/v1/bids` - Bidding system
- `/api/v1/payments` - Payment processing
- `/api/v1/notifications` - Notifications
- `/api/v1/analytics` - Analytics and reporting
- `/api/v1/webhooks` - Webhook receivers
- `/api/v1/health` - Health check endpoints

### Documentation Resources

- [API Quick Start Guide](./docs/API_QUICK_START.md) - Get started quickly
- [API Documentation Guide](./docs/API_DOCUMENTATION_GUIDE.md) - Comprehensive API guide
- [API Versioning Strategy](./docs/API_VERSIONING.md) - Version management details
- [Security Documentation](./docs/SECURITY.md) - Security best practices

## Security Features

- **Helmet.js** - Security headers
- **CORS** - Cross-origin resource sharing
- **Rate Limiting** - 100 requests per minute per IP
- **JWT Authentication** - Stateless authentication
- **Input Validation** - Request validation
- **Error Handling** - Centralized error management

## Error Response Format

All errors follow a consistent format:

```json
{
  "success": false,
  "error": {
    "code": "ERROR_CODE",
    "message": "Human-readable error message",
    "details": {},
    "timestamp": "2025-11-14T10:00:00.000Z",
    "path": "/api/v1/endpoint",
    "requestId": "unique-request-id"
  }
}
```

## Logging

Logs are written to:
- Console (all environments)
- `logs/app.log` (file)

Log levels: `error`, `warn`, `info`, `debug`

## Database Connection Pooling

MongoDB connection pool configuration:
- Minimum pool size: 10 connections
- Maximum pool size: 100 connections
- Server selection timeout: 5 seconds
- Socket timeout: 45 seconds

## Redis Configuration

Two Redis clients are configured:
1. **redisClient** - General caching
2. **redisQueueClient** - Bull job queues

## Background Jobs

Bull queue is configured for:
- Email notifications
- AI webhook dispatch
- Analytics aggregation
- Auction expiration checks

## Testing

```bash
npm test
```

## Troubleshooting

### MongoDB Connection Issues
- Verify MongoDB is running: `mongosh`
- Check connection string in `.env`
- Ensure network access to MongoDB server

### Redis Connection Issues
- Verify Redis is running: `redis-cli ping`
- Check Redis host and port in `.env`
- Ensure Redis password is correct (if set)

### Port Already in Use
- Change `PORT` in `.env`
- Kill process using the port: `lsof -ti:5000 | xargs kill`

## License

ISC
