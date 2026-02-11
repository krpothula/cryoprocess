/**
 * Import Routes
 *
 * API endpoints for import job results, movie frames, and thumbnails.
 */

const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const asyncHandler = require('../utils/asyncHandler');

// Get import job results
// GET /api/import/results/:jobId
router.get('/results/:jobId', asyncHandler(importController.getResults));

// Get single movie frame
// GET /api/import/movie-frame?path=...&job_id=...&frame=...
router.get('/movie-frame', asyncHandler(importController.getMovieFrame));

// Get all movie frames as base64
// GET /api/import/movie-frames?path=...&job_id=...&max_frames=50
router.get('/movie-frames', asyncHandler(importController.getAllMovieFrames));

// Get pre-generated thumbnail
// GET /api/import/thumbnail/:jobId/:filename
router.get('/thumbnail/:jobId/:filename', asyncHandler(importController.getThumbnail));

// Get MRC volume file for 3D visualization
// GET /api/import/mrc?job_id=...
router.get('/mrc', asyncHandler(importController.getMrcVolume));

// Get import logs
// GET /api/import/logs?project_id=...&job_id=...
router.get('/logs', asyncHandler(importController.getLogs));

// Parse STAR file (for testing/direct use)
// POST /api/import/parse-star
router.post('/parse-star', asyncHandler(importController.parseStar));

// Get MRC file info (for testing/direct use)
// POST /api/import/mrc-info
router.post('/mrc-info', asyncHandler(importController.getMrcFileInfo));

module.exports = router;
