/**
 * controllers/webhookController.js
 *
 * Handles incoming MS Graph webhook notifications and validation.
 *
 * CRITICAL: Graph requires a response within 10 seconds of notification delivery.
 * We respond with 202 immediately and process async via SQS.
 */
const asyncHandler = require('../utils/asyncHandler');
const webhookService = require('../services/webhookService');
const logger = require('../config/logger');

// Lazy import to avoid circular dependency — sqsProducer is initialized after app starts
const getProducer = () => require('../services/queue/sqsProducer');

/**
 * GET /api/v1/webhooks/validate
 *
 * Graph sends this during subscription creation to validate the endpoint.
 * Must respond with 200 + plain text validationToken within 10 seconds.
 */
const validateWebhook = (req, res) => {
  const { validationToken } = req.query;
  if (validationToken) {
    logger.info(`[WebhookCtrl] Validation token received — confirming subscription`);
    res.set('Content-Type', 'text/plain');
    return res.status(200).send(validationToken);
  }
  return res.status(400).json({ success: false, message: 'No validation token provided.' });
};

/**
 * POST /api/v1/webhooks/teams
 *
 * Receives change notifications from Microsoft Graph.
 * Must respond with 202 Accepted immediately — Graph will retry if we're slow.
 * All actual processing happens asynchronously via SQS.
 */
const receiveNotification = asyncHandler(async (req, res) => {
  // Respond immediately — Graph requires < 10s response
  res.status(202).send();

  const { value: notifications } = req.body;

  if (!notifications || !Array.isArray(notifications) || notifications.length === 0) {
    logger.debug('[WebhookCtrl] Empty notification payload received');
    return;
  }

  logger.info(`[WebhookCtrl] Received ${notifications.length} notification(s) | requestId: ${req.requestId}`);

  // Process async (does not block the response)
  const producer = getProducer();
  webhookService.processNotifications(notifications, (job) => producer.enqueue(job))
    .then((results) => {
      logger.info(`[WebhookCtrl] Notification results: ${JSON.stringify(results)}`);
    })
    .catch((err) => {
      logger.error(`[WebhookCtrl] Notification processing error: ${err.message}`);
    });
});

module.exports = { validateWebhook, receiveNotification };
