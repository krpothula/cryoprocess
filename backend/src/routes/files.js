/**
 * Files Routes
 *
 * API endpoints for file browsing and access.
 */

const express = require('express');
const router = express.Router();
const fileController = require('../controllers/fileController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/', asyncHandler(fileController.browseFiles));
router.get('/browse', asyncHandler(fileController.browseFolder));
router.get('/info', asyncHandler(fileController.getFileInfo));

module.exports = router;
