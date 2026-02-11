/**
 * Cluster Configuration Routes
 *
 * Handles SLURM cluster configuration and status.
 */

const express = require('express');
const router = express.Router();
const clusterController = require('../controllers/clusterController');
const { isAdmin } = require('../middleware/auth');
const asyncHandler = require('../utils/asyncHandler');

// Get cluster status (all authenticated users)
router.get('/status', asyncHandler(clusterController.getStatus));

// Get queue status
router.get('/queue', asyncHandler(clusterController.getQueueStatus));

// Get job details
router.get('/jobs/:slurmJobId', asyncHandler(clusterController.getJobDetails));

// Cancel a job
router.post('/jobs/:slurmJobId/cancel', asyncHandler(clusterController.cancelJob));

// Get cluster configuration (admin only)
router.get('/config', isAdmin, asyncHandler(clusterController.getConfig));

// Update cluster configuration (admin only)
router.patch('/config', isAdmin, asyncHandler(clusterController.updateConfig));

// Get available partitions
router.get('/partitions', asyncHandler(clusterController.getPartitions));

module.exports = router;
