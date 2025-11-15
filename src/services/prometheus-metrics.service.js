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
            help: 'Total number of paymen