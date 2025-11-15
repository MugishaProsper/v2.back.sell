# Prometheus Metrics Documentation

## Overview

The AI Auction Backend exposes comprehensive metrics in Prometheus format for monitoring and observability. The metrics endpoint is available at `/metrics` and can be scraped by Prometheus servers.

## Metrics Endpoint

**URL**: `http://localhost:5000/metrics`

**Method**: GET

**Authentication**: None (public endpoint for Prometheus scraping)

**Content-Type**: `text/plain; version=0.0.4; charset=utf-8`

## Available Metrics

### Default System Metrics

The following Node.js default metrics are automatically collected with the `ai_auction_` prefix:

- **Process CPU Usage**: `ai_auction_process_cpu_user_seconds_total`, `ai_auction_process_cpu_system_seconds_total`
- **Process Memory**: `ai_auction_process_resident_memory_bytes`, `ai_auction_process_heap_bytes`
- **Event Loop Lag**: `ai_auction_nodejs_eventloop_lag_seconds`
- **Garbage Collection**: `ai_auction_nodejs_gc_duration_seconds`
- **Active Handles**: `ai_auction_nodejs_active_handles_total`
- **Active Requests**: `ai_auction_nodejs_active_requests_total`

### HTTP Request Metrics

#### `ai_auction_http_requests_total`
**Type**: Counter

**Description**: Total number of HTTP requests

**Labels**:
- `method`: HTTP method (GET, POST, PUT, DELETE, etc.)
- `route`: Normalized route path (e.g., `/api/v1/auctions/:id`)
- `status_code`: HTTP status code (200, 404, 500, etc.)

**Example**:
```
ai_auction_http_requests_total{method="GET",route="/api/v1/auctions",status_code="200"} 150
ai_auction_http_requests_total{method="POST",route="/api/v1/bids",status_code="201"} 45
```

#### `ai_auction_http_request_duration_seconds`
**Type**: Histogram

**Description**: Duration of HTTP requests in seconds

**Labels**:
- `method`: HTTP method
- `route`: Normalized route path
- `status_code`: HTTP status code

**Buckets**: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10 seconds

**Example**:
```
ai_auction_http_request_duration_seconds_bucket{method="GET",route="/api/v1/auctions",status_code="200",le="0.1"} 140
ai_auction_http_request_duration_seconds_sum{method="GET",route="/api/v1/auctions",status_code="200"} 12.5
ai_auction_http_request_duration_seconds_count{method="GET",route="/api/v1/auctions",status_code="200"} 150
```

#### `ai_auction_http_requests_in_progress`
**Type**: Gauge

**Description**: Number of HTTP requests currently in progress

**Labels**:
- `method`: HTTP method
- `route`: Normalized route path

**Example**:
```
ai_auction_http_requests_in_progress{method="GET",route="/api/v1/auctions"} 3
```

#### `ai_auction_http_errors_total`
**Type**: Counter

**Description**: Total number of HTTP errors

**Labels**:
- `method`: HTTP method
- `route`: Normalized route path
- `status_code`: HTTP status code
- `error_type`: `client_error` (4xx) or `server_error` (5xx)

**Example**:
```
ai_auction_http_errors_total{method="POST",route="/api/v1/bids",status_code="400",error_type="client_error"} 12
ai_auction_http_errors_total{method="GET",route="/api/v1/auctions/:id",status_code="500",error_type="server_error"} 2
```

### Business Metrics - Auctions

#### `ai_auction_auctions_created_total`
**Type**: Counter

**Description**: Total number of auctions created

**Labels**:
- `category`: Auction category (electronics, art, collectibles, etc.)
- `seller_role`: Role of the seller (seller, admin)

**Example**:
```
ai_auction_auctions_created_total{category="electronics",seller_role="seller"} 45
ai_auction_auctions_created_total{category="art",seller_role="seller"} 23
```

#### `ai_auction_auctions_active`
**Type**: Gauge

**Description**: Current number of active auctions

**Labels**:
- `category`: Auction category

**Example**:
```
ai_auction_auctions_active{category="electronics"} 12
ai_auction_auctions_active{category="art"} 8
```

#### `ai_auction_auctions_closed_total`
**Type**: Counter

**Description**: Total number of auctions closed

**Labels**:
- `category`: Auction category
- `has_winner`: Whether the auction had a winner (true/false)

**Example**:
```
ai_auction_auctions_closed_total{category="electronics",has_winner="true"} 38
ai_auction_auctions_closed_total{category="electronics",has_winner="false"} 5
```

