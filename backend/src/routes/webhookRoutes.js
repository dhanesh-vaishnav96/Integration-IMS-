/**
 * routes/webhookRoutes.js
 *
 * NOTE: validateWebhook (GET) must NOT use JSON body parser —
 * Graph sends raw text. receiveNotification (POST) uses JSON.
 */
const express = require('express');
const { validateWebhook, receiveNotification } = require('../controllers/webhookController');

const router = express.Router();

// GET /api/v1/webhooks/teams?validationToken=...
// Called by Graph during subscription creation
router.get('/teams', validateWebhook);

// POST /api/v1/webhooks/teams
// Called by Graph when a meeting ends / recording is ready
router.post('/teams', receiveNotification);

module.exports = router;
