/**
 * Usage Routes
 *
 * Admin-only usage reporting endpoints.
 */

const express = require('express');
const router = express.Router();
const usageController = require('../controllers/usageController');
const { isAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

router.use(isAdmin);

router.get('/', asyncHandler(usageController.getUsageReport));

module.exports = router;