#### `ai_auction_auction_value_dollars`
**Type**: Histogram

**Description**: Distribution of auction final values in dollars

**Labels**:
- `category`: Auction category

**Buckets**: 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000 dollars

**Example**:
```
ai_auction_auction_value_dollars_bucket{category="electronics",le="500"} 25
ai_auction_auction_value_dollars_sum{category="electronics"} 45000
ai_auction_auction_value_dollars_count{category="electronics"} 38
```

### Business Metrics - Bids

#### `ai_auction_bids_placed_total`
**Type**: Counter

**Description**: Total number of bids placed

**Labels**:
- `auction_category`: Category of the auction

**Example**:
```
ai_auction_bids_placed_total{auction_category="electronics"} 234
ai_auction_bids_placed_total{auction_category="art"} 156
```

#### `ai_auction_bid_amount_dollars`
**Type**: Histogram

**Description**: Distribution of bid amounts in dollars

**Labels**:
- `auction_category`: Category of the auction

**Buckets**: 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000 dollars

**Example**:
```
ai_auction_bid_amount_dollars_bucket{auction_category="electronics",le="1000"} 180
ai_auction_bid_amount_dollars_sum{auction_category="electronics"} 125000
ai_auction_bid_amount_dollars_count{auction_category="electronics"} 234
```

#### `ai_auction_fraudulent_bids_total`
**Type**: Counter

**Description**: Total number of bids flagged as fraudulent

**Labels**:
- `risk_level`: Risk level (low, medium, high)

**Example**:
```
ai_auction_fraudulent_bids_total{risk_level="high"} 5
ai_auction_fraudulent_bids_total{risk_level="medium"} 12
```

### Business Metrics - Payments

#### `ai_auction_payments_processed_total`
**Type**: Counter

**Description**: Total number of payments processed

**Labels**:
- `status`: Payment status (pending, processing, completed, failed, refunded)
- `payment_method`: Payment method (credit_card, paypal, bank_transfer)

**Example**:
```
ai_auction_payments_processed_total{status="completed",payment_method="credit_card"} 85
ai_auction_payments_processed_total{status="failed",payment_method="paypal"} 3
```

#### `ai_auction_payment_amount_dollars`
**Type**: Histogram

**Description**: Distribution of payment amounts in dollars

**Labels**:
- `payment_method`: Payment method

**Buckets**: 10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000 dollars

**Example**:
```
ai_auction_payment_amount_dollars_bucket{payment_method="credit_card",le="1000"} 65
ai_auction_payment_amount_dollars_sum{payment_method="credit_card"} 95000
ai_auction_payment_amount_dollars_count{payment_method="credit_card"} 85
```

#### `ai_auction_payment_duration_seconds`
**Type**: Histogram

**Description**: Duration of payment processing in seconds

**Labels**:
- `status`: Payment status
- `payment_method`: Payment method

**Buckets**: 0.1, 0.5, 1, 2, 5, 10, 30, 60 seconds

**Example**:
```
ai_auction_payment_duration_seconds_bucket{status="completed",payment_method="credit_card",le="5"} 82
ai_auction_payment_duration_seconds_sum{status="completed",payment_method="credit_card"} 340
ai_auction_payment_duration_seconds_count{status="completed",payment_method="credit_card"} 85
```

### Business Metrics - Users

#### `ai_auction_users_registered_total`
**Type**: Counter

**Description**: Total number of users registered

**Labels**:
- `role`: User role (buyer, seller, admin)

**Example**:
```
ai_auction_users_registered_total{role="buyer"} 450
ai_auction_users_registered_total{role="seller"} 120
```

#### `ai_auction_active_users`
**Type**: Gauge

**Description**: Number of currently active users

**Example**:
```
ai_auction_active_users 78
```

### Database Metrics

#### `ai_auction_database_queries_total`
**Type**: Counter

**Description**: Total number of database queries

**Labels**:
- `model`: Database model (User, Auction, Bid, Payment, etc.)
- `operation`: Operation type (find, create, update, delete, aggregate)

**Example**:
```
ai_auction_database_queries_total{model="Auction",operation="find"} 1250
ai_auction_database_queries_total{model="Bid",operation="create"} 234
```

#### `ai_auction_database_query_duration_seconds`
**Type**: Histogram

**Description**: Duration of database queries in seconds

**Labels**:
- `model`: Database model
- `operation`: Operation type

