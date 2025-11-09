import express from 'express';
import {
    handlePredictionUpdate,
    handleFraudAlert,
    handleInsights
} from '../controllers/ai-webhook.controller.js';
import { validateWebhookAuth } from '../middlewares/webhook-auth.middleware.js';

const router = express.Router();

/**
 * AI Webhook Routes
 * All routes are protected with webhook authentication
 */

// Apply webhook authentication to all routes
router.use(validateWebhookAuth);

/**
 * @route   POST /api/v1/webhooks/ai/prediction-update
 * @desc    Receive price prediction updates from AI module
 * @access  AI Module (Webhook)
 */
router.post('/prediction-update', handlePredictionUpdate);

/**
 * @route   POST /api/v1/webhooks/ai/fraud-alert
 * @desc    Receive fraud alerts from AI module
 * @access  AI Module (Webhook)
 */
router.post('/fraud-alert', handleFraudAlert);

/**
 * @route   POST /api/v1/webhooks/ai/insights
 * @desc    Receive general AI insights from AI module
 * @access  AI Module (Webhook)
 */
router.post('/insights', handleInsights);

export default router;
