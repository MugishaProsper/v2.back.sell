# AI Integration Quick Start Guide

## Overview

This guide will help you quickly get started with the AI Module Integration in the auction backend.

## Prerequisites

- Node.js 18+ installed
- MongoDB running
- Redis running
- Environment variables configured

## Quick Setup

### 1. Install Dependencies

Dependencies are already installed. Verify with:

```bash
npm list @grpc/grpc-js @grpc/proto-loader axios
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update:

```env
# For Development (Mock AI)
USE_MOCK_AI=true
AI_MODULE_URL=http://localhost:8000
AI_MODULE_GRPC_URL=localhost:50051
AI_WEBHOOK_SECRET=dev_secret_change_in_production
```

### 3. Start the Server

```bash
npm start
```

The server will:
- ✅ Initialize AI Integration Service
- ✅ Initialize gRPC client (or use mock if unavailable)
- ✅ Set up webhook queues
- ✅ Register webhook receiver endpoints

## Verify Integration

### Check Server Logs

Look for these log messages on startup:

```
✓ AI webhook queue processors initialized
✓ gRPC client initialized for AI module at localhost:50051
  (or "Using mock AI service - gRPC client not initialized")
✓ Queue ai-webhooks initialized
✓ Server is running on port 5000
```

### Test Mock AI Features

#### 1. Create an Auction

When you create an auction, a webhook is automatically queued:

```bash
POST /api/v1/auctions
```

Check logs for:
```
Queued auction-created webhook for auction {id}, job {jobId}
```

#### 2. Place a Bid

When you place a bid:
- Webhook is queued for AI module
- Fraud detection runs automatically

```bash
POST /api/v1/bids
```

Check logs for:
```
Fraud analysis completed for bid {id} in {time}ms
Queued bid-placed webhook for bid {id}, job {jobId}
```

#### 3. Test Webhook Receivers

Test the webhook endpoints:

```bash
# Price Prediction Update
curl -X POST http://localhost:5000/api/v1/webhooks/ai/prediction-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: dev_secret_change_in_production" \
  -d '{
    "auctionId": "YOUR_AUCTION_ID",
    "predictedPrice": 1500,
    "confidence": 0.85,
    "priceRange": { "min": 1200, "max": 1800 }
  }'

# Expected Response:
{
  "success": true,
  "message": "Price prediction updated successfully",
  "data": {
    "auctionId": "...",
    "aiInsights": { ... }
  }
}
```

## Development Mode Features

With `USE_MOCK_AI=true`, you get:

### ✅ Mock Price Predictions
- Automatically returns 1.3x-2x starting price
- Based on auction category
- Includes confidence scores and price ranges

### ✅ Mock Fraud Detection
- Returns low risk scores (0-0.3)
- Occasionally flags suspicious patterns
- No external AI module needed

### ✅ Mock Recommendations
- Returns random auction recommendations
- Includes relevance scores
- Works with any user data

### ✅ Automatic Fallback
- If real AI module fails, automatically uses mock
- Circuit breaker prevents cascading failures
- Graceful degradation

## Production Setup

### 1. Update Environment

```env
USE_MOCK_AI=false
AI_MODULE_URL=https://your-ai-module.com
AI_MODULE_GRPC_URL=your-ai-module.com:50051
AI_WEBHOOK_SECRET=your_secure_random_secret_here
AI_MODULE_ALLOWED_IPS=1.2.3.4,5.6.7.8
```

### 2. Configure AI Module

Ensure your AI module:
- Exposes REST API at `AI_MODULE_URL`
- Runs gRPC server at `AI_MODULE_GRPC_URL`
- Uses same `AI_WEBHOOK_SECRET` for callbacks
- Implements the webhook endpoints:
  - `/webhooks/auction-created`
  - `/webhooks/bid-placed`
  - `/webhooks/auction-ended`

### 3. Test Connection

Check circuit breaker status:

```javascript
import aiIntegrationService from './src/services/ai-integration.service.js';

const status = aiIntegrationService.getCircuitBreakerStatus();
console.log(status);
// { state: 'CLOSED', failureCount: 0, nextAttempt: ... }
```

## Monitoring

### Queue Statistics

```javascript
import aiWebhookService from './src/services/ai-webhook.service.js';

const stats = await aiWebhookService.getQueueStats();
console.log(stats);
// { waiting: 0, active: 0, completed: 10, failed: 0, delayed: 0, total: 10 }
```

### Failed Jobs

```javascript
// Clear failed jobs
await aiWebhookService.clearFailedJobs();

// Retry failed jobs
await aiWebhookService.retryFailedJobs();
```

## Common Issues

### Issue: "gRPC client initialization failed"

**Solution:** This is normal in development. The system automatically uses mock AI.

### Issue: "Circuit breaker is OPEN"

**Solution:** 
1. Check AI module availability
2. Wait 60 seconds for automatic retry
3. System uses mock responses while OPEN

### Issue: "Webhook authentication failed"

**Solution:** 
1. Verify `AI_WEBHOOK_SECRET` matches
2. Check header: `X-Webhook-Secret`
3. Ensure secret is not empty

## API Endpoints

### Webhook Receivers (AI Module → Backend)

```
POST /api/v1/webhooks/ai/prediction-update
POST /api/v1/webhooks/ai/fraud-alert
POST /api/v1/webhooks/ai/insights
```

All require header: `X-Webhook-Secret: {your_secret}`

### Outgoing Webhooks (Backend → AI Module)

```
POST {AI_MODULE_URL}/webhooks/auction-created
POST {AI_MODULE_URL}/webhooks/bid-placed
POST {AI_MODULE_URL}/webhooks/auction-ended
```

All include header: `X-Webhook-Secret: {your_secret}`

## Performance Metrics

### Fraud Detection
- **Target:** < 500ms per bid
- **Implementation:** Asynchronous after bid placement
- **Fallback:** Mock detection if timeout

### Webhook Processing
- **Queue:** Bull with Redis
- **Retry:** 3 attempts with exponential backoff
- **Timeout:** 10 seconds per job

### Caching
- **TTL:** 1 hour for all AI responses
- **Storage:** Redis
- **Prefix:** `ai:`

## Next Steps

1. ✅ Verify server starts successfully
2. ✅ Test auction creation (webhook queued)
3. ✅ Test bid placement (fraud detection + webhook)
4. ✅ Test webhook receivers with curl
5. ✅ Monitor queue statistics
6. ✅ Check circuit breaker status

## Support

For detailed documentation, see:
- `docs/AI_INTEGRATION.md` - Complete integration guide
- `docs/AI_INTEGRATION_SUMMARY.md` - Implementation summary

For issues:
1. Check `logs/app.log`
2. Verify environment variables
3. Test with `USE_MOCK_AI=true`
4. Review circuit breaker status
5. Check queue statistics

## Success Indicators

You'll know the integration is working when:

✅ Server starts without errors
✅ Auction creation queues webhook
✅ Bid placement triggers fraud detection
✅ Webhook receivers accept requests
✅ Circuit breaker state is CLOSED
✅ Queue processes jobs successfully
✅ Mock AI returns realistic data

Happy coding! 🚀
