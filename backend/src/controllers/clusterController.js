/**
 * Cluster Controller
 *
 * Handles SLURM cluster configuration and status endpoints.
 */

const { execCommand } = require('../utils/remoteExec');
const logger = require('../utils/logger');
const { getMonitor } = require('../services/slurmMonitor');
const Job = require('../models/Job');
const response = require('../utils/responseHelper');
const { JOB_STATUS } = require('../config/constants');

// In-memory cluster config (could be moved to MongoDB)
let clusterConfig = {
  defaultPartition: process.env.SLURM_PARTITION || 'normal',
  defaultThreads: parseInt(process.env.DEFAULT_THREADS) || 4,
  defaultGpus: parseInt(process.env.DEFAULT_GPUS) || 1,
  slurmEnabled: process.env.SLURM_ENABLED !== 'false',
  singularityImage: process.env.SINGULARITY_IMAGE || '',
  mpiCommand: process.env.MPI_COMMAND || 'mpirun'
};

/**
 * Get cluster status
 */
exports.getStatus = async (req, res) => {
  try {
    const monitor = getMonitor();

    // Check if SLURM is available
    const slurmAvailable = await execCommand('sinfo', ['--version'])
      .then(() => true)
      .catch(() => false);

    // Get running job counts
    const runningJobs = await Job.countDocuments({ status: JOB_STATUS.RUNNING });
    const pendingJobs = await Job.countDocuments({ status: JOB_STATUS.PENDING });

    res.json({
      success: true,
      status: 'success',
      data: {
        slurm: {
          available: slurmAvailable,
          enabled: clusterConfig.slurmEnabled
        },
        jobs: {
          running: runningJobs,
          pending: pendingJobs
        },
        config: {
          defaultPartition: clusterConfig.defaultPartition,
          singularityAvailable: !!clusterConfig.singularityImage
        }
      }
    });
  } catch (error) {
    logger.error(`[Cluster] Status error: ${error.message}`);
    return response.serverError(res, 'Failed to get cluster status');
  }
};

/**
 * Get SLURM queue status
 */
exports.getQueueStatus = async (req, res) => {
  try {
    const monitor = getMonitor();
    const queueStatus = await monitor.getQueueStatus();

    return response.success(res, queueStatus);
  } catch (error) {
    logger.error(`[Cluster] Queue status error: ${error.message}`);
    return response.serverError(res, 'Failed to get queue status');
  }
};

/**
 * Get SLURM job details
 */
exports.getJobDetails = async (req, res) => {
  try {
    const { slurmJobId } = req.params;
    const monitor = getMonitor();

    const details = await monitor.getJobDetails(slurmJobId);

    if (!details) {
      return response.notFound(res, 'SLURM job not found');
    }

    return response.success(res, details);
  } catch (error) {
    logger.error(`[Cluster] Job details error: ${error.message}`);
    return response.serverError(res, 'Failed to get job details');
  }
};

/**
 * Cancel a SLURM job
 */
exports.cancelJob = async (req, res) => {
  try {
    const { slurmJobId } = req.params;

    // Find the job in our database
    const job = await Job.findOne({ slurm_job_id: slurmJobId });

    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Check if user owns the job or is admin
    if (job.user_id !== req.user.id && !req.user.is_superuser) {
      return response.forbidden(res, 'Not authorized to cancel this job');
    }

    const monitor = getMonitor();
    const success = await monitor.cancelJob(slurmJobId);

    if (success) {
      // Update job status
      await Job.findOneAndUpdate(
        { slurm_job_id: slurmJobId },
        {
          status: JOB_STATUS.CANCELLED,
          end_time: new Date(),
          updated_at: new Date()
        }
      );

      return response.success(res, { message: 'Job cancelled' });
    } else {
      return response.serverError(res, 'Failed to cancel job');
    }
  } catch (error) {
    logger.error(`[Cluster] Cancel job error: ${error.message}`);
    return response.serverError(res, 'Failed to cancel job');
  }
};

/**
 * Get cluster configuration (admin only)
 */
exports.getConfig = async (req, res) => {
  res.json({
    success: true,
      status: 'success',
    data: clusterConfig
  });
};

/**
 * Update cluster configuration (admin only)
 */
exports.updateConfig = async (req, res) => {
  try {
    const updates = req.body;

    // Only allow specific fields to be updated
    const allowedFields = [
      'defaultPartition',
      'defaultThreads',
      'defaultGpus',
      'slurmEnabled',
      'singularityImage',
      'mpiCommand'
    ];

    for (const field of allowedFields) {
      if (updates[field] !== undefined) {
        clusterConfig[field] = updates[field];
      }
    }

    logger.info(`[Cluster] Config updated by user ${req.user.id}`);

    res.json({
      success: true,
      status: 'success',
      data: clusterConfig
    });
  } catch (error) {
    logger.error(`[Cluster] Update config error: ${error.message}`);
    return response.serverError(res, 'Failed to update configuration');
  }
};

/**
 * Get available SLURM partitions
 */
exports.getPartitions = async (req, res) => {
  try {
    const partitions = await execCommand('sinfo', ['--format=%P|%a|%D|%t', '--noheader'])
      .then(({ stdout }) => {
        const lines = stdout.trim().split('\n').filter(l => l);
        const partitionMap = {};

        for (const line of lines) {
          const [name, avail, nodes, state] = line.split('|').map(s => s.trim());
          const partName = name.replace('*', ''); // Remove default marker

          if (!partitionMap[partName]) {
            partitionMap[partName] = {
              name: partName,
              isDefault: name.includes('*'),
              available: avail === 'up',
              nodes: { total: 0, idle: 0, allocated: 0, down: 0 }
            };
          }

          const nodeCount = parseInt(nodes) || 0;
          partitionMap[partName].nodes.total += nodeCount;

          if (state === 'idle') {
            partitionMap[partName].nodes.idle += nodeCount;
          } else if (state === 'alloc' || state === 'mix') {
            partitionMap[partName].nodes.allocated += nodeCount;
          } else if (state === 'down' || state === 'drain') {
            partitionMap[partName].nodes.down += nodeCount;
          }
        }

        return Object.values(partitionMap);
      })
      .catch(() => []);

    res.json({
      success: true,
      status: 'success',
      data: partitions
    });
  } catch (error) {
    logger.error(`[Cluster] Get partitions error: ${error.message}`);
    return response.serverError(res, 'Failed to get partitions');
  }
};
