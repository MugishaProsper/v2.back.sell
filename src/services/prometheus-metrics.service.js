import { register, collectDefaultMetrics, Counter, Histogram, Gauge } from 'prom-client';
import logger from '../config/logger.js';

/**
 * PrometheusMetricsService - Exposes metrics for Prometheus scraping
 * Tracks HTTP requests, response times, error rates, and business metrics
 */
class PrometheusMetricsService {
    constructor() {
        // Enable default metrics (CPU, memory, event loop, etc.)
        collectDefaultMetrics({
            prefix: 'ai_auction_',
            gcDurationBuckets: [0.001, 0.01, 0.1, 1, 2, 5],
        });

        // HTTP Request Metrics
        this.httpRequestsTotal = new Counter({
            name: 'ai_auction_http_requests_total',
            help: 'Total number of HTTP requests',
            labelNames: ['method', 'route', 'status_code'],
        });

        this.httpRequestDuration = new Histogram({
            name: 'ai_auction_http_request_duration_seconds',
            help: 'Duration of HTTP requests in seconds',
            labelNames: ['method', 'route', 'status_code'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5, 10],
        });

        this.httpRequestsInProgress = new Gauge({
            name: 'ai_auction_http_requests_in_progress',
            help: 'Number of HTTP requests currently in progress',
            labelNames: ['method', 'route'],
        });

        // Error Metrics
        this.httpErrorsTotal = new Counter({
            name: 'ai_auction_http_errors_total',
            help: 'Total number of HTTP errors',
            labelNames: ['method', 'route', 'status_code', 'error_type'],
        });

        // Business Metrics - Auctions
        this.auctionsCreatedTotal = new Counter({
            name: 'ai_auction_auctions_created_total',
            help: 'Total number of auctions created',
            labelNames: ['category', 'seller_role'],
        });

        this.auctionsActiveGauge = new Gauge({
            name: 'ai_auction_auctions_active',
            help: 'Current number of active auctions',
            labelNames: ['category'],
        });

        this.auctionsClosedTotal = new Counter({
            name: 'ai_auction_auctions_closed_total',
            help: 'Total number of auctions closed',
            labelNames: ['category', 'has_winner'],
        });

        this.auctionValueHistogram = new Histogram({
            name: 'ai_auction_auction_value_dollars',
            help: 'Distribution of auction final values in dollars',
            labelNames: ['category'],
            buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
        });

        // Business Metrics - Bids
        this.bidsPlacedTotal = new Counter({
            name: 'ai_auction_bids_placed_total',
            help: 'Total number of bids placed',
            labelNames: ['auction_category'],
        });

        this.bidAmountHistogram = new Histogram({
            name: 'ai_auction_bid_amount_dollars',
            help: 'Distribution of bid amounts in dollars',
            labelNames: ['auction_category'],
            buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
        });

        this.fraudulentBidsTotal = new Counter({
            name: 'ai_auction_fraudulent_bids_total',
            help: 'Total number of bids flagged as fraudulent',
            labelNames: ['risk_level'],
        });

        // Business Metrics - Payments
        this.paymentsProcessedTotal = new Counter({
            name: 'ai_auction_payments_processed_total',
            help: 'Total number of payments processed',
            labelNames: ['status', 'payment_method'],
        });

        this.paymentAmountHistogram = new Histogram({
            name: 'ai_auction_payment_amount_dollars',
            help: 'Distribution of payment amounts in dollars',
            labelNames: ['payment_method'],
            buckets: [10, 50, 100, 250, 500, 1000, 2500, 5000, 10000, 25000, 50000],
        });

        this.paymentDuration = new Histogram({
            name: 'ai_auction_payment_duration_seconds',
            help: 'Duration of payment processing in seconds',
            labelNames: ['status', 'payment_method'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30, 60],
        });

        // Business Metrics - Users
        this.usersRegisteredTotal = new Counter({
            name: 'ai_auction_users_registered_total',
            help: 'Total number of users registered',
            labelNames: ['role'],
        });

        this.activeUsersGauge = new Gauge({
            name: 'ai_auction_active_users',
            help: 'Number of currently active users',
        });

        // Database Metrics
        this.databaseQueriesTotal = new Counter({
            name: 'ai_auction_database_queries_total',
            help: 'Total number of database queries',
            labelNames: ['model', 'operation'],
        });

        this.databaseQueryDuration = new Histogram({
            name: 'ai_auction_database_query_duration_seconds',
            help: 'Duration of database queries in seconds',
            labelNames: ['model', 'operation'],
            buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
        });

        // Cache Metrics
        this.cacheOperationsTotal = new Counter({
            name: 'ai_auction_cache_operations_total',
            help: 'Total number of cache operations',
            labelNames: ['operation', 'result'],
        });

        this.cacheHitRatio = new Gauge({
            name: 'ai_auction_cache_hit_ratio',
            help: 'Cache hit ratio (0-1)',
        });

        // AI Integration Metrics
        this.aiRequestsTotal = new Counter({
            name: 'ai_auction_ai_requests_total',
            help: 'Total number of AI module requests',
            labelNames: ['type', 'status'],
        });

        this.aiRequestDuration = new Histogram({
            name: 'ai_auction_ai_request_duration_seconds',
            help: 'Duration of AI module requests in seconds',
            labelNames: ['type'],
            buckets: [0.1, 0.5, 1, 2, 5, 10, 30],
        });

        // WebSocket Metrics
        this.websocketConnectionsGauge = new Gauge({
            name: 'ai_auction_websocket_connections',
            help: 'Number of active WebSocket connections',
        });

        this.websocketMessagesTotal = new Counter({
            name: 'ai_auction_websocket_messages_total',
            help: 'Total number of WebSocket messages',
            labelNames: ['event_type', 'direction'],
        });

        logger.info('Prometheus metrics service initialized');
    }

