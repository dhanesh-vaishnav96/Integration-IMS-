/**
 * routes/subscriptionRoutes.js
 */
const express = require('express');
const { createSubscription, renewSubscription, listSubscriptions } = require('../controllers/subscriptionController');

const router = express.Router();

router.post('/create', createSubscription);
router.post('/renew', renewSubscription);
router.get('/', listSubscriptions);

module.exports = router;