**Buckets**: 0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5 seconds

**Example**:
```
ai_auction_database_query_duration_seconds_bucket{model="Auction",operation="find",le="0.05"} 1200
ai_auction_database_query_duration_seconds_sum{model="Auction",operation="find"} 45.5
ai_auction_database_query_duration_seconds_count{model="Auction",operation="find"} 1250
```

### Cache Metrics

#### `ai_auction_cache_operations_total`
**Type**: Counter

**Description**: Total number of cache operations

**Labels**:
- `operation`: Operation type (get, set, delete)
- `result`: Operation result (hit, miss, success, error)

**Example**:
```
ai_auction_cache_operations_total{operation="get",result="hit"} 4200
ai_auction_cache_operations_total{operation="get",result="miss"} 800
ai_auction_cache_operations_total{operation="set",result="success"} 850
```

#### `ai_auction_cache_hit_ratio`
**Type**: Gauge

**Description**: Cache hit ratio (0-1)

**Example**:
```
ai_auction_cache_hit_ratio 0.84
```

### AI Integration Metrics

#### `ai_auction_ai_requests_total`
**Type**: Counter

**Description**: Total number of AI module requests

**Labels**:
- `type`: Request type (fraud_detection, price_prediction, recommendations)
- `status`: Request status (success, error, timeout)

**Example**:
```
ai_auction_ai_requests_total{type="fraud_detection",status="success"} 234
ai_auction_ai_requests_total{type="price_prediction",status="success"} 45
ai_auction_ai_requests_total{type="fraud_detection",status="timeout"} 2
```

#### `ai_auction_ai_request_duration_seconds`
**Type**: Histogram

**Description**: Duration of AI module requests in seconds

**Labels**:
- `type`: Request type

**Buckets**: 0.1, 0.5, 1, 2, 5, 10, 30 seconds

**Example**:
```
ai_auction_ai_request_duration_seconds_bucket{type="fraud_detection",le="0.5"} 220
ai_auction_ai_request_duration_seconds_sum{type="fraud_detection"} 95.5
ai_auction_ai_request_duration_seconds_count{type="fraud_detection"} 234
```

### WebSocket Metrics

#### `ai_auction_websocket_connections`
**Type**: Gauge

**Description**: Number of active WebSocket connections

**Example**:
```
ai_auction_websocket_connections 45
```

#### `ai_auction_websocket_messages_total`
**Type**: Counter

**Description**: Total number of WebSocket messages

**Labels**:
- `event_type`: Event type (bid:new, auction:update, notification:new, etc.)
- `direction`: Message direction (inbound, outbound)

**Example**:
```
ai_auction_websocket_messages_total{event_type="bid:new",direction="outbound"} 234
ai_auction_websocket_messages_total{event_type="auction:update",direction="outbound"} 156
```

## Prometheus Configuration

### Scrape Configuration

Add the following to your `prometheus.yml` configuration file:

```yaml
scrape_configs:
  - job_name: 'ai-auction-backend'
    scrape_interval: 15s
    scrape_timeout: 10s
    metrics_path: '/metrics'
    static_configs:
      - targets: ['localhost:5000']
        labels:
          environment: 'production'
          service: 'ai-auction-backend'
```

### Example Queries

#### Request Rate
```promql
rate(ai_auction_http_requests_total[5m])
```

#### Error Rate
```promql
rate(ai_auction_http_errors_total[5m]) / rate(ai_auction_http_requests_total[5m])
```

#### Average Response Time
```promql
rate(ai_auction_http_request_duration_seconds_sum[5m]) / rate(ai_auction_http_request_duration_seconds_count[5m])
```

#### 95th Percentile Response Time
```promql
histogram_quantile(0.95, rate(ai_auction_http_request_duration_seconds_bucket[5m]))
```

#### Active Auctions by Category
```promql
ai_auction_auctions_active
```

#### Bid Rate
```promql
rate(ai_auction_bids_placed_total[5m])
```

#### Payment Success Rate
```promql
rate(ai_auction_payments_processed_total{status="completed"}[5m]) / rate(ai_auction_payments_processed_total[5m])
```

#### Cache Hit Rate
```promql
ai_auction_cache_hit_ratio
```

#### Database Query Performance
```promql
histogram_quantile(0.95, rate(ai_auction_database_query_duration_seconds_bucket[5m]))
```

## Grafana Dashboard

### Recommended Panels

