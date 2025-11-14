# AI Module Integration Documentation

## Overview

The AI-powered auction backend integrates with an external AI module to provide intelligent features including:
- Price predictions for auctions
- Real-time fraud detection for bids
- Personalized recommendations for users
- Bid pattern analysis
- Market insights

## Architecture

The integration uses two communication protocols:

1. **Webhooks (REST)**: Asynchronous communication for non-critical operations
2. **gRPC**: Synchronous, low-latency communication for critical operations (fraud detection)

### Communication Flow

```
Backend → AI Module (Webhooks):
- Auction created
- Bid placed
- Auction ended

AI Module → Backend (Webhooks):
- Price prediction updates
- Fraud alerts
- General insights

Backend ↔ AI Module (gRPC):
- Real-time fraud detection (< 500ms)
```

## Configuration

### Environment Variables

Add the following to your `.env` file:

```env
# AI Module Configuration
AI_MODULE_URL=http://localhost:8000
AI_MODULE_GRPC_URL=localhost:50051
AI_WEBHOOK_SECRET=your_secure_secret_here
USE_MOCK_AI=true
AI_MODULE_ALLOWED_IPS=127.0.0.1,::1
```

### Configuration Options

- `AI_MODULE_URL`: Base URL for AI module REST API
- `AI_MODULE_GRPC_URL`: gRPC server address (host:port)
- `AI_WEBHOOK_SECRET`: Shared secret for webhook authentication
- `USE_MOCK_AI`: Set to `true` to use mock AI responses (development mode)
- `AI_MODULE_ALLOWED_IPS`: Comma-separated list of allowed IPs for webhooks (optional)

## Features

### 1. Outgoing Webhooks to AI Module

The backend automatically triggers webhooks to the AI module for the following events:

#### Auction Created
```
POST {AI_MODULE_URL}/webhooks/auction-created
```
**Payload:**
```json
{
  "auctionId": "string",
  "title": "string",
  "description": "string",
  "category": "string",
  "startingPrice": number,
  "images": ["url1", "url2"],
  "timing": {
    "startTime": "ISO8601",
    "endTime": "ISO8601",
    "duration": number
  },
  "seller": "userId",
  "createdAt": "ISO8601"
}
```

#### Bid Placed
```
POST {AI_MODULE_URL}/webhooks/bid-placed
```
**Payload:**
```json
{
  "bidId": "string",
  "auctionId": "string",
  "userId": "string",
  "amount": number,
  "timestamp": "ISO8601",
  "auction": {
    "title": "string",
    "category": "string",
    "currentPrice": number,
    "totalBids": number
  },
  "userHistory": {
    "totalBids": number,
    "auctionsWon": number,
    "totalSpent": number,
    "averageBidAmount": number
  },
  "metadata": {
    "ipAddress": "string",
    "userAgent": "string"
  }
}
```

#### Auction Ended
```
POST {AI_MODULE_URL}/webhooks/auction-ended
```
**Payload:**
```json
{
  "auctionId": "string",
  "title": "string",
  "category": "string",
  "finalPrice": number,
  "startingPrice": number,
  "totalBids": number,
  "duration": number,
  "timing": {
    "startTime": "ISO8601",
    "endTime": "ISO8601"
  },
  "winner": {
    "bidId": "string",
    "userId": "string",
    "amount": number
  },
  "seller": "userId",
  "status": "string"
}
```

### 2. Incoming Webhooks from AI Module

The backend exposes the following webhook endpoints for AI module callbacks:

#### Price Prediction Update
```
POST /api/v1/webhooks/ai/prediction-update
```
**Headers:**
```
X-Webhook-Secret: {AI_WEBHOOK_SECRET}
```
**Payload:**
```json
{
  "auctionId": "string",
  "predictedPrice": number,
  "confidence": number,
  "priceRange": {
    "min": number,
    "max": number
  },
  "timestamp": "ISO8601"
}
```

#### Fraud Alert
```
POST /api/v1/webhooks/ai/fraud-alert
```
**Headers:**
```
X-Webhook-Secret: {AI_WEBHOOK_SECRET}
```
**Payload:**
```json
{
  "bidId": "string",
  "riskScore": number,
  "reasons": ["string"],
  "recommendedAction": "string",
  "timestamp": "ISO8601"
}
```

