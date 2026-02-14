/**
 * Audit Routes
 *
 * Admin-only audit log viewing.
 */

const express = require('express');
const router = express.Router();
const auditController = require('../controllers/auditController');
const { isAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// All routes require admin privileges
router.use(isAdmin);

router.get('/', asyncHandler(auditController.listAuditLogs));

module.exports = router;
