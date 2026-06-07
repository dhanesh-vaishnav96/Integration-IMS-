/**
 * validateRequest.js
 *
 * Joi-based request validation middleware factory.
 * Accepts a Joi schema and returns an Express middleware
 * that validates req.body, req.params, or req.query.
 *
 * Usage:
 *   const { validateBody } = require('../middlewares/validateRequest');
 *   const { scheduleInterviewSchema } = require('../validators/interviewValidators');
 *
 *   router.post('/schedule', validateBody(scheduleInterviewSchema), asyncHandler(controller));
 */
const Joi = require('joi');
const { HTTP_STATUS } = require('../constants');

/**
 * Generic validator factory.
 * @param {Joi.Schema} schema - The Joi schema to validate against.
 * @param {string} source - One of 'body', 'params', 'query'.
 */
const validate = (schema, source) => (req, res, next) => {
  const { error, value } = schema.validate(req[source], {
    abortEarly: false,    // Collect all errors, not just the first one
    allowUnknown: false,  // Reject unknown fields
    stripUnknown: true,   // Remove fields not in schema (sanitization)
  });

  if (error) {
    const errors = error.details.map((detail) => ({
      field: detail.path.join('.'),
      message: detail.message.replace(/['"]/g, ''),
    }));

    return res.status(HTTP_STATUS.BAD_REQUEST).json({
      success: false,
      message: 'Validation Failed',
      errors,
    });
  }

  // Replace with sanitized/validated value
  req[source] = value;
  next();
};

const validateBody = (schema) => validate(schema, 'body');
const validateParams = (schema) => validate(schema, 'params');
const validateQuery = (schema) => validate(schema, 'query');

module.exports = { validateBody, validateParams, validateQuery };
