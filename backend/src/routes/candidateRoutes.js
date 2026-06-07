/**
 * routes/candidateRoutes.js
 *
 * Route definitions for the Candidate module.
 * Middleware chain per route:
 *   [validate params/query] → [validate body] → [controller]
 *
 * All routes will require JWT auth in production (protect middleware).
 * Phase 2: auth middleware is commented — enable in Phase 4 (Auth module).
 */
const express = require('express');
const candidateController = require('../controllers/candidateController');
const assetController = require('../controllers/assetController');
const { validateBody, validateParams, validateQuery } = require('../middlewares/validateRequest');
const {
  createCandidateSchema,
  updateCandidateSchema,
  candidateIdParamSchema,
  candidateQuerySchema,
} = require('../validators/candidateValidators');
// const { protect } = require('../middlewares/authMiddleware'); // Enable in Phase 4

const router = express.Router();

// POST /api/v1/candidates
router.post(
  '/',
  validateBody(createCandidateSchema),
  candidateController.createCandidate
);

// GET /api/v1/candidates?page=1&limit=10&search=...&status=ACTIVE
router.get(
  '/',
  validateQuery(candidateQuerySchema),
  candidateController.getCandidates
);

// GET /api/v1/candidates/:id
router.get(
  '/:id',
  validateParams(candidateIdParamSchema),
  candidateController.getCandidateById
);

// PUT /api/v1/candidates/:id
router.put(
  '/:id',
  validateParams(candidateIdParamSchema),
  validateBody(updateCandidateSchema),
  candidateController.updateCandidate
);

// DELETE /api/v1/candidates/:id  (soft delete)
router.delete(
  '/:id',
  validateParams(candidateIdParamSchema),
  candidateController.deleteCandidate
);

// GET /api/v1/candidates/:id/assets  (recordings + transcripts for this candidate)
router.get(
  '/:id/assets',
  validateParams(candidateIdParamSchema),
  assetController.getCandidateAssets
);

module.exports = router;
