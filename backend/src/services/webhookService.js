/**
 * services/webhookService.js
 *
 * Processes incoming Graph webhook notifications.
 *
 * Flow per notification:
 *   1. Validate client_state against stored subscription secrets
 *   2. Deduplicate using change_id (idempotency)
 *   3. Persist raw event to WebhookEvent collection
 *   4. Push job into SQS queue for async processing
 *   5. Update event status to QUEUED
 *
 * Graph sends notifications as an array (value:[...]).
 * We process each notification item independently.
 *
 * Validation Token Handling:
 * When Graph first creates a subscription, it sends a GET request with
 * ?validationToken=... to confirm the URL is alive.
 * We must respond with 200 + the plain text token within 10 seconds.
 */
const crypto = require('crypto');
const { subscriptionRepository, webhookEventRepository } = require('../repositories');


const logger = require('../config/logger');
const config = require('../config/env');

const webhookService = {
  /**
   * validateClientState()
   *
   * Verifies the clientState in a notification matches our stored secret.
   * This prevents unauthorized parties from sending fake notifications.
   */
  async validateClientState(subscriptionId, receivedClientState) {
    const subscription = await subscriptionRepository.findById(subscriptionId);
    if (!subscription) {
      logger.warn(`[WebhookService] Unknown subscription ID: ${subscriptionId}`);
      return false;
    }
    const valid = subscription.client_state === receivedClientState;
    if (!valid) {
      logger.warn(`[WebhookService] ClientState mismatch for subscription: ${subscriptionId}`);
    }
    return valid;
  },

  /**
   * processNotifications()
   *
   * Handles the array of notifications from Graph.
   * Returns counts of processed, skipped, and failed items.
   *
   * @param {Array} notifications - From req.body.value
   * @param {Function} enqueueJob - SQS producer function (injected to avoid circular deps)
   */
  async processNotifications(notifications, enqueueJob) {
    const results = { processed: 0, skipped: 0, failed: 0 };

    for (const notification of notifications) {
      const changeId = notification.changeType + ':' + (notification.resourceData?.id || notification.resource || crypto.randomUUID());

      try {
        // ── Idempotency check ─────────────────────────────────────
        const alreadyExists = await webhookEventRepository.existsByChangeId(changeId);
        if (alreadyExists) {
          logger.debug(`[WebhookService] Duplicate event skipped: ${changeId}`);
          results.skipped++;
          continue;
        }

        // ── Validate client state ─────────────────────────────────
        const isValid = await webhookService.validateClientState(
          notification.subscriptionId,
          notification.clientState
        );
        if (!isValid) {
          logger.warn(`[WebhookService] Invalid clientState, ignoring event: ${changeId}`);
          results.skipped++;
          continue;
        }

        // ── Validate tenant origin ────────────────────────────────
        if (notification.tenantId && notification.tenantId !== config.msGraph.tenantId) {
          logger.error(`[WebhookService] Security Alert: Webhook received from unknown tenant: ${notification.tenantId}`);
          results.skipped++;
          continue;
        }

        // ── Persist event ─────────────────────────────────────────
        await webhookEventRepository.create({
          change_id: changeId,
          subscription_id: notification.subscriptionId,
          resource: notification.resource,
          change_type: notification.changeType,
          resource_data: notification.resourceData,
          raw_payload: notification,
          status: 'RECEIVED',
        });

        // ── Enqueue for async processing ──────────────────────────
        await enqueueJob({
          type: 'PROCESS_CALL_RECORD',
          change_id: changeId,
          resource: notification.resource,
          resource_data: notification.resourceData,
          subscription_id: notification.subscriptionId,
        });

        await webhookEventRepository.updateStatus(changeId, 'QUEUED');
        logger.info(`[WebhookService] Event queued: ${changeId}`);
        results.processed++;
      } catch (err) {
        logger.error(`[WebhookService] Error processing notification ${changeId}: ${err.message}`);
        try {
          await webhookEventRepository.updateStatus(changeId, 'FAILED', { error_message: err.message });
        } catch (_) {}
        results.failed++;
      }
    }

    return results;
  },
};

module.exports = webhookService;