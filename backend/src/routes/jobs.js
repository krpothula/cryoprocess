/**
 * Jobs Routes
 *
 * API endpoints for job submission and management.
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');

// Get job tree for a project (hierarchical view)
// GET /api/jobs/tree?project_id=...
// NOTE: Must be before /:jobType routes to avoid matching 'tree' as a job type
router.get('/tree', asyncHandler(jobController.getJobsTree));

// Get output files from completed jobs by stage (database-backed)
// GET /api/jobs/stage-outputs?project_id=...&stages=Extract,Subset&file_type=star
router.get('/stage-outputs', asyncHandler(jobController.getStageOutputFiles));

// Save pasted FASTA sequence as a file
// POST /api/jobs/save-fasta
// NOTE: Must be before /:jobType to avoid matching 'save-fasta' as a job type
router.post('/save-fasta', asyncHandler(jobController.saveFastaSequence));

// Submit a job
// POST /api/jobs/:jobType
router.post('/:jobType', asyncHandler(jobController.submitJob));

// Get job results
// GET /api/jobs/:jobType/results/:jobId
router.get('/:jobType/results/:jobId', asyncHandler(jobController.getJobResults));

// Get job summary for a project
// GET /api/jobs/:jobType/summary?project_id=...
router.get('/:jobType/summary', asyncHandler(jobController.getJobSummary));

// Get job output files and downstream suggestions (for auto-population)
// GET /api/jobs/:jobId/outputs
router.get('/:jobId/outputs', asyncHandler(jobController.getJobOutputs));

// Get job progress (on-demand polling for dashboard)
// GET /api/jobs/:jobId/progress
router.get('/:jobId/progress', asyncHandler(jobController.getJobProgress));

// Get job details by ID
// GET /api/jobs/:jobId
router.get('/:jobId', asyncHandler(jobController.getJobDetails));

// Browse files for job input selection
// GET /api/files?project_id=...&type=...
router.get('/browse', asyncHandler(jobController.browseFiles));

module.exports = router;
