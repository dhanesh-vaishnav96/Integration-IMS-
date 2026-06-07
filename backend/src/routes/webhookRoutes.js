/**
 * routes/webhookRoutes.js
 *
 * Routes for Microsoft Graph webhook integration.
 */
const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');

// GET /api/v1/webhooks/health - Health check endpoint
router.get('/health', webhookController.healthCheck);

// POST /api/v1/webhooks/graph - Main Graph webhook endpoint
// Note: Graph API sends validation token on GET but notifications on POST.
// However, the Graph subscription creation flow sends validationToken as a query param
// on the POST request url. Therefore, this endpoint handles both.
router.post('/graph', webhookController.handleGraphWebhook);

module.exports = router;
