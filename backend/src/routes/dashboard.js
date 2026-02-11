/**
 * Dashboard Routes
 *
 * Provides dashboard data for all job types.
 */

const express = require('express');
const router = express.Router();
const dashboardController = require('../controllers/dashboardController');
const asyncHandler = require('../utils/asyncHandler');

// Motion correction dashboard
router.get('/motion/:jobId', asyncHandler(dashboardController.getMotionDashboard));
router.get('/motion/:jobId/micrographs', asyncHandler(dashboardController.getMotionMicrographs));

// CTF estimation dashboard
router.get('/ctf/:jobId', asyncHandler(dashboardController.getCtfDashboard));
router.get('/ctf/:jobId/micrographs', asyncHandler(dashboardController.getCtfMicrographs));

// Auto-picking dashboard
router.get('/autopick/:jobId', asyncHandler(dashboardController.getAutopickDashboard));
router.get('/autopick/:jobId/micrographs', asyncHandler(dashboardController.getAutopickMicrographs));

// Particle extraction dashboard
router.get('/extract/:jobId', asyncHandler(dashboardController.getExtractDashboard));

// Class selection APIs (for Select/ManualSelect jobs) - MUST come before :jobId routes
router.get('/class2d/individual-images/', asyncHandler(dashboardController.getClass2dIndividualImages));
router.post('/class2d/save-selection/', asyncHandler(dashboardController.saveSelectedClasses));
router.get('/manualselect/results/', asyncHandler(dashboardController.getManualSelectResults));

// 2D Classification dashboard
router.get('/class2d/:jobId', asyncHandler(dashboardController.getClass2dDashboard));
router.get('/class2d/:jobId/classes', asyncHandler(dashboardController.getClass2dClasses));

// Import dashboard
router.get('/import/:jobId', asyncHandler(dashboardController.getImportDashboard));

// Generic job output
router.get('/output/:jobId', asyncHandler(dashboardController.getJobOutput));
router.get('/logs/:jobId', asyncHandler(dashboardController.getJobLogs));

// Cached dashboard endpoints (thumbnails, stats)
router.get('/thumbnail/:jobId/:filename', asyncHandler(dashboardController.getCachedThumbnail));
router.get('/thumbnails/:jobId', asyncHandler(dashboardController.listCachedThumbnails));
router.get('/stats/:jobId', asyncHandler(dashboardController.getCachedStats));
router.get('/postprocess-status/:jobId', asyncHandler(dashboardController.getPostProcessStatus));

// Generate thumbnails for a job (POST to trigger generation)
router.post('/thumbnails/:jobId/generate', asyncHandler(dashboardController.generateThumbnails));

module.exports = router;
