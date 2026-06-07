/**
 * controllers/webhookController.js
 *
 * Handles Microsoft Graph webhooks for interview recordings and transcripts.
 * Independent of Graph readiness - stores events and pushes to queue.
 */

const { validateGraphWebhook } = require('../validators/webhookValidators');
const webhookEventRepository = require('../repositories/webhookEventRepository');
const mockQueueService = require('../services/queue/mockQueueService');
const logger = require('../config/logger');

const webhookController = {
  /**
   * GET /api/v1/webhooks/health
   * Simple health check for the webhook endpoint.
   */
  async healthCheck(req, res) {
    res.status(200).json({ status: 'ok', message: 'Webhook receiver is healthy' });
  },

  /**
   * POST /api/v1/webhooks/graph
   * Main webhook receiver for Microsoft Graph subscriptions.
   */
  async handleGraphWebhook(req, res) {
    // 1. Handle validationToken (Subscription creation flow)
    if (req.query && req.query.validationToken) {
      logger.info('[WebhookController] Received validationToken request');
      res.setHeader('Content-Type', 'text/plain');
      return res.status(200).send(req.query.validationToken);
    }

    // 2. Validate payload structure
    const { error } = validateGraphWebhook(req.body);
    if (error) {
      logger.warn(`[WebhookController] Invalid webhook payload: ${error.message}`);
      return res.status(400).json({ error: 'Invalid payload structure' });
    }

    const notifications = req.body.value;

    // Acknowledge receipt immediately (Graph requires 202 Accepted quickly)
    res.status(202).send();

    // 3. Process notifications asynchronously
    for (const notification of notifications) {
      const changeId = `${notification.changeType}:${notification.resourceData?.id || notification.resource || Date.now()}`;

      try {
        // Idempotency: Check if we've already received this event
        const alreadyExists = await webhookEventRepository.existsByChangeId(changeId);
        if (alreadyExists) {
          logger.info(`[WebhookController] Duplicate webhook event ignored: ${changeId}`);
          continue;
        }

        // Store event in DB
        await webhookEventRepository.create({
          change_id: changeId,
          subscription_id: notification.subscriptionId || 'mock-sub',
          resource: notification.resource || 'unknown',
          change_type: notification.changeType || 'unknown',
          resource_data: notification.resourceData || {},
          raw_payload: notification,
          status: 'RECEIVED'
        });

        // Push to Mock Queue Service
        await mockQueueService.add('webhook_queue', 'process_graph_event', notification);

        // Mark as QUEUED in DB
        await webhookEventRepository.updateStatus(changeId, 'QUEUED');
        logger.info(`[WebhookController] ✅ Webhook queued successfully: ${changeId}`);

      } catch (err) {
        logger.error(`[WebhookController] ❌ Failed to process webhook ${changeId}: ${err.message}`);
        // Attempt to mark as failed
        try {
          await webhookEventRepository.updateStatus(changeId, 'FAILED', { error_message: err.message });
        } catch (_) {}
      }
    }
  }
};

module.exports = webhookController;
