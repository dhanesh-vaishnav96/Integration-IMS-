/**
 * repositories/subscriptionRepository.js
 */
const { GraphSubscription } = require('../models/GraphSubscription');

const subscriptionRepository = {
  async create(data) { return GraphSubscription.create(data); },

  async findById(subscriptionId) {
    return GraphSubscription.findOne({ subscription_id: subscriptionId });
  },

  async findAllActive() {
    return GraphSubscription.find({ is_active: true });
  },

  /** Find subscriptions expiring within the next N minutes */
  async findExpiringSoon(withinMinutes = 30) {
    const cutoff = new Date(Date.now() + withinMinutes * 60 * 1000);
    return GraphSubscription.find({ is_active: true, expiration_datetime: { $lte: cutoff } });
  },

  async updateRenewal(subscriptionId, newExpiration) {
    return GraphSubscription.findOneAndUpdate(
      { subscription_id: subscriptionId },
      {
        $set: { expiration_datetime: newExpiration, last_renewed_at: new Date() },
        $inc: { renewal_count: 1 },
      },
      { new: true }
    );
  },

  async deactivate(subscriptionId) {
    return GraphSubscription.findOneAndUpdate(
      { subscription_id: subscriptionId },
      { $set: { is_active: false } },
      { new: true }
    );
  },
};

module.exports = subscriptionRepository;
