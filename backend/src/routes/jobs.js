/**
 * Jobs Routes
 *
 * API endpoints for job submission and management.
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');

router.get('/tree', asyncHandler(jobController.getJobsTree));
router.get('/stage-outputs', asyncHandler(jobController.getStageOutputFiles));
router.post('/save-fasta', asyncHandler(jobController.saveFastaSequence));
router.post('/:jobType', asyncHandler(jobController.submitJob));
router.get('/:jobType/results/:jobId', asyncHandler(jobController.getJobResults));
router.get('/:jobType/summary', asyncHandler(jobController.getJobSummary));
router.get('/:jobId/outputs', asyncHandler(jobController.getJobOutputs));
router.get('/:jobId/progress', asyncHandler(jobController.getJobProgress));
router.get('/:jobId', asyncHandler(jobController.getJobDetails));
router.get('/browse', asyncHandler(jobController.browseFiles));

module.exports = router;
