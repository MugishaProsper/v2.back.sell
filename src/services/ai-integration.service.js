import axios from 'axios';
import grpc from '@grpc/grpc-js';
import protoLoader from '@grpc/proto-loader';
import { configDotenv } from 'dotenv';
import logger from '../config/logger.js';
import { redisClient } from '../config/redis.config.js';

configDotenv();

/**
 * Circuit Breaker for AI Module
 * Prevents cascading failures when AI module is unavailable
 */
class CircuitBreaker {
    constructor(threshold = 5, timeout = 60000) {
        this.failureCount = 0;
        this.failureThreshold = threshold;
        this.timeout = timeout;
        this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
        this.nextAttempt = Date.now();
    }

    async execute(fn) {
        if (this.state === 'OPEN') {
            if (Date.now() < this.nextAttempt) {
                throw new Error('Circuit breaker is OPEN - AI module unavailable');
            }
            this.state = 'HALF_OPEN';
        }

        try {
            const result = await fn();
            this.onSuccess();
            return result;
        } catch (error) {
            this.onFailure();
            throw error;
        }
    }

    onSuccess() {
        this.failureCount = 0;
        this.state = 'CLOSED';
    }

    onFailure() {
        this.failureCount++;
        if (this.failureCount >= this.failureThreshold) {
            this.state = 'OPEN';
            this.nextAttempt = Date.now() + this.timeout;
            logger.warn(`Circuit breaker opened. Next attempt at ${new Date(this.nextAttempt).toISOString()}`);
        }
    }

    getState() {
        return this.state;
    }
}

/**
 * AI Integration Service
 * Handles all communication with the AI Module via webhooks and gRPC
 */
class AIIntegrationService {
    constructor() {
        this.aiModuleUrl = process.env.AI_MODULE_URL || 'http://localhost:8000';
        this.grpcUrl = process.env.AI_MODULE_GRPC_URL || 'localhost:50051';
        this.useMockAI = process.env.USE_MOCK_AI === 'true';
        this.circuitBreaker = new CircuitBreaker(5, 60000);
        this.grpcClient = null;
        this.cachePrefix = 'ai:';
        this.cacheTTL = 3600; // 1 hour in seconds
        
        // Retry configuration
        this.maxRetries = 3;
        this.retryDelay = 1000; // Initial delay in ms
        
        // Timeout configuration
        this.timeout = 5000; // 5 seconds
    }

    /**
     * Initialize gRPC client with connection pooling
     */
    async initializeGrpcClient() {
        if (this.useMockAI) {
            logger.info('Using mock AI service - gRPC client not initialized');
            return;
        }

        try {
            // Load protobuf definitions
            const PROTO_PATH = './src/proto/fraud_detection.proto';
            const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true
            });
            
            const fraudProto = grpc.loadPackageDefinition(packageDefinition).fraud;
            
            // Create gRPC client with connection pooling
            this.grpcClient = new fraudProto.FraudDetection(
                this.grpcUrl,
                grpc.credentials.createInsecure(),
                {
                    'grpc.keepalive_time_ms': 10000,
                    'grpc.keepalive_timeout_ms': 5000,
                    'grpc.keepalive_permit_without_calls': 1,
                    'grpc.http2.max_pings_without_data': 0,
                    'grpc.http2.min_time_between_pings_ms': 10000,
                    'grpc.http2.min_ping_interval_without_data_ms': 5000
                }
            );
            
