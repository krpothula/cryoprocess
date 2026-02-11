/**
 * Users Routes
 *
 * API endpoints for user-related operations (non-admin).
 */

const express = require('express');
const router = express.Router();
const projectMemberController = require('../controllers/projectMemberController');
const asyncHandler = require('../utils/asyncHandler');

// Search users (for project member invitations)
// GET /api/users/search?q=query
router.get('/search', asyncHandler(projectMemberController.searchUsers));

module.exports = router;
