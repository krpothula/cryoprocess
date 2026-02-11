/**
 * Live Session Routes
 *
 * API endpoints for managing live processing sessions.
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/liveSessionController');

// Session CRUD
router.post('/', controller.createSession);

// Project sessions list (must be before /:id to avoid matching "project" as an id)
router.get('/project/:projectId', controller.listProjectSessions);

// Session by ID
router.get('/:id', controller.getSession);
router.delete('/:id', controller.deleteSession);

// Session lifecycle
router.post('/:id/start', controller.startSession);
router.post('/:id/pause', controller.pauseSession);
router.post('/:id/resume', controller.resumeSession);
router.post('/:id/stop', controller.stopSession);

// Session data
router.get('/:id/stats', controller.getSessionStats);
router.get('/:id/exposures', controller.getSessionExposures);
router.get('/:id/activity', controller.getSessionActivity);

module.exports = router;
