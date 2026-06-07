/**
 * repositories/webhookEventRepository.js
 */
const { WebhookEvent } = require('../models/WebhookEvent');

const webhookEventRepository = {
  /** Check if event already exists (idempotency) */
  async existsByChangeId(changeId) {
    return (await WebhookEvent.countDocuments({ change_id: changeId })) > 0;
  },

  async create(data) { return WebhookEvent.create(data); },

  async updateStatus(changeId, status, extra = {}) {
    return WebhookEvent.findOneAndUpdate(
      { change_id: changeId },
      { $set: { status, ...extra, ...(status === 'PROCESSED' ? { processed_at: new Date() } : {}) } },
      { new: true }
    );
  },

  async findPending(limit = 50) {
    return WebhookEvent.find({ status: 'RECEIVED' }).sort({ createdAt: 1 }).limit(limit);
  },

  async findFailed(limit = 20) {
    return WebhookEvent.find({ status: 'FAILED', retry_count: { $lt: 5 } })
      .sort({ createdAt: 1 })
      .limit(limit);
  },

  async incrementRetry(changeId) {
    return WebhookEvent.findOneAndUpdate(
      { change_id: changeId },
      { $inc: { retry_count: 1 } },
      { new: true }
    );
  },
};

module.exports = webhookEventRepository;
