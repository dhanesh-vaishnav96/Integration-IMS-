/**
 * jobs/subscriptionRenewalJob.js
 *
 * Cron job that renews expiring Graph subscriptions every 30 minutes.
 * Graph callRecords subscriptions expire in 60 minutes max.
 * This job ensures they are always renewed before expiry.
 *
 * Must be started from server.js after MongoDB connects.
 * Usage: require('./src/jobs/subscriptionRenewalJob').start();
 */
const cron = require('node-cron');
const subscriptionService = require('../services/msGraph/subscriptionService');
const logger = require('../config/logger');

let job = null;

const start = () => {
  // Run every 30 minutes: '*/30 * * * *'
  job = cron.schedule('*/30 * * * *', async () => {
    logger.info('[SubscriptionRenewalJob] Running subscription renewal check...');
    try {
      const results = await subscriptionService.renewAllExpiring();
      logger.info(`[SubscriptionRenewalJob] Renewed: ${results.renewed.length} | Failed: ${results.failed.length}`);
      if (results.failed.length > 0) {
        results.failed.forEach((f) => logger.error(`[SubscriptionRenewalJob] Failed: ${f.id} — ${f.error}`));
      }
    } catch (err) {
      logger.error(`[SubscriptionRenewalJob] Cron error: ${err.message}`);
    }
  });

  logger.info('[SubscriptionRenewalJob] Subscription renewal cron started (every 30 min)');
  return job;
};

const stop = () => {
  if (job) {
    job.stop();
    logger.info('[SubscriptionRenewalJob] Cron stopped.');
  }
};

module.exports = { start, stop };
