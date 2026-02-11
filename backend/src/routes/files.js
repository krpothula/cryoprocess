/**
 * Files Routes
 *
 * API endpoints for file browsing and access.
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const asyncHandler = require('../utils/asyncHandler');

// Browse files for job input
// GET /api/files?project_id=...&type=...&page=1&page_size=100
router.get('/', asyncHandler(fileController.browseFiles));

// Folder browser for navigating directories
// GET /api/files/browse?project_id=...&path=...&extensions=...&show_files=true
router.get('/browse', asyncHandler(fileController.browseFolder));

// Get file info
// GET /api/files/info?path=...&project_id=...
router.get('/info', asyncHandler(fileController.getFileInfo));

module.exports = router;
