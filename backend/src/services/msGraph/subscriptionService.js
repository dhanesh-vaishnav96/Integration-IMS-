/**
 * services/msGraph/subscriptionService.js
 *
 * Creates and renews Microsoft Graph webhook subscriptions.
 *
 * Subscription lifecycle:
 *   1. Create subscription → Graph validates our webhook URL
 *   2. Graph sends validation token → we echo it back within 10 seconds
 *   3. Subscription active → Graph sends change notifications
 *   4. Before expiry → we PATCH to renew (node-cron job)
 *
 * Resource options for interview recordings:
 *   "communications/callRecords"  → fires when a call ends (includes meetings)
 *   "/communications/onlineMeetings/{id}/recordings" → meeting-specific recording
 *
 * For Phase 3C we subscribe to "communications/callRecords" as it's tenant-wide
 * and fires for ALL Teams calls/meetings. The webhook handler then filters
 * by our known meeting IDs stored in MongoDB.
 *
 * Subscription max expiry:
 *   callRecords: 60 minutes (shortest-lived, must be renewed frequently)
 *   onlineMeetings: 60 minutes
 *
 * In production, node-cron job runs every 30 minutes to renew all active subs.
 */
const { getGraphClient } = require('./graphClientFactory');
const subscriptionRepository = require('../../repositories/subscriptionRepository');
const AppError = require('../../utils/AppError');
const logger = require('../../config/logger');
const config = require('../../config/env');
const crypto = require('crypto');
const { HTTP_STATUS } = require('../../constants');

/** Generate a cryptographically random client state secret for validation */
const generateClientState = () => crypto.randomBytes(32).toString('hex');

/** Max expiry for callRecords subscriptions: 60 min (Graph enforced) */
const MAX_EXPIRY_MINUTES = 58; // 2-min buffer

const subscriptionService = {
  /**
   * createSubscription()
   *
   * Creates a new Graph webhook subscription for callRecords.
   * The WEBHOOK_URL must be a publicly accessible HTTPS endpoint.
   * For local dev: use ngrok → https://<id>.ngrok.io/api/v1/webhooks/teams
   *
   * @param {string} [userCacheKey] - Delegated mode session key
   * @returns {Object} Created subscription + DB record
   */
  async createSubscription(userCacheKey = null) {
    const notificationUrl = process.env.WEBHOOK_NOTIFICATION_URL;
    if (!notificationUrl) {
      throw new AppError(
        'WEBHOOK_NOTIFICATION_URL is not set in .env. ' +
          'Set it to your publicly accessible webhook URL (e.g., https://abc.ngrok.io/api/v1/webhooks/teams)',
        HTTP_STATUS.BAD_REQUEST
      );
    }

    const clientState = generateClientState();
    const expirationDateTime = new Date(
      Date.now() + MAX_EXPIRY_MINUTES * 60 * 1000
    ).toISOString();

    const subscriptionBody = {
      changeType: 'created',
      notificationUrl,
      resource: 'communications/callRecords',
      expirationDateTime,
      clientState,
    };

    logger.info(
      `[SubscriptionService] Creating Graph subscription | resource: ${subscriptionBody.resource} | url: ${notificationUrl}`
    );

    try {
      const client = getGraphClient(userCacheKey);
      const subscription = await client.api('/subscriptions').post(subscriptionBody);

      // Persist to MongoDB
      const record = await subscriptionRepository.create({
        subscription_id: subscription.id,
        resource: subscription.resource,
        change_type: subscription.changeType,
        notification_url: subscription.notificationUrl,
        expiration_datetime: new Date(subscription.expirationDateTime),
        client_state: clientState,
        created_by: 'system',
      });

      logger.info(`[SubscriptionService] Subscription created: ${subscription.id} | expires: ${subscription.expirationDateTime}`);
      return { subscription, record };
    } catch (err) {
      const code = err.statusCode || 500;
      const msg = err.body?.error?.message || err.message;
      logger.error(`[SubscriptionService] Create failed: ${msg}`);

      if (code === 400) throw new AppError(`Graph subscription rejected: ${msg}. Ensure the webhook URL is HTTPS and publicly accessible.`, HTTP_STATUS.BAD_REQUEST);
      if (code === 401) throw new AppError(`Unauthorized. Re-authenticate via /ms/auth/login.`, HTTP_STATUS.UNAUTHORIZED);
      throw new AppError(`Subscription creation failed: ${msg}`, code);
    }
  },

  /**
   * renewSubscription()
   *
   * Extends the expiry of an existing subscription.
   * Called by the node-cron renewal job every 30 minutes.
   *
   * @param {string} subscriptionId - Graph subscription ID
   * @param {string} [userCacheKey]
   */
  async renewSubscription(subscriptionId, userCacheKey = null) {
    const newExpiry = new Date(Date.now() + MAX_EXPIRY_MINUTES * 60 * 1000).toISOString();
    logger.info(`[SubscriptionService] Renewing subscription: ${subscriptionId}`);

    try {
      const client = getGraphClient(userCacheKey);
      await client.api(`/subscriptions/${subscriptionId}`).patch({ expirationDateTime: newExpiry });

      await subscriptionRepository.updateRenewal(subscriptionId, new Date(newExpiry));
      logger.info(`[SubscriptionService] Renewed: ${subscriptionId} → ${newExpiry}`);
      return { subscriptionId, newExpiry };
    } catch (err) {
      const msg = err.body?.error?.message || err.message;
      logger.error(`[SubscriptionService] Renew failed for ${subscriptionId}: ${msg}`);
      if (err.statusCode === 404) {
        await subscriptionRepository.deactivate(subscriptionId);
        logger.warn(`[SubscriptionService] Subscription not found on Graph — deactivated: ${subscriptionId}`);
      }
      throw new AppError(`Subscription renewal failed: ${msg}`, err.statusCode || 500);
    }
  },

  /**
   * renewAllExpiring()
   *
   * Finds all subscriptions expiring within 30 minutes and renews them.
   * Called by the node-cron job in jobs/subscriptionRenewalJob.js
   */
  async renewAllExpiring(userCacheKey = null) {
    const expiring = await subscriptionRepository.findExpiringSoon(30);
    logger.info(`[SubscriptionService] Found ${expiring.length} subscription(s) to renew`);

    const results = { renewed: [], failed: [] };
    for (const sub of expiring) {
      try {
        await subscriptionService.renewSubscription(sub.subscription_id, userCacheKey);
        results.renewed.push(sub.subscription_id);
      } catch (err) {
        results.failed.push({ id: sub.subscription_id, error: err.message });
      }
    }
    return results;
  },
};

module.exports = subscriptionService;
