/**
 * routes/v1/index.js
 *
 * Version 1 API router — mounts all domain route groups under /api/v1.
 */
const express = require('express');
const healthRoutes        = require('../healthRoutes');
const candidateRoutes     = require('../candidateRoutes');
const interviewRoutes     = require('../interviewRoutes');
const msGraphRoutes       = require('../msGraphRoutes');
const teamsRoutes         = require('../teamsRoutes');
const webhookRoutes       = require('../webhookRoutes');
const subscriptionRoutes  = require('../subscriptionRoutes');
const dashboardRoutes     = require('../dashboardRoutes');
const schedulingRoutes    = require('../schedulingRoutes');
const verificationRoutes  = require('../verificationRoutes');  // Phase 1 verification
const { protect, authorize } = require('../../middlewares/authMiddleware');
const { candidateLimiter, schedulingLimiter, webhookLimiter, teamsLimiter } = require('../../middlewares/rateLimiter');

const router = express.Router();

// Health
router.use('/health', healthRoutes);

// Core Domain APIs (public for dev — restore protect in production)
router.use('/candidates',    candidateLimiter, candidateRoutes);
router.use('/interviews',    interviewRoutes);

// Microsoft Graph Auth
router.use('/ms', msGraphRoutes);

// Teams Scheduling (auth-gated — DEV_BYPASS_AUTH=true allows bypassing in dev)
router.use('/teams', protect, authorize('admin', 'hr'), teamsLimiter, teamsRoutes);

// Webhooks & Subscriptions
router.use('/webhooks/graph', webhookLimiter); // Apply strictly to webhooks/graph first, but since the route handles it inside webhookRoutes, we can apply it to the whole webhookRoutes or just '/webhooks' if we want. Wait, the requirement says "Protect: /api/v1/webhooks/graph". If we apply webhookLimiter to '/webhooks/graph' it will match before router.use('/webhooks', ...).
router.use('/webhooks',      webhookRoutes);
router.use('/subscriptions', protect, authorize('admin'), subscriptionRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// Interview Scheduling Module — Teams Calendar Parity
router.use('/scheduling', schedulingLimiter, schedulingRoutes);

// Phase 1 Verification & Diagnostics (dev only — returns 403 in production)
router.use('/verify', verificationRoutes);

module.exports = router;
