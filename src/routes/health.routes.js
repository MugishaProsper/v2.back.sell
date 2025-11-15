import express from 'express';
import { 
    basicHealthCheck, 
    detailedHealthCheck, 
    getPerformanceMetrics,
    resetPerformanceMetrics 
} from '../controllers/health.controller.js';

const router = express.Router();

/**
 * @swagger
 * /api/v1/health:
 *   get:
 *     summary: Basic health check
 *     description: Quick health check endpoint that returns system status and uptime within 500ms
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: System is healthy
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-11-15T10:00:00.000Z
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 86400
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *       503:
 *         description: Service unavailable
 */
router.get('/', basicHealthCheck);

/**
 * @swagger
 * /api/v1/health/detailed:
 *   get:
 *     summary: Detailed health check
 *     description: Comprehensive health check that verifies database, Redis, and AI module connectivity
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Detailed system health information
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: healthy
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                   example: 2025-11-15T10:00:00.000Z
 *                 uptime:
 *                   type: number
 *                   description: Server uptime in seconds
 *                   example: 86400
 *                 version:
 *                   type: string
 *                   example: 1.0.0
 *                 services:
 *                   type: object
 *                   properties:
 *                     database:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [connected, disconnected, error]
 *                           example: connected
 *                         responseTime:
 *                           type: number
 *                           description: Response time in milliseconds
 *                           example: 15
 *                     redis:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [connected, disconnected, error]
 *                           example: connected
 *                         responseTime:
 *                           type: number
 *                           description: Response time in milliseconds
 *                           example: 5
 *                     aiModule:
 *                       type: object
 *                       properties:
 *                         status:
 *                           type: string
 *                           enum: [available, unavailable, error]
 *                           example: available
 *                         responseTime:
 *                           type: number
 *                           description: Response time in milliseconds
 *                           example: 120
 *                 memory:
 *                   type: object
 *                   properties:
 *                     used:
 *                       type: number
 *                       description: Used memory in MB
 *                       example: 256
 *                     total:
 *                       type: number
 *                       description: Total memory in MB
 *                       example: 512
 *                     percentage:
 *                       type: number
 *                       description: Memory usage percentage
 *                       example: 50
 *       503:
 *         description: One or more services are unavailable
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: degraded
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *                 services:
 *                   type: object
 *                 errors:
 *                   type: array
 *                   items:
 *                     type: string
 */
router.get('/detailed', detailedHealthCheck);

/**
 * @swagger
 * /api/v1/health/metrics:
 *   get:
 *     summary: Get performance metrics
 *     description: Returns comprehensive performance metrics including API response times, database query performance, and cache hit/miss rates
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Performance metrics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     api:
 *                       type: object
 *                       properties:
 *                         totalRequests:
 *                           type: number
 *                           example: 1500
 *                         avgDuration:
 *                           type: number
 *                           description: Average response time in milliseconds
 *                           example: 250
 *                         slowRequests:
 *                           type: number
 *                           example: 15
 *                         criticalRequests:
 *                           type: number
 *                           example: 2
 *                         errorRate:
 *                           type: string
 *                           example: "2.5%"
 *                     database:
 *                       type: object
 *                       properties:
 *                         totalQueries:
 *                           type: number
 *                           example: 3000
 *                         avgDuration:
 *                           type: number
 *                           description: Average query time in milliseconds
 *                           example: 50
 *                         slowQueries:
 *                           type: number
 *                           example: 10
 *                     cache:
 *                       type: object
 *                       properties:
 *                         totalOperations:
 *                           type: number
 *                           example: 5000
 *                         hits:
 *                           type: number
 *                           example: 4200
 *                         misses:
 *                           type: number
 *                           example: 800
 *                         hitRate:
 *                           type: string
 *                           example: "84.00%"
 *       500:
 *         description: Failed to retrieve metrics
 */
router.get('/metrics', getPerformanceMetrics);

/**
 * @swagger
 * /api/v1/health/metrics/reset:
 *   post:
 *     summary: Reset performance metrics
 *     description: Resets all performance metrics counters (admin only in production)
 *     tags: [Health]
 *     security: []
 *     responses:
 *       200:
 *         description: Metrics reset successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: Performance metrics reset successfully
 *                 timestamp:
 *                   type: string
 *                   format: date-time
 *       500:
 *         description: Failed to reset metrics
 */
router.post('/metrics/reset', resetPerformanceMetrics);

export default router;
