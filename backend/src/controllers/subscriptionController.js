/**
 * controllers/subscriptionController.js
 */
const asyncHandler = require('../utils/asyncHandler');
const { subscriptionRepository } = require('../repositories');
const { sendCreated, sendSuccess } = require('../helpers/responseHelper');
const subscriptionService = require('../services/msGraph/subscriptionService');


const createSubscription = asyncHandler(async (req, res) => {
  const userCacheKey = req.headers['x-user-cache-key'] || null;
  const result = await subscriptionService.createSubscription(userCacheKey);
  return sendCreated(res, 'Graph webhook subscription created successfully.', result);
});

const renewSubscription = asyncHandler(async (req, res) => {
  const { subscriptionId } = req.body;
  if (!subscriptionId) {
    return res.status(400).json({ success: false, message: 'subscriptionId is required.' });
  }
  const userCacheKey = req.headers['x-user-cache-key'] || null;
  const result = await subscriptionService.renewSubscription(subscriptionId, userCacheKey);
  return sendSuccess(res, 'Subscription renewed.', result);
});

const listSubscriptions = asyncHandler(async (req, res) => {
  const subs = await subscriptionRepository.findAllActive();
  return sendSuccess(res, 'Active subscriptions.', { subscriptions: subs, count: subs.length });
});

module.exports = { createSubscription, renewSubscription, listSubscriptions };