#### General Insights
```
POST /api/v1/webhooks/ai/insights
```
**Headers:**
```
X-Webhook-Secret: {AI_WEBHOOK_SECRET}
```
**Payload:**
```json
{
  "type": "auction|bid|user",
  "entityId": "string",
  "insights": {},
  "timestamp": "ISO8601"
}
```

### 3. gRPC Fraud Detection

The backend uses gRPC for real-time fraud detection on every bid placement.

#### Protocol Buffer Definition

See `src/proto/fraud_detection.proto` for the complete definition.

**Service:**
```protobuf
service FraudDetection {
  rpc AnalyzeBid (BidRequest) returns (FraudResponse);
}
```

**Request:**
```protobuf
message BidRequest {
  string bid_id = 1;
  string auction_id = 2;
  string user_id = 3;
  double amount = 4;
  string timestamp = 5;
  string ip_address = 6;
  string user_agent = 7;
  UserHistory user_history = 8;
}
```

**Response:**
```protobuf
message FraudResponse {
  string bid_id = 1;
  double risk_score = 2;
  bool is_fraudulent = 3;
  repeated string reasons = 4;
  double confidence = 5;
  string analyzed_at = 6;
  string recommended_action = 7;
}
```

## Mock AI Service

For development and testing without the AI module, the backend includes a mock AI service.

### Enabling Mock Mode

Set `USE_MOCK_AI=true` in your `.env` file.

### Mock Features

1. **Price Prediction**: Returns 1.3x - 2x starting price based on category
2. **Fraud Detection**: Returns low risk scores (0-0.3) with occasional flags
3. **Recommendations**: Returns random auctions with scores
4. **Bid Pattern Analysis**: Returns normal patterns with occasional alerts
5. **Market Insights**: Returns mock market data

## Circuit Breaker

The AI integration includes a circuit breaker to prevent cascading failures:

- **Threshold**: 5 consecutive failures
- **Timeout**: 60 seconds
- **States**: CLOSED (normal), OPEN (failing), HALF_OPEN (testing recovery)

When the circuit breaker is OPEN, the system automatically falls back to mock AI responses.

## Retry Logic

All AI module calls include exponential backoff retry logic:

- **Max Retries**: 3 attempts
- **Initial Delay**: 1 second
- **Backoff**: Exponential (1s, 2s, 4s)
- **Timeout**: 5 seconds per attempt

## Caching

AI responses are cached in Redis to improve performance:

- **Price Predictions**: 1 hour TTL
- **Fraud Analysis**: 1 hour TTL
- **Recommendations**: 1 hour TTL

Cache keys are prefixed with `ai:` for easy identification.

## Queue Processing

Outgoing webhooks are processed asynchronously using Bull queues:

- **Queue Name**: `ai-webhooks`
- **Priority Levels**: 
  - High (1): Bid placed
  - Medium (2): Auction created, Auction ended
- **Retry Policy**: 3 attempts with exponential backoff
- **Timeout**: 10 seconds per job

### Queue Management

Monitor queue statistics:
```javascript
import aiWebhookService from './services/ai-webhook.service.js';

const stats = await aiWebhookService.getQueueStats();
// Returns: { waiting, active, completed, failed, delayed, total }
```

Clear failed jobs:
```javascript
await aiWebhookService.clearFailedJobs();
```

Retry failed jobs:
```javascript
await aiWebhookService.retryFailedJobs();
```

## Security

### Webhook Authentication

All incoming webhooks from the AI module must include the shared secret:

```
X-Webhook-Secret: {AI_WEBHOOK_SECRET}
```

Invalid or missing secrets result in 401/403 responses.

### IP Whitelisting (Optional)

Restrict webhook access to specific IPs by setting:

```env
AI_MODULE_ALLOWED_IPS=192.168.1.100,192.168.1.101
```

## Error Handling

The AI integration is designed for graceful degradation:

1. **AI Module Unavailable**: Falls back to mock responses
2. **Webhook Failures**: Queued for retry, doesn't block operations
3. **gRPC Failures**: Falls back to mock fraud detection
4. **Circuit Breaker Open**: Automatically uses mock responses

All errors are logged but don't prevent core auction/bidding functionality.

## Performance

### Fraud Detection
- **Target**: < 500ms per bid
- **Implementation**: Asynchronous analysis after bid placement
- **Fallback**: Mock detection if timeout exceeded

