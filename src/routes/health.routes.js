import express from 'express';
import mongoose from 'mongoose';
import { redisClient } from '../config/redis.config.js';
import queueManager from '../utils/queue-manager.js';
import aiIntegrationService from '../services/ai-integration.service.js';
import logger from '../config/logger.js';

const router = express.Router();

/**
 * Basic health check
 * GET /api/v1/health
 * Returns within 500ms as per requirements
 */
router.get('/', async (req, res) => {
    const startTime = Date.now();
    
    try {
        const health = {
            status: 'healthy',
            timestamp: new Date().toISOString(),
            uptime: process.uptime(),
            environment: process.env.NODE_ENV || 'development'
        };
        
        const executionTime = Date.now() - startTime;
        health.responseTime = `${executionTime}ms`;
        
        res.status(200).json(health);
    } catch (error) {
        logger.error('Health check error:', error);
        res.status(503).json({
            status: 'unhealthy',
            timestamp: new Date().toISOString(),
            error: error.message
        });
    }
});

/**
 * Detailed health check
 * GET /api/v1/health/detailed
 * Checks database, Redis, AI module connectivity, and queue status
 */
router.get('/detailed', async (req, res) => {
    const startTime = Date.now();
    
    try {
        // Check MongoDB connection
        const dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
        const dbDetails = {
            status: dbStatus,
            host: mongoose.connection.host,
            name: mongoose.connection.name
        };
        
        // Check Redis connection
        let redisStatus = 'disconnected';
        try {
            await redisClient.ping();
            redisStatus = 'connected';
        } catch (error) {
            logger.error('Redis health check failed:', error)