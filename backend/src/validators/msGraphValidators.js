/**
 * validators/msGraphValidators.js
 *
 * Joi schemas for Microsoft Graph API routes.
 */
const Joi = require('joi');

// Validator for :meetingId param
// Graph API meeting IDs are base64-encoded strings, typically 100-300 chars
const meetingIdParamSchema = Joi.object({
  meetingId: Joi.string().min(10).max(500).required().messages({
    'string.min': 'Meeting ID is too short to be valid.',
    'string.max': 'Meeting ID is too long.',
    'any.required': 'Meeting ID is required.',
  }),
});

// Query params for the meeting lookup
const getMeetingQuerySchema = Joi.object({
  organizerUserId: Joi.string().trim().optional().messages({
    'string.base': 'Organizer user ID must be a string (AAD Object ID or email).',
  }),
});

// Query params for user listing
const listUsersQuerySchema = Joi.object({
  limit: Joi.number().integer().min(1).max(100).default(10).messages({
    'number.max': 'Maximum 100 users can be returned per request.',
  }),
});

// Query params for auth test
const authTestQuerySchema = Joi.object({
  mode: Joi.string().valid('delegated', 'application').optional().messages({
    'any.only': 'Mode must be either delegated or application.',
  }),
});

module.exports = {
  meetingIdParamSchema,
  getMeetingQuerySchema,
  listUsersQuerySchema,
  authTestQuerySchema,
};
