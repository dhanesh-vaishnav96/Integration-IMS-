/**
 * routes/v1/index.js
 *
 * Version 1 API router — mounts all domain route groups under /api/v1.
 */
const express = require('express');
const healthRoutes      = require('../healthRoutes');
const candidateRoutes   = require('../candidateRoutes');
const interviewRoutes   = require('../interviewRoutes');
const msGraphRoutes     = require('../msGraphRoutes');
const teamsRoutes       = require('../teamsRoutes');
const webhookRoutes     = require('../webhookRoutes');
const subscriptionRoutes = require('../subscriptionRoutes');
const dashboardRoutes   = require('../dashboardRoutes');
const schedulingRoutes  = require('../schedulingRoutes');
const { protect, authorize } = require('../../middlewares/authMiddleware');

const router = express.Router();

// Health
router.use('/health', healthRoutes);

// Core Domain APIs (public for dev — restore protect in production)
router.use('/candidates',    candidateRoutes);
router.use('/interviews',    interviewRoutes);

// Microsoft Graph Auth
router.use('/ms', msGraphRoutes);

// Teams Scheduling (auth-gated)
router.use('/teams', protect, authorize('admin', 'hr'), teamsRoutes);

// Webhooks & Subscriptions
router.use('/webhooks',      webhookRoutes);
router.use('/subscriptions', protect, authorize('admin'), subscriptionRoutes);

// Dashboard
router.use('/dashboard', dashboardRoutes);

// Interview Scheduling Module — Teams Calendar Parity
router.use('/scheduling', schedulingRoutes);

module.exports = router;
