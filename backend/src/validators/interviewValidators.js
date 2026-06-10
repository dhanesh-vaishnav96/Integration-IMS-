/**
 * validators/interviewValidators.js
 *
 * Joi schemas for Interview API request validation.
 */
const Joi = require('joi');

const mongoIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).messages({
  'string.pattern.base': 'ID must be a valid MongoDB ObjectId (24 hex characters) or UUID',
});

const createInterviewSchema = Joi.object({
  candidate_id: mongoIdSchema.required().messages({ 'any.required': 'Candidate ID is required' }),
  organizer_email: Joi.string().email().lowercase().trim().required().messages({
    'any.required': 'Organizer email is required',
    'string.email': 'Organizer email must be a valid email',
  }),
  interviewer_email: Joi.string().email().lowercase().trim().optional(),
  scheduled_time: Joi.date().iso().greater('now').required().messages({
    'any.required': 'Scheduled time is required',
    'date.greater': 'Scheduled time must be in the future',
  }),
  duration_minutes: Joi.number().integer().min(10).max(480).default(60),
  meeting_provider: Joi.string().valid('TEAMS', 'ZOOM', 'GOOGLE_MEET', 'IN_PERSON').default('TEAMS'),
  status: Joi.string().valid('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').default('SCHEDULED'),
  createdBy: Joi.string().email().optional(),
});

const updateInterviewSchema = Joi.object({
  organizer_email: Joi.string().email().lowercase().trim().optional(),
  interviewer_email: Joi.string().email().lowercase().trim().optional().allow(''),
  scheduled_time: Joi.date().iso().optional(),
  duration_minutes: Joi.number().integer().min(10).max(480).optional(),
  meeting_provider: Joi.string().valid('TEAMS', 'ZOOM', 'GOOGLE_MEET', 'IN_PERSON').optional(),
  status: Joi.string().valid('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
  teams_meeting_id: Joi.string().trim().optional(),
  meeting_join_url: Joi.string().uri().optional().allow(''),
  updatedBy: Joi.string().email().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

const interviewIdParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({ 'any.required': 'Interview ID is required' }),
});

const interviewQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('scheduled_time', 'createdAt', 'status').default('scheduled_time'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED').optional(),
  candidate_id: mongoIdSchema.optional(),
});

module.exports = { createInterviewSchema, updateInterviewSchema, interviewIdParamSchema, interviewQuerySchema };