### Webhook Dispatch
- **Processing**: Asynchronous via Bull queue
- **Impact**: Zero impact on bid/auction operations
- **Retry**: Automatic with exponential backoff

### Real-time Updates
- **Broadcast**: < 1 second via Socket.IO
- **Caching**: Redis for frequently accessed predictions

## Monitoring

### Circuit Breaker Status

Check circuit breaker state:
```javascript
import aiIntegrationService from './services/ai-integration.service.js';

const status = aiIntegrationService.getCircuitBreakerStatus();
// Returns: { state, failureCount, nextAttempt }
```

### Queue Metrics

Monitor webhook queue health:
```javascript
const stats = await aiWebhookService.getQueueStats();
console.log(`Active jobs: ${stats.active}`);
console.log(`Failed jobs: ${stats.failed}`);
```

## Testing

### Testing with Mock AI

1. Set `USE_MOCK_AI=true`
2. All AI features work with mock responses
3. No external AI module required

### Testing Webhooks

Use tools like Postman or curl to test webhook endpoints:

```bash
curl -X POST http://localhost:5000/api/v1/webhooks/ai/prediction-update \
  -H "Content-Type: application/json" \
  -H "X-Webhook-Secret: your_secret" \
  -d '{
    "auctionId": "123",
    "predictedPrice": 1500,
    "confidence": 0.85,
    "priceRange": { "min": 1200, "max": 1800 }
  }'
```

### Testing gRPC

The gRPC client automatically falls back to mock responses if the AI module is unavailable, making local development seamless.

## Troubleshooting

### Issue: Webhooks not being sent

**Check:**
1. Redis connection is active
2. Bull queue is processing jobs
3. `AI_MODULE_URL` is correctly configured
4. Check queue stats for failed jobs

### Issue: gRPC connection failed

**Check:**
1. `AI_MODULE_GRPC_URL` is correct
2. AI module gRPC server is running
3. Network connectivity to AI module
4. Protobuf definitions match AI module

**Fallback:** System automatically uses mock fraud detection

### Issue: Webhook authentication failing

**Check:**
1. `AI_WEBHOOK_SECRET` matches on both sides
2. Header name is `X-Webhook-Secret`
3. Secret is not empty or undefined

### Issue: Circuit breaker is OPEN

**Cause:** 5+ consecutive failures to AI module

**Resolution:**
1. Check AI module availability
2. Wait 60 seconds for automatic retry
3. System uses mock responses while OPEN

## Best Practices

1. **Always set USE_MOCK_AI=true in development** to avoid dependency on AI module
2. **Monitor circuit breaker state** in production
3. **Set up alerts for failed webhook jobs** exceeding threshold
4. **Use IP whitelisting** in production for added security
5. **Rotate AI_WEBHOOK_SECRET** periodically
6. **Monitor cache hit rates** to optimize performance
7. **Review fraud alerts** regularly for false positives

## API Integration Examples

### Get Price Prediction
```javascript
import aiIntegrationService from './services/ai-integration.service.js';

const prediction = await aiIntegrationService.getPricePrediction({
  auctionId: auction._id,
  startingPrice: auction.pricing.startingPrice,
  category: auction.category,
  title: auction.title,
  description: auction.description
});
```

### Analyze Bid for Fraud
```javascript
const fraudAnalysis = await aiIntegrationService.analyzeBidFraud({
  bidId: bid._id,
  auctionId: bid.auction,
  userId: bid.bidder,
  amount: bid.amount,
  timestamp: bid.timestamp,
  ipAddress: req.ip,
  userAgent: req.headers['user-agent'],
  userHistory: {
    totalBids: user.stats.totalBids,
    wonAuctions: user.stats.auctionsWon,
    averageBidAmount: user.stats.totalSpent / user.stats.totalBids
  }
});
```

### Get Recommendations
```javascript
const recommendations = await aiIntegrationService.getRecommendations({
  userId: user._id,
  bidHistory: userBids,
  interests: user.interests,
  recentViews: user.recentViews
}, availableAuctions);
```

## Support

For issues or questions about AI integration:
1. Check logs in `logs/app.log`
2. Review circuit breaker status
3. Check queue statistics
4. Verify environment configuration
5. Test with mock AI enabled
