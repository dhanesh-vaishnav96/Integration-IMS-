/**
 * routes/interviewRoutes.js
 *
 * Route definitions for the Interview module.
 * Includes nested /assets sub-route.
 */
const express = require('express');
const interviewController = require('../controllers/interviewController');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validateRequest');
const {
  createInterviewSchema,
  updateInterviewSchema,
  interviewIdParamSchema,
  interviewQuerySchema,
} = require('../validators/interviewValidators');

const router = express.Router();

// POST /api/v1/interviews
router.post(
  '/',
  validateBody(createInterviewSchema),
  interviewController.createInterview
);

// GET /api/v1/interviews?page=1&limit=10&status=SCHEDULED&candidate_id=...
router.get(
  '/',
  validateQuery(interviewQuerySchema),
  interviewController.getInterviews
);

// GET /api/v1/interviews/:id
router.get(
  '/:id',
  validateParams(interviewIdParamSchema),
  interviewController.getInterviewById
);

// PUT /api/v1/interviews/:id
router.put(
  '/:id',
  validateParams(interviewIdParamSchema),
  validateBody(updateInterviewSchema),
  interviewController.updateInterview
);

// DELETE /api/v1/interviews/:id  (soft delete)
router.delete(
  '/:id',
  validateParams(interviewIdParamSchema),
  interviewController.deleteInterview
);

// GET /api/v1/interviews/:id/assets
router.get(
  '/:id/assets',
  validateParams(interviewIdParamSchema),
  interviewController.getInterviewAssets
);
// GET /api/v1/interviews/:id/assets/transcript/content
router.get(
  '/:id/assets/transcript/content',
  validateParams(interviewIdParamSchema),
  interviewController.getTranscriptContent
);

module.exports = router;
