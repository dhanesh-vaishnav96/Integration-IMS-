/**
 * routes/index.js (UPDATED - API Versioning)
 *
 * Main router that mounts versioned route groups.
 * /api/v1/* → v1/index.js
 *
 * Future:
 * /api/v2/* → v2/index.js (when breaking changes are needed)
 */
const express = require('express');
const v1Routes = require('./v1');

const router = express.Router();

router.use('/v1', v1Routes);

module.exports = router;
