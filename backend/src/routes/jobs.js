/**
 * Jobs Routes
 *
 * API endpoints for job submission and management.
 */

const express = require('express');
const router = express.Router();
const jobController = require('../controllers/jobController');
const asyncHandler = require('../utils/asyncHandler');

/**
 * @swagger
 * /jobs/tree:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job tree for a project
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Hierarchical job tree }
 */
router.get('/tree', asyncHandler(jobController.getJobsTree));

/**
 * @swagger
 * /jobs/stage-outputs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get output files from completed jobs by stage
 *     parameters:
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: stages
 *         schema: { type: string }
 *         description: Comma-separated stage names (e.g. Extract,Subset)
 *       - in: query
 *         name: file_type
 *         schema: { type: string }
 *         description: File extension filter (e.g. star, mrc)
 *     responses:
 *       200: { description: Stage output files }
 */
router.get('/stage-outputs', asyncHandler(jobController.getStageOutputFiles));

/**
 * @swagger
 * /jobs/save-fasta:
 *   post:
 *     tags: [Jobs]
 *     summary: Save a pasted FASTA sequence as a file
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project_id: { type: string }
 *               sequence: { type: string }
 *     responses:
 *       200: { description: FASTA file saved }
 */
router.post('/save-fasta', asyncHandler(jobController.saveFastaSequence));

/**
 * @swagger
 * /jobs/{jobType}:
 *   post:
 *     tags: [Jobs]
 *     summary: Submit a new job
 *     parameters:
 *       - in: path
 *         name: jobType
 *         required: true
 *         schema: { type: string }
 *         description: Job type (e.g. Import, MotionCorr, CtfFind, Class2D)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               project_id: { type: string }
 *               params: { type: object }
 *     responses:
 *       201: { description: Job submitted }
 *       400: { description: Validation error }
 */
router.post('/:jobType', asyncHandler(jobController.submitJob));

/**
 * @swagger
 * /jobs/{jobType}/results/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job results
 *     parameters:
 *       - in: path
 *         name: jobType
 *         required: true
 *         schema: { type: string }
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job results }
 */
router.get('/:jobType/results/:jobId', asyncHandler(jobController.getJobResults));

/**
 * @swagger
 * /jobs/{jobType}/summary:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job summary for a project
 *     parameters:
 *       - in: path
 *         name: jobType
 *         required: true
 *         schema: { type: string }
 *       - in: query
 *         name: project_id
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job summary }
 */
router.get('/:jobType/summary', asyncHandler(jobController.getJobSummary));

/**
 * @swagger
 * /jobs/{jobId}/outputs:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job output files and downstream suggestions
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job outputs }
 */
router.get('/:jobId/outputs', asyncHandler(jobController.getJobOutputs));

/**
 * @swagger
 * /jobs/{jobId}/progress:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job progress (for dashboard polling)
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200: { description: Job progress }
 */
router.get('/:jobId/progress', asyncHandler(jobController.getJobProgress));

/**
 * @swagger
 * /jobs/{jobId}:
 *   get:
 *     tags: [Jobs]
 *     summary: Get job details by ID
 *     parameters:
 *       - in: path
 *         name: jobId
 *         required: true
 *         schema: { type: string }
 *     responses:
 *       200:
 *         description: Job details
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/Job' }
 */
router.get('/:jobId', asyncHandler(jobController.getJobDetails));

/**
 * @swagger
 * /jobs/browse:
 *   get:
 *     tags: [Jobs]
 *     summary: Browse files for job input selection
 *     parameters:
 *       - in: query
 *         name: project_id
 *         schema: { type: string }
 *       - in: query
 *         name: type
 *         schema: { type: string }
 *     responses:
 *       200: { description: File listing }
 */
router.get('/browse', asyncHandler(jobController.browseFiles));

module.exports = router;
