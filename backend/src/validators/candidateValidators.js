/**
 * validators/candidateValidators.js
 */
const Joi = require('joi');

const mongoIdSchema = Joi.string().pattern(/^[0-9a-fA-F]{24}$|^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/).messages({
  'string.pattern.base': 'ID must be a valid MongoDB ObjectId (24 hex characters) or UUID',
  'any.required': 'ID is required',
});

const createCandidateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).required().messages({
    'string.min': 'Name must be at least 2 characters',
    'string.max': 'Name cannot exceed 150 characters',
    'any.required': 'Candidate name is required',
  }),
  email: Joi.string().email().lowercase().trim().required().messages({
    'string.email': 'Please provide a valid email address',
    'any.required': 'Email is required',
  }),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{7,20}$/).optional().messages({
    'string.pattern.base': 'Please provide a valid phone number',
  }),
  job_role: Joi.string().trim().min(2).max(100).required().messages({
    'any.required': 'Job role is required',
  }),
  years_of_experience: Joi.number().min(0).max(50).default(0),
  resume_url: Joi.string().uri().optional().messages({ 'string.uri': 'Resume URL must be a valid URL' }),
  skills: Joi.array().items(Joi.string().trim().min(1).max(50)).max(30).default([]).messages({
    'array.max': 'Cannot have more than 30 skills',
  }),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'HIRED', 'REJECTED', 'ON_HOLD').default('ACTIVE'),
  createdBy: Joi.string().email().optional(),
});

const updateCandidateSchema = Joi.object({
  name: Joi.string().trim().min(2).max(150).optional(),
  phone: Joi.string().pattern(/^\+?[\d\s\-()]{7,20}$/).optional().allow(''),
  job_role: Joi.string().trim().min(2).max(100).optional(),
  years_of_experience: Joi.number().min(0).max(50).optional(),
  resume_url: Joi.string().uri().optional().allow(''),
  skills: Joi.array().items(Joi.string().trim().min(1).max(50)).max(30).optional(),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'HIRED', 'REJECTED', 'ON_HOLD').optional(),
  updatedBy: Joi.string().email().optional(),
}).min(1).messages({ 'object.min': 'At least one field must be provided for update' });

const candidateIdParamSchema = Joi.object({
  id: mongoIdSchema.required(),
});

const candidateQuerySchema = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  limit: Joi.number().integer().min(1).max(100).default(10),
  sortBy: Joi.string().valid('name', 'createdAt', 'years_of_experience').default('createdAt'),
  sortOrder: Joi.string().valid('asc', 'desc').default('desc'),
  status: Joi.string().valid('ACTIVE', 'INACTIVE', 'HIRED', 'REJECTED', 'ON_HOLD').optional(),
  job_role: Joi.string().trim().optional(),
  search: Joi.string().trim().min(2).max(100).optional().messages({
    'string.min': 'Search term must be at least 2 characters',
  }),
});

module.exports = { createCandidateSchema, updateCandidateSchema, candidateIdParamSchema, candidateQuerySchema };