    /**
     * Track HTTP request
     */
    trackHttpRequest(method, route, statusCode, duration) {
        this.httpRequestsTotal.inc({ method, route, status_code: statusCode });
        this.httpRequestDuration.observe(
            { method, route, status_code: statusCode },
            duration / 1000 // Convert to seconds
        );

        if (statusCode >= 400) {
            const errorType = statusCode >= 500 ? 'server_error' : 'client_error';
            this.httpErrorsTotal.inc({ method, route, status_code: statusCode, error_type: errorType });
        }
    }

    /**
     * Track request start (in progress)
     */
    trackRequestStart(method, route) {
        this.httpRequestsInProgress.inc({ method, route });
    }

    /**
     * Track request end (in progress)
     */
    trackRequestEnd(method, route) {
        this.httpRequestsInProgress.dec({ method, route });
    }

    /**
     * Track auction created
     */
    trackAuctionCreated(category = 'unknown', sellerRole = 'seller') {
        this.auctionsCreatedTotal.inc({ category, seller_role: sellerRole });
    }

    /**
     * Update active auctions gauge
     */
    updateActiveAuctions(category, count) {
        this.auctionsActiveGauge.set({ category }, count);
    }

    /**
     * Track auction closed
     */
    trackAuctionClosed(category = 'unknown', hasWinner = false, finalValue = 0) {
        this.auctionsClosedTotal.inc({ category, has_winner: hasWinner.toString() });
        
        if (finalValue > 0) {
            this.auctionValueHistogram.observe({ category }, finalValue);
        }
    }

    /**
     * Track bid placed
     */
    trackBidPlaced(auctionCategory = 'unknown', bidAmount = 0) {
        this.bidsPlacedTotal.inc({ auction_category: auctionCategory });
        
        if (bidAmount > 0) {
            this.bidAmountHistogram.observe({ auction_category: auctionCategory }, bidAmount);
        }
    }

    /**
     * Track fraudulent bid
     */
    trackFraudulentBid(riskLevel = 'medium') {
        this.fraudulentBidsTotal.inc({ risk_level: riskLevel });
    }

    /**
     * Track payment processed
     */
    trackPaymentProcessed(status, paymentMethod = 'unknown', amount = 0, duration = 0) {
        this.paymentsProcessedTotal.inc({ status, payment_method: paymentMethod });
        
        if (amount > 0) {
            this.paymentAmountHistogram.observe({ payment_method: paymentMethod }, amount);
        }
        
        if (duration > 0) {
            this.paymentDuration.observe(
                { status, payment_method: paymentMethod },
                duration / 1000 // Convert to seconds
            );
        }
    }

    /**
     * Track user registration
     */
    trackUserRegistration(role = 'buyer') {
        this.usersRegisteredTotal.inc({ role });
    }

    /**
     * Update active users count
     */
    updateActiveUsers(count) {
        this.activeUsersGauge.set(count);
    }

    /**
     * Track database query
     */
    trackDatabaseQuery(model, operation, duration) {
        this.databaseQueriesTotal.inc({ model, operation });
        this.databaseQueryDuration.observe(
            { model, operation },
            duration / 1000 // Convert to seconds
        );
    }

    /**
     * Track cache operation
     */
    trackCacheOperation(operation, result) {
        this.cacheOperationsTotal.inc({ operation, result });
    }

    /**
     * Update cache hit ratio
     */
    updateCacheHitRatio(ratio) {
        this.cacheHitRatio.set(ratio);
    }

    /**
     * Track AI request
     */
    trackAIRequest(type, status, duration) {
        this.aiRequestsTotal.inc({ type, status });
        
        if (duration > 0) {
            this.aiRequestDuration.observe({ type }, duration / 1000);
        }
    }

    /**
     * Update WebSocket connections
     */
    updateWebSocketConnections(count) {
        this.websocketConnectionsGauge.set(count);
    }

    /**
     * Track WebSocket message
     */
    trackWebSocketMessage(eventType, direction) {
        this.websocketMessagesTotal.inc({ event_type: eventType, direction });
    }

    /**
     * Get metrics in Prometheus format
     */
    async getMetrics() {
        return await register.metrics();
    }

    /**
     * Get content type for metrics
     */
    getContentType() {
        return register.contentType;
    }

    /**
     * Reset all metrics (useful for testing)
     */
    resetMetrics() {
        register.resetMetrics();
        logger.info('Prometheus metrics reset');
    }
}

// Export singleton instance
const prometheusMetrics = new PrometheusMetricsService();
export default prometheusMetrics;
