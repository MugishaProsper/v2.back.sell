import express from 'express';
import { basicHealthCheck, detailedHealthCheck, getVersionInfo } from '../controllers/health.controller.js';

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

export default router;
