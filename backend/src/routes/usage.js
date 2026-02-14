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

/**
 * @swagger
 * /admin/usage:
 *   get:
 *     tags: [Admin]
 *     summary: Get compute usage report (admin only)
 *     parameters:
 *       - in: query
 *         name: start_date
 *         schema: { type: string, format: date-time }
 *         description: Start of date range (default 30 days ago)
 *       - in: query
 *         name: end_date
 *         schema: { type: string, format: date-time }
 *         description: End of date range (default now)
 *       - in: query
 *         name: group_by
 *         schema: { type: string, enum: [user, project, month] }
 *       - in: query
 *         name: format
 *         schema: { type: string, enum: [json, csv] }
 *     responses:
 *       200: { description: Usage report data }
 */
router.get('/', asyncHandler(usageController.getUsageReport));

module.exports = router;