1. **Request Rate**: Line graph showing requests per second
2. **Error Rate**: Line graph showing error percentage
3. **Response Time**: Line graph showing p50, p95, p99 response times
4. **Active Auctions**: Gauge showing current active auctions
5. **Bid Activity**: Line graph showing bids per minute
6. **Payment Success Rate**: Gauge showing payment success percentage
7. **Cache Performance**: Gauge showing cache hit ratio
8. **Database Performance**: Line graph showing query duration
9. **AI Module Performance**: Line graph showing AI request duration
10. **WebSocket Connections**: Gauge showing active connections

### Example Dashboard JSON

A sample Grafana dashboard configuration is available in `docs/grafana-dashboard.json`.

## Alerting Rules

### Example Alert Rules

```yaml
groups:
  - name: ai_auction_alerts
    interval: 30s
    rules:
      - alert: HighErrorRate
        expr: rate(ai_auction_http_errors_total[5m]) / rate(ai_auction_http_requests_total[5m]) > 0.05
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "High error rate detected"
          description: "Error rate is {{ $value | humanizePercentage }}"

      - alert: SlowResponseTime
        expr: histogram_quantile(0.95, rate(ai_auction_http_request_duration_seconds_bucket[5m])) > 2
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow response time detected"
          description: "95th percentile response time is {{ $value }}s"

      - alert: HighFraudRate
        expr: rate(ai_auction_fraudulent_bids_total{risk_level="high"}[5m]) > 0.1
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "High fraud detection rate"
          description: "High-risk fraudulent bids detected at {{ $value }} per second"

      - alert: PaymentFailureRate
        expr: rate(ai_auction_payments_processed_total{status="failed"}[5m]) / rate(ai_auction_payments_processed_total[5m]) > 0.1
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "High payment failure rate"
          description: "Payment failure rate is {{ $value | humanizePercentage }}"

      - alert: DatabaseSlowQueries
        expr: histogram_quantile(0.95, rate(ai_auction_database_query_duration_seconds_bucket[5m])) > 1
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Slow database queries detected"
          description: "95th percentile query time is {{ $value }}s"

      - alert: LowCacheHitRate
        expr: ai_auction_cache_hit_ratio < 0.7
        for: 10m
        labels:
          severity: warning
        annotations:
          summary: "Low cache hit rate"
          description: "Cache hit rate is {{ $value | humanizePercentage }}"
```

## Testing Metrics

### Manual Testing

1. Start the server:
```bash
npm start
```

2. Access the metrics endpoint:
```bash
curl http://localhost:5000/metrics
```

3. Generate some traffic:
```bash
# Create some requests
curl http://localhost:5000/api/v1/health
curl http://localhost:5000/api/v1/auctions
```

4. Check metrics again to see updated values

### Automated Testing

The metrics service includes a `resetMetrics()` method for testing purposes:

```javascript
import prometheusMetrics from './services/prometheus-metrics.service.js';

// Reset all metrics
prometheusMetrics.resetMetrics();
```

## Performance Considerations

- **Metric Collection Overhead**: Minimal (<1ms per request)
- **Memory Usage**: Approximately 10-50MB depending on label cardinality
- **Scrape Interval**: Recommended 15-30 seconds
- **Retention**: Configure based on storage capacity (typically 15-30 days)

## Best Practices

1. **Label Cardinality**: Keep label values bounded to avoid memory issues
2. **Metric Naming**: Follow Prometheus naming conventions (snake_case, descriptive)
3. **Histogram Buckets**: Adjust buckets based on actual data distribution
4. **Scrape Frequency**: Balance between data granularity and system load
5. **Alert Thresholds**: Set thresholds based on baseline performance metrics

## Troubleshooting

### Metrics Not Updating

1. Check if the middleware is properly registered in `server.js`
2. Verify that requests are reaching the application
3. Check logs for any errors in the metrics service

### High Memory Usage

1. Review label cardinality (too many unique label combinations)
2. Consider reducing histogram bucket count
3. Adjust Prometheus retention period

### Missing Metrics

1. Ensure the service is properly tracking the metric
2. Check if the metric is being called in the appropriate service
3. Verify the metric name and labels match the query

## Related Documentation

- [Prometheus Documentation](https://prometheus.io/docs/)
- [prom-client Library](https://github.com/siimon/prom-client)
- [Grafana Documentation](https://grafana.com/docs/)
- [Performance Monitoring Guide](./PERFORMANCE_MONITORING.md)