            logger.info(`gRPC client initialized for AI module at ${this.grpcUrl}`);
        } catch (error) {
            logger.error('Failed to initialize gRPC client:', error);
            // Don't throw - allow service to continue with mock AI
        }
    }

    /**
     * Exponential backoff retry logic
     */
    async retryWithBackoff(fn, retries = this.maxRetries) {
        for (let i = 0; i < retries; i++) {
            try {
                return await fn();
            } catch (error) {
                if (i === retries - 1) throw error;
                
                const delay = this.retryDelay * Math.pow(2, i);
                logger.warn(`Retry attempt ${i + 1}/${retries} after ${delay}ms`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    /**
     * Get cached AI response
     */
    async getCachedResponse(key) {
        try {
            const cached = await redisClient.get(`${this.cachePrefix}${key}`);
            if (cached) {
                logger.debug(`Cache hit for AI response: ${key}`);
                return JSON.parse(cached);
            }
        } catch (error) {
            logger.error('Error reading from cache:', error);
        }
        return null;
    }

    /**
     * Cache AI response
     */
    async cacheResponse(key, data) {
        try {
            await redisClient.setex(
                `${this.cachePrefix}${key}`,
                this.cacheTTL,
                JSON.stringify(data)
            );
            logger.debug(`Cached AI response: ${key}`);
        } catch (error) {
            logger.error('Error writing to cache:', error);
        }
    }

    /**
     * Dispatch webhook to AI module
     * @param {string} endpoint - Webhook endpoint path
     * @param {object} payload - Data to send
     * @returns {Promise<object>} Response from AI module
     */
    async dispatchWebhook(endpoint, payload) {
        const url = `${this.aiModuleUrl}${endpoint}`;
        
        try {
            const response = await this.circuitBreaker.execute(async () => {
                return await this.retryWithBackoff(async () => {
                    const result = await axios.post(url, payload, {
                        timeout: this.timeout,
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Webhook-Secret': process.env.AI_WEBHOOK_SECRET
                        }
                    });
                    return result.data;
                });
            });
            
            logger.info(`Webhook dispatched successfully to ${endpoint}`);
            return response;
        } catch (error) {
            logger.error(`Failed to dispatch webhook to ${endpoint}:`, error.message);
            
            // If circuit breaker is open, return null to allow graceful degradation
            if (this.circuitBreaker.getState() === 'OPEN') {
                logger.warn('Circuit breaker is OPEN - AI module unavailable');
                return null;
            }
            
            throw error;
        }
    }

    /**
     * Call gRPC service for fraud detection
     * @param {object} bidData - Bid data to analyze
     * @returns {Promise<object>} Fraud analysis result
     */
    async analyzeBidFraud(bidData) {
        const cacheKey = `fraud:${bidData.bidId}`;
        
        // Check cache first
        const cached = await this.getCachedResponse(cacheKey);
        if (cached) return cached;
        
        if (this.useMockAI || !this.grpcClient) {
            logger.info('Using mock fraud detection');
            const mockResult = this.mockFraudDetection(bidData);
            await this.cacheResponse(cacheKey, mockResult);
            return mockResult;
        }

        try {
            const result = await this.circuitBreaker.execute(async () => {
                return await this.retryWithBackoff(async () => {
                    return new Promise((resolve, reject) => {
                        const deadline = new Date();
                        deadline.setMilliseconds(deadline.getMilliseconds() + this.timeout);
                        
                        this.grpcClient.AnalyzeBid(bidData, { deadline }, (error, response) => {
                            if (error) {
                                reject(error);
                            } else {
                                resolve(response);
                            }
                        });
                    });
                });
            });
            
            logger.info(`Fraud analysis completed for bid ${bidData.bidId}`);
            
            // Cache the result
            await this.cacheResponse(cacheKey, result);
            
            return result;
        } catch (error) {
            logger.error('gRPC fraud detection failed:', error.message);
            
            // Fallback to mock if gRPC fails
            logger.warn('Falling back to mock fraud detection');
            const mockResult = this.mockFraudDetection(bidData);
            await this.cacheResponse(cacheKey, mockResult);
            return mockResult;
        }
    }

    /**
     * Mock fraud detection for development/fallback
     */
    mockFraudDetection(bidData) {
        return {
            bidId: bidData.bidId,
            riskScore: Math.random() * 0.3, // Low risk (0-0.3)
            isFraudulent: false,
            reasons: [],
            confidence: 0.85,
            analyzedAt: new Date().toISOString()
        };
    }

    /**
     * Get circuit breaker status
     */
    getCircuitBreakerStatus() {
        return {
            state: this.circuitBreaker.getState(),
            failureCount: this.circuitBreaker.failureCount,
            nextAttempt: this.circuitBreaker.nextAttempt
        };
    }
}

// Export singleton instance
const aiIntegrationService = new AIIntegrationService();
export default aiIntegrationService;
