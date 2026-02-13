/**
 * SmartScope Routes
 *
 * REST API endpoints for SmartScope integration (session/watch mode).
 *
 * #  Method  Endpoint                          Purpose
 * 1  GET     /api/smartscope/health             Check CryoProcess is alive
 * 2  POST    /api/smartscope/start              Start watching a directory
 * 3  GET     /api/smartscope/results/:sessionId Get completed micrograph results
 * 4  POST    /api/smartscope/stop/:sessionId    Stop watching
 * 5  POST    /api/smartscope/pause/:sessionId   Pause watching
 * 6  POST    /api/smartscope/resume/:sessionId  Resume watching
 */

const express = require('express');
const router = express.Router();
const controller = require('../controllers/smartscopeController');

router.get('/health', controller.health);
router.post('/start', controller.startSession);
router.get('/results/:sessionId', controller.getResults);
router.post('/stop/:sessionId', controller.stopSession);
router.post('/pause/:sessionId', controller.pauseSession);
router.post('/resume/:sessionId', controller.resumeSession);

module.exports = router;
