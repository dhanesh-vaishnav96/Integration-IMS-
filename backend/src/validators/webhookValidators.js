/**
 * validators/webhookValidators.js
 *
 * Payload validation for Microsoft Graph Webhooks.
 */
const Joi = require('joi');

const graphWebhookPayloadSchema = Joi.object({
  value: Joi.array().items(
    Joi.object({
      subscriptionId: Joi.string().required(),
      subscriptionExpirationDateTime: Joi.string().isoDate().optional(),
      changeType: Joi.string().required(),
      resource: Joi.string().required(),
      resourceData: Joi.object().optional(),
      clientState: Joi.string().optional(),
      tenantId: Joi.string().optional()
    }).unknown(true)
  ).required()
}).unknown(true);

const validateGraphWebhook = (payload) => {
  return graphWebhookPayloadSchema.validate(payload, { abortEarly: false });
};

module.exports = {
  validateGraphWebhook
};
