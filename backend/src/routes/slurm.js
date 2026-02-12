/**
 * SLURM API Routes
 *
 * Provides endpoints for SLURM partition, node, and job information.
 * Used by the frontend to populate job submission forms with cluster config.
 */

const express = require('express');
const router = express.Router();
const slurmController = require('../controllers/slurmController');
const asyncHandler = require('../utils/asyncHandler');

// Cluster information endpoints
router.get('/partitions', asyncHandler(slurmController.getPartitions));
router.get('/nodes', asyncHandler(slurmController.getNodes));
router.get('/status', asyncHandler(slurmController.getStatus));
router.get('/queue', asyncHandler(slurmController.getQueue));
router.get('/connection', asyncHandler(slurmController.getConnectionInfo));
router.get('/resource-limits', asyncHandler(slurmController.getResourceLimits));

// Job management endpoints
router.post('/cancel', asyncHandler(slurmController.cancelJob));
router.post('/validate', asyncHandler(slurmController.validateResources));

// Job-specific endpoints (by CryoScale job ID)
router.get('/jobs/:jobId/logs', asyncHandler(slurmController.getJobLogs));
router.get('/jobs/:jobId/logs/stream', asyncHandler(slurmController.streamJobLogs));
router.get('/jobs/:jobId/issues', asyncHandler(slurmController.getJobIssues));
router.post('/jobs/:jobId/cancel', asyncHandler(slurmController.cancelJobById));
router.delete('/jobs/:jobId', asyncHandler(slurmController.deleteJob));
router.patch('/jobs/:jobId/status', asyncHandler(slurmController.updateJobStatus));
router.patch('/jobs/:jobId/notify', asyncHandler(slurmController.toggleNotifyEmail));

// SLURM job details (by SLURM job ID)
router.get('/jobs/:slurmJobId/details', asyncHandler(slurmController.getJobDetails));

module.exports = router;
