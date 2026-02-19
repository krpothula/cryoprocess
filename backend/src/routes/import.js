/**
 * Import Routes
 *
 * API endpoints for import job results, movie frames, and thumbnails.
 */

const express = require('express');
const router = express.Router();
const importController = require('../controllers/importController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/results/:jobId', asyncHandler(importController.getResults));
router.get('/movie-frame', asyncHandler(importController.getMovieFrame));
router.get('/movie-frames', asyncHandler(importController.getAllMovieFrames));
router.get('/thumbnail/:jobId/:filename', asyncHandler(importController.getThumbnail));
router.get('/mrc', asyncHandler(importController.getMrcVolume));
router.get('/logs', asyncHandler(importController.getLogs));
router.post('/parse-star', asyncHandler(importController.parseStar));
router.post('/mrc-info', asyncHandler(importController.getMrcFileInfo));

module.exports = router;
