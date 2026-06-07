/**
 * models/WebhookEvent.js
 *
 * Persists every incoming Graph webhook notification.
 * Used for:
 *   1. Idempotency: prevent processing the same event twice
 *   2. Audit trail: full event history
 *   3. Retry: re-process FAILED events
 */
const mongoose = require('mongoose');

const webhookEventSchema = new mongoose.Schema(
  {
    // Microsoft's unique event identifier (use for deduplication)
    change_id: { type: String, required: true, unique: true, trim: true },
    subscription_id: { type: String, required: true, trim: true, index: true },
    resource: { type: String, required: true, trim: true },
    change_type: { type: String, required: true, trim: true },
    resource_data: { type: mongoose.Schema.Types.Mixed }, // Raw Graph resource data
    raw_payload: { type: mongoose.Schema.Types.Mixed },  // Full notification payload
    // Processing lifecycle
    status: {
      type: String,
      enum: ['RECEIVED', 'QUEUED', 'PROCESSING', 'PROCESSED', 'FAILED', 'IGNORED'],
      default: 'RECEIVED',
      index: true,
    },
    error_message: { type: String },
    processed_at: { type: Date },
    retry_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

webhookEventSchema.index({ change_id: 1 }, { unique: true });
webhookEventSchema.index({ status: 1, createdAt: -1 });

const WebhookEvent = mongoose.model('WebhookEvent', webhookEventSchema);
module.exports = { WebhookEvent };
