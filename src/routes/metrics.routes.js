import express from 'express';
import prometheusMetrics from '../services/prometheus-metrics.service.js';
import asyncHandler from '../utils/asyncHandler.js';

const router = express.Router();

/**
 * @swagger
 * /metrics:
 *   get:
 *     summary: Prometheus metrics endpoint
 *     description: Exposes application metrics in Prometheus format for scraping
 *     tags: [Monitoring]
 *     security: []
 *     responses:
 *       200:
 *         description: Metrics in Prometheus format
 *         content:
 *           text/plain:
 *             schema:
 *               type: string
 *               example: |
 *                 # HELP ai_auction_http_requests_total Total number of HTTP requests
 *                 # TYPE ai_auction_http_requests_total counter
 *                 ai_auction_http_requests_total{method="GET",route="/api/v1/auctions",status_code="200"} 150
 */
router.get('/', asyncHandler(async (req, res) => {
    const metrics = await prometheusMetrics.getMetrics();
    
    res.set('Content-Type', prometheusMetrics.getContentType());
    res.send(metrics);
}));

export default router;
