/**
 * validators/schedulingValidators.js
 *
 * Joi schemas for Scheduling API request validation (Phase A).
 */
const Joi = require('joi');

const participantSchema = Joi.object({
  email: Joi.string().email().lowercase().trim().required().messages({
    'any.required': 'Participant email is required',
    'string.email': 'Participant email must be a valid RFC compliant format',
  }),
  role: Joi.string().valid('PANELIST', 'OBSERVER', 'CANDIDATE', 'ORGANIZER').default('PANELIST'),
  name: Joi.string().trim().optional().allow(''),
  is_required: Joi.boolean().default(true),
  timezone_name: Joi.string().trim().optional().allow(''),
  timezone_offset: Joi.number().optional(),
});

const createScheduledInterviewSchema = Joi.object({
  title: Joi.string().trim().required().messages({
    'any.required': 'Interview title is required',
  }),
  candidate_id: Joi.string().required().messages({
    'any.required': 'Candidate is required',
    'string.empty': 'Candidate cannot be empty',
  }),
  scheduled_time: Joi.date().iso().greater('now').required().messages({
    'any.required': 'Scheduled time is required',
    'date.greater': 'Scheduled time cannot be in the past',
    'date.format': 'Invalid timestamp format',
  }),
  duration_minutes: Joi.number().integer().min(10).max(240).required().messages({
    'any.required': 'Duration is required',
    'number.min': 'Duration must be at least 10 minutes',
    'number.max': 'Duration cannot exceed 240 minutes',
    'number.integer': 'Duration must be an integer',
  }),
  participants: Joi.array().items(participantSchema).max(20).unique('email').messages({
    'array.max': 'Maximum of 20 panelists allowed',
    'array.unique': 'Duplicate participant emails are not allowed',
  }),
  instructions: Joi.string().trim().optional().allow(''),
  type: Joi.string().optional(),
  priority: Joi.string().optional(),
  meeting_provider: Joi.string().optional(),
  meeting_color: Joi.string().optional(),
  is_private: Joi.boolean().optional(),
  travel_buffer_minutes: Joi.number().integer().min(0).optional(),
  recurrence_rule: Joi.string().optional().allow(null),
  organizer_email: Joi.string().email().lowercase().trim().optional(),
  department: Joi.string().optional().allow(''),
  round: Joi.number().integer().optional(),
});

const updateScheduledInterviewSchema = createScheduledInterviewSchema.keys({
  title: Joi.string().trim().optional(),
  candidate_id: Joi.string().optional(),
  scheduled_time: Joi.date().iso().greater('now').optional().messages({
    'date.greater': 'Scheduled time cannot be in the past',
  }),
  duration_minutes: Joi.number().integer().min(10).max(240).optional(),
  organizer_email: Joi.string().email().lowercase().trim().optional(),
  participants: Joi.array().items(participantSchema).max(20).unique('email').optional(),
});

module.exports = {
  createScheduledInterviewSchema,
  updateScheduledInterviewSchema,
};
