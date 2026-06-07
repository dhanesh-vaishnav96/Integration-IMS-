/**
 * models/GraphSubscription.js
 *
 * Tracks active Microsoft Graph webhook subscriptions.
 * Graph subscriptions expire (max 60 minutes for online meetings resource).
 * Our renewal job (node-cron) reads this collection to renew before expiry.
 */
const mongoose = require('mongoose');

const graphSubscriptionSchema = new mongoose.Schema(
  {
    subscription_id: { type: String, required: true, unique: true, trim: true },
    resource: { type: String, required: true, trim: true }, // e.g., "communications/callRecords"
    change_type: { type: String, default: 'created', trim: true },
    notification_url: { type: String, required: true, trim: true },
    expiration_datetime: { type: Date, required: true },
    client_state: { type: String, required: true, trim: true }, // Secret for validation
    created_by: { type: String, trim: true, default: 'system' },
    is_active: { type: Boolean, default: true },
    last_renewed_at: { type: Date },
    renewal_count: { type: Number, default: 0 },
  },
  { timestamps: true }
);

graphSubscriptionSchema.index({ expiration_datetime: 1 });
graphSubscriptionSchema.index({ is_active: 1, expiration_datetime: 1 });

const GraphSubscription = mongoose.model('GraphSubscription', graphSubscriptionSchema);
module.exports = { GraphSubscription };
