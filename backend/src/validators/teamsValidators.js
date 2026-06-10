/**
 * validators/teamsValidators.js
 *
 * Joi schemas for Teams scheduling API routes.
 */
const Joi = require('joi');

const mongoIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).messages({
  'string.pattern.base': 'ID must be a valid MongoDB ObjectId (24 hex characters) or UUID',
});

/**
 * POST /api/v1/teams/schedule
 *
 * scheduleInterviewSchema validates the request body.
 * interview_id is required — the interview record MUST exist before Teams scheduling.
 * organizerUserId is optional — only needed in application auth mode.
 */
const scheduleInterviewSchema = Joi.object({
  interview_id: mongoIdSchema.required().messages({
    'any.required': 'interview_id is required. Create the interview first via POST /api/v1/interviews.',
  }),

  // Optional override for the auto-generated meeting subject
  subject_override: Joi.string().trim().min(3).max(250).optional().messages({
    'string.min': 'Subject override must be at least 3 characters.',
  }),

  // Required in application auth mode (AAD User ID of the organizer)
  // If omitted, falls back to GRAPH_ORGANIZER_USER_ID env var.
  organizer_user_id: Joi.string().trim().optional().messages({
    'string.base': 'organizer_user_id must be an AAD User Object ID or UPN.',
  }),

  // Phase 1: Array of panelist email addresses whose Outlook calendars will be blocked.
  // Leave empty or omit to skip calendar blocking.
  panelists: Joi.array()
    .items(
      Joi.string().email({ tlds: { allow: false } }).messages({
        'string.email': 'Each panelist must be a valid email address.',
      })
    )
    .max(20)
    .optional()
    .default([])
    .messages({
      'array.max': 'A maximum of 20 panelists can be selected per interview.',
    }),
});

/**
 * PUT /api/v1/teams/:id
 *
 * Updates an existing scheduled Teams meeting.
 * At least one of subject, scheduled_time, or duration_minutes must be provided.
 */
const updateScheduleSchema = Joi.object({
  subject: Joi.string().trim().min(3).max(250).optional(),
  scheduled_time: Joi.date().iso().optional().messages({
    'date.format': 'scheduled_time must be a valid ISO 8601 datetime (e.g., 2026-08-01T10:00:00Z)',
  }),
  duration_minutes: Joi.number().integer().min(10).max(480).optional(),
  organizer_user_id: Joi.string().trim().optional(),
  updated_by: Joi.string().email().optional(),
}).min(1).messages({
  'object.min': 'At least one field must be provided for update (subject, scheduled_time, or duration_minutes).',
});

/**
 * DELETE /api/v1/teams/:id
 */
const cancelScheduleSchema = Joi.object({
  organizer_user_id: Joi.string().trim().optional(),
  cancelled_by: Joi.string().email().optional(),
});

/**
 * Path param schema for interview ID
 */
const interviewIdParamSchema = Joi.object({
  id: mongoIdSchema.required().messages({ 'any.required': 'Interview ID is required.' }),
});

module.exports = {
  scheduleInterviewSchema,
  updateScheduleSchema,
  cancelScheduleSchema,
  interviewIdParamSchema,
};
