/**
 * routes/dashboardRoutes.js
 */
const express = require('express');
const dashboardController = require('../controllers/dashboardController');

const router = express.Router();

router.get('/candidate/:id', dashboardController.getCandidateDashboard);
router.get('/candidate/:id/asset-links', dashboardController.getAssetLinks);

module.exports = router;
