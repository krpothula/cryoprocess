/**
 * SLURM Controller
 *
 * Handles SLURM-specific API endpoints for partitions, nodes, status, and job management.
 */

const { execCommand, isSSHMode, getSSHStatus } = require('../utils/remoteExec');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const { getMonitor } = require('../services/slurmMonitor');
const Job = require('../models/Job');
const Project = require('../models/Project');
const { getProjectPath } = require('../utils/pathUtils');
const { sanitizePartition, sanitizeUsername, sanitizeSlurmJobId } = require('../utils/security');
const response = require('../utils/responseHelper');
const { JOB_STATUS, TERMINAL_STATUSES } = require('../config/constants');

/**
 * Get available SLURM partitions
 * GET /api/slurm/partitions
 */
exports.getPartitions = async (req, res) => {
  try {
    const partitions = await execCommand('sinfo', ['--format=%P|%a|%l|%D|%T|%c|%m', '--noheader'])
      .then(({ stdout }) => {
        const lines = stdout.trim().split('\n').filter(l => l);
        const partitionMap = {};

        for (const line of lines) {
          const [name, avail, timelimit, nodes, state, cpus, memory] = line.split('|').map(s => s.trim());
          const partName = name.replace('*', ''); // Remove default marker

          if (!partitionMap[partName]) {
            partitionMap[partName] = {
              name: partName,
              is_default: name.includes('*'),
              available: avail === 'up',
              timelimit: timelimit,
              total_nodes: 0,
              nodes_by_state: {},
              cpus_per_node: parseInt(cpus) || 0,
              memory_per_node: memory
            };
          }

          const nodeCount = parseInt(nodes) || 0;
          partitionMap[partName].total_nodes += nodeCount;

          if (state) {
            partitionMap[partName].nodes_by_state[state] =
              (partitionMap[partName].nodes_by_state[state] || 0) + nodeCount;
          }
        }

        return Object.values(partitionMap);
      })
      .catch(() => {
        logger.debug('[SLURM] sinfo command failed, SLURM may not be available');
        return [];
      });

    res.json({
      success: true,
      status: 'success',
      partitions
    });
  } catch (error) {
    logger.error('[SLURM] getPartitions error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get available SLURM nodes
 * GET /api/slurm/nodes
 */
exports.getNodes = async (req, res) => {
  try {
    const { partition } = req.query;

    // %G = GRES (GPU info)
    const args = ['--Node', '--format=%N|%P|%T|%c|%m|%O|%e|%G', '--noheader'];

    // Validate and sanitize partition parameter
    const safePartition = sanitizePartition(partition);
    if (partition && !safePartition) {
      logger.warn(`[SLURM] Invalid partition parameter rejected: ${partition}`);
      return res.json({ success: true, status: 'success', nodes: [] });
    }
    if (safePartition) {
      args.push(`--partition=${safePartition}`);
    }

    const nodes = await execCommand('sinfo', args)
      .then(({ stdout }) => {
        const lines = stdout.trim().split('\n').filter(l => l);
        const nodeMap = {};

        for (const line of lines) {
          const [name, part, state, cpus, memory, load, freeMem, gres] = line.split('|').map(s => s.trim());
          const cpusTotal = parseInt(cpus) || 0;

          if (!nodeMap[name]) {
            // Convert memory from MB to human-readable
            const memMB = parseInt(memory) || 0;
            const memDisplay = memMB >= 1024 ? `${Math.round(memMB / 1024)}G` : `${memMB}M`;

            nodeMap[name] = {
              name,
              state: state.toUpperCase(),
              cpus_total: cpusTotal,
              cpus_alloc: 0,
              memory_total: memDisplay,
              gpus: '-',
              partitions: [],
              load: parseFloat(load) || 0,
              free_memory: freeMem
            };
          }

          // Collect partitions (a node can appear in multiple partitions)
          const partName = part.replace('*', '');
          if (partName && !nodeMap[name].partitions.includes(partName)) {
            nodeMap[name].partitions.push(partName);
          }

          // Parse GRES for GPU count
          if (gres && gres !== '(null)') {
            const gpuMatch = gres.match(/gpu(?::\w+)?:(\d+)/);
            if (gpuMatch) {
              nodeMap[name].gpus = parseInt(gpuMatch[1]);
            }
          }

          // Estimate CPU allocation from state
          const stateLower = state.toLowerCase();
          if (stateLower.includes('alloc') || stateLower === 'allocated') {
            nodeMap[name].cpus_alloc = cpusTotal;
          } else if (stateLower.includes('mix')) {
            nodeMap[name].cpus_alloc = Math.min(cpusTotal, Math.round(parseFloat(load) || 0));
          }
          // idle state: cpus_alloc stays 0
        }

        return Object.values(nodeMap);
      })
      .catch(() => {
        logger.debug('[SLURM] sinfo nodes command failed');
        return [];
      });

    res.json({
      success: true,
      status: 'success',
      nodes
    });
  } catch (error) {
    logger.error('[SLURM] getNodes error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get SLURM cluster status summary
 * GET /api/slurm/status
 */
exports.getStatus = async (req, res) => {
  try {
    // Check if SLURM is available
    const slurmAvailable = await execCommand('sinfo', ['--version'])
      .then(() => true)
      .catch(() => false);

    // Get node counts
    let nodeStats = { total_nodes: 0, idle_nodes: 0, busy_nodes: 0, down_nodes: 0 };
    if (slurmAvailable) {
      nodeStats = await execCommand('sinfo', ['--format=%T|%D', '--noheader'])
        .then(({ stdout }) => {
          let total = 0, idle = 0, busy = 0, down = 0;
          const lines = stdout.trim().split('\n').filter(l => l);

          for (const line of lines) {
            const [state, count] = line.split('|').map(s => s.trim());
            const nodeCount = parseInt(count) || 0;
            total += nodeCount;

            if (state === 'idle') {
              idle += nodeCount;
            } else if (state === 'alloc' || state === 'mix' || state === 'allocated') {
              busy += nodeCount;
            } else if (state === 'down' || state === 'drain' || state === 'draining') {
              down += nodeCount;
            }
          }

          return { total_nodes: total, idle_nodes: idle, busy_nodes: busy, down_nodes: down };
        })
        .catch(() => ({ total_nodes: 0, idle_nodes: 0, busy_nodes: 0, down_nodes: 0 }));
    }

    // Get job counts
    let jobStats = { running_jobs: 0, pending_jobs: 0 };
    if (slurmAvailable) {
      jobStats = await execCommand('squeue', ['--format=%t', '--noheader'])
        .then(({ stdout }) => {
          let running = 0, pending = 0;
          const lines = stdout.trim().split('\n').filter(l => l);

          for (const line of lines) {
            const state = line.trim();
            if (state === 'R') running++;
            else if (state === 'PD') pending++;
          }

          return { running_jobs: running, pending_jobs: pending };
        })
        .catch(() => ({ running_jobs: 0, pending_jobs: 0 }));
    }

    // Get partitions list
    let partitions = [];
    if (slurmAvailable) {
      partitions = await execCommand('sinfo', ['--format=%P', '--noheader'])
        .then(({ stdout }) => {
          return [...new Set(stdout.trim().split('\n').map(p => p.replace('*', '').trim()).filter(p => p))];
        })
        .catch(() => []);
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        available: slurmAvailable,
        ...nodeStats,
        ...jobStats,
        partitions
      }
    });
  } catch (error) {
    logger.error('[SLURM] getStatus error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get SLURM job queue
 * GET /api/slurm/queue
 */
exports.getQueue = async (req, res) => {
  try {
    const { all, user } = req.query;

    const args = ['--format=%i|%j|%u|%P|%t|%M|%l|%D|%R', '--noheader'];

    // Validate and sanitize user parameter
    const safeUser = sanitizeUsername(user);
    if (user && !safeUser) {
      logger.warn(`[SLURM] Invalid user parameter rejected: ${user}`);
      return res.json({ success: true, status: 'success', jobs: [] });
    }

    if (safeUser) {
      args.push(`--user=${safeUser}`);
    } else if (!all || all === 'false') {
      // Only show current user's jobs - use $USER which is safe
      args.push('--user=' + process.env.USER);
    }

    const jobs = await execCommand('squeue', args)
      .then(({ stdout }) => {
        const lines = stdout.trim().split('\n').filter(l => l);
        const jobList = [];

        for (const line of lines) {
          const [id, name, queueUser, partition, state, elapsed, timelimit, nodes, reason] =
            line.split('|').map(s => s.trim());

          jobList.push({
            slurm_job_id: id,
            name,
            user: queueUser,
            partition,
            state,
            state_readable: state === 'R' ? 'Running' : state === 'PD' ? 'Pending' : state,
            elapsed,
            timelimit,
            nodes: parseInt(nodes) || 1,
            reason: reason || ''
          });
        }

        return jobList;
      })
      .catch(() => []);

    res.json({
      success: true,
      status: 'success',
      jobs
    });
  } catch (error) {
    logger.error('[SLURM] getQueue error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get SLURM connection info
 * GET /api/slurm/connection
 */
exports.getConnectionInfo = async (req, res) => {
  try {
    const mode = isSSHMode() ? 'ssh' : 'local';
    const slurmAvailable = await execCommand('sinfo', ['--version'])
      .then(({ stdout }) => stdout.trim())
      .catch(() => null);

    const connectionInfo = {
      mode,
      available: !!slurmAvailable,
      version: slurmAvailable || null,
    };

    if (isSSHMode()) {
      const sshStatus = getSSHStatus();
      connectionInfo.ssh_host = sshStatus.host;
      connectionInfo.ssh_connected = sshStatus.connected;
      connectionInfo.ssh_user = sshStatus.user;
    }

    res.json({
      success: true,
      status: 'success',
      connection: connectionInfo
    });
  } catch (error) {
    logger.error('[SLURM] getConnectionInfo error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Cancel a SLURM job
 * POST /api/slurm/cancel
 */
exports.cancelJob = async (req, res) => {
  try {
    const { slurm_job_id, job_id } = req.body;

    if (!slurm_job_id) {
      return response.badRequest(res, 'slurm_job_id is required');
    }

    // Validate and sanitize SLURM job ID to prevent command injection
    const safeJobId = sanitizeSlurmJobId(slurm_job_id);
    if (!safeJobId) {
      logger.warn(`[SLURM] Invalid job ID rejected: ${slurm_job_id}`);
      return response.badRequest(res, 'Invalid SLURM job ID format');
    }

    // Cancel via SLURM
    const cancelled = await execCommand('scancel', [safeJobId])
      .then(() => true)
      .catch(() => false);

    // Update job in database if job_id provided
    if (job_id) {
      await Job.findOneAndUpdate(
        { id: job_id },
        {
          status: JOB_STATUS.CANCELLED,
          end_time: new Date(),
          updated_at: new Date()
        }
      );
    } else {
      // Try to find by slurm_job_id
      await Job.findOneAndUpdate(
        { slurm_job_id },
        {
          status: JOB_STATUS.CANCELLED,
          end_time: new Date(),
          updated_at: new Date()
        }
      );
    }

    res.json({
      success: cancelled,
      message: cancelled ? 'Job cancelled' : 'Failed to cancel job'
    });
  } catch (error) {
    logger.error('[SLURM] cancelJob error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Cancel job by CryoScale job ID
 * POST /api/slurm/jobs/:jobId/cancel
 */
exports.cancelJobById = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Check ownership
    if (job.user_id !== req.user.id && !req.user.is_superuser) {
      return response.forbidden(res, 'Not authorized to cancel this job');
    }

    let cancelled = true;
    if (job.slurm_job_id) {
      // Validate job ID from database (should be safe, but defense in depth)
      const safeJobId = sanitizeSlurmJobId(job.slurm_job_id);
      if (safeJobId) {
        cancelled = await execCommand('scancel', [safeJobId])
          .then(() => true)
          .catch(() => false);
      } else {
        logger.warn(`[SLURM] Invalid job ID in database: ${job.slurm_job_id}`);
        cancelled = false;
      }
    }

    await Job.findOneAndUpdate(
      { id: jobId },
      {
        status: JOB_STATUS.CANCELLED,
        end_time: new Date(),
        updated_at: new Date()
      }
    );

    res.json({
      success: cancelled,
      message: 'Job cancelled'
    });
  } catch (error) {
    logger.error('[SLURM] cancelJobById error:', error);
    return response.serverError(res, error.message);
  }
};

// Job type display names
const JOB_TYPE_NAMES = {
  'Import': 'Import',
  'MotionCorr': 'Motion Correction',
  'CtfFind': 'CTF Estimation',
  'AutoPick': 'Auto Picking',
  'Extract': 'Particle Extraction',
  'Class2D': '2D Classification',
  'Class3D': '3D Classification',
  'InitialModel': 'Initial Model',
  'AutoRefine': 'Auto Refine',
  'PostProcess': 'Post Processing',
  'Polish': 'Bayesian Polishing',
  'CtfRefine': 'CTF Refinement',
  'MaskCreate': 'Mask Creation',
  'LocalRes': 'Local Resolution',
  'Subtract': 'Particle Subtraction',
  'JoinStar': 'Join Star Files',
  'Subset': 'Subset Selection',
  'Multibody': 'Multi-body',
  'Dynamight': 'DynaMight',
  'ModelAngelo': 'ModelAngelo',
  'ManualPick': 'Manual Picking',
  'ManualSelect': 'Manual Select',
  'LinkMovies': 'Link Movies'
};

/**
 * Format jobs as log text
 */
function formatJobsAsLog(jobs) {
  const lines = [];
  const separator = '─'.repeat(50);

  for (const job of jobs) {
    const jobTypeName = JOB_TYPE_NAMES[job.job_type] || job.job_type;
    const createdAt = job.created_at ? new Date(job.created_at).toLocaleString() : '';

    lines.push('');
    lines.push(separator);
    lines.push(`${jobTypeName} Job`);
    lines.push(separator);
    lines.push(`Job: ${job.job_name} | ID: ${job.id}`);
    if (job.slurm_job_id) {
      lines.push(`SLURM ID: ${job.slurm_job_id}`);
    }
    lines.push(`Created: ${createdAt}`);

    // Format command if present
    if (job.command) {
      lines.push('Command:');
      if (job.command.length > 80) {
        const parts = job.command.split(' --');
        lines.push(`  ${parts[0]}`);
        parts.slice(1).forEach(part => {
          lines.push(`    --${part}`);
        });
      } else {
        lines.push(`  ${job.command}`);
      }
    }

    // Status
    const statusUpper = job.status ? job.status.toUpperCase() : 'UNKNOWN';
    lines.push(`Status: ${statusUpper}`);

    // Error message if failed
    if (job.error_message) {
      lines.push(`Error: ${job.error_message}`);
    }

    lines.push(separator);
  }

  return lines.join('\n');
}

/**
 * Resolve a job's output directory to an absolute path.
 * Handles both absolute and relative output_file_path values.
 */
async function resolveJobOutputDir(job) {
  const outputDir = job.output_file_path;
  if (!outputDir) return null;
  if (path.isAbsolute(outputDir)) return outputDir;

  // Relative path — resolve against project root
  const project = await Project.findOne({ id: job.project_id }).lean();
  if (!project) return null;
  const projectPath = getProjectPath(project);
  return path.join(projectPath, outputDir);
}

/**
 * Get job logs - reads actual run.out/run.err files from disk
 * GET /api/slurm/jobs/:jobId/logs?tail=500
 */
exports.getJobLogs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { tail = 500 } = req.query;
    const tailNum = Math.min(Math.max(parseInt(tail) || 500, 1), 10000);

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    const logs = { stdout: '', stderr: '' };
    const outputDir = await resolveJobOutputDir(job);

    if (outputDir) {
      const outPath = path.join(outputDir, 'run.out');
      const errPath = path.join(outputDir, 'run.err');

      // Read actual RELION stdout
      if (fs.existsSync(outPath)) {
        const content = fs.readFileSync(outPath, 'utf8');
        const lines = content.split('\n');
        logs.stdout = lines.slice(-tailNum).join('\n');
      }

      // Read actual RELION stderr
      if (fs.existsSync(errPath)) {
        const content = fs.readFileSync(errPath, 'utf8');
        const lines = content.split('\n');
        logs.stderr = lines.slice(-tailNum).join('\n');
      }
    }

    // If no log files found, fall back to formatted job summary
    if (!logs.stdout && !logs.stderr) {
      logs.stdout = formatJobsAsLog([job]);
    }

    // Include job metadata for the frontend header
    const jobMeta = {
      job_name: job.job_name,
      job_type: job.job_type,
      status: job.status,
      slurm_job_id: job.slurm_job_id || null,
      error_message: job.error_message || null,
      command: job.command || null,
      start_time: job.start_time || null,
      end_time: job.end_time || null,
      output_file_path: job.output_file_path || null
    };

    res.json({
      success: true,
      logs,
      job: jobMeta
    });
  } catch (error) {
    logger.error('[SLURM] getJobLogs error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Stream job logs - incremental updates for running jobs
 * GET /api/slurm/jobs/:jobId/logs/stream?offset=0
 */
exports.streamJobLogs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const offset = parseInt(req.query.offset) || 0;

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    const outputDir = await resolveJobOutputDir(job);
    let content = '';
    let newOffset = offset;

    if (outputDir) {
      const outPath = path.join(outputDir, 'run.out');
      const { readFromOffset } = require('../utils/relionLogParser');
      const result = readFromOffset(outPath, offset);
      content = result.content;
      newOffset = result.newOffset;
    }

    const isComplete = TERMINAL_STATUSES.includes(job.status);

    res.json({
      success: true,
      content,
      offset: newOffset,
      complete: isComplete
    });
  } catch (error) {
    logger.error('[SLURM] streamJobLogs error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get parsed issues/errors from job log files
 * GET /api/slurm/jobs/:jobId/issues?include_warnings=true
 */
exports.getJobIssues = async (req, res) => {
  try {
    const { jobId } = req.params;
    const includeWarnings = req.query.include_warnings !== 'false';

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    const outputDir = await resolveJobOutputDir(job);
    let issues = [];
    let summary = { total: 0, errors: 0, warnings: 0 };

    if (outputDir) {
      const { parseRelionErrors } = require('../utils/relionLogParser');
      const result = parseRelionErrors(outputDir, { includeWarnings });
      issues = result.issues;
      summary = result.summary;
    }

    // Optionally get SLURM details
    let slurm = null;
    if (job.slurm_job_id) {
      try {
        const monitor = getMonitor();
        slurm = await monitor.getJobDetails(job.slurm_job_id);
      } catch (err) {
        logger.debug(`[SLURM] Could not fetch SLURM details for ${job.slurm_job_id}: ${err.message}`);
      }
    }

    res.json({
      success: true,
      issues,
      summary,
      slurm
    });
  } catch (error) {
    logger.error('[SLURM] getJobIssues error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get SLURM job details
 * GET /api/slurm/jobs/:slurmJobId/details
 */
exports.getJobDetails = async (req, res) => {
  try {
    const { slurmJobId } = req.params;

    const monitor = getMonitor();
    const details = await monitor.getJobDetails(slurmJobId);

    if (!details) {
      return response.notFound(res, 'SLURM job not found');
    }

    res.json({
      success: true,
      status: 'success',
      job: details
    });
  } catch (error) {
    logger.error('[SLURM] getJobDetails error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Validate SLURM resource request
 * POST /api/slurm/validate
 */
exports.validateResources = async (req, res) => {
  try {
    const { partition, gpus, cpus, memory, nodes } = req.body;
    const errors = [];
    const warnings = [];

    // Basic validation
    if (partition) {
      // Validate partition name to prevent command injection
      const safePartition = sanitizePartition(partition);
      if (!safePartition) {
        errors.push(`Invalid partition name format: '${partition}'`);
      } else {
        // Check if partition exists
        const partitionExists = await execCommand('sinfo', ['--partition=' + safePartition, '--noheader'])
          .then(({ stdout }) => stdout.trim().length > 0)
          .catch(() => false);

        if (!partitionExists) {
          errors.push(`Partition '${safePartition}' not found`);
        }
      }
    }

    if (cpus && cpus > 256) {
      warnings.push('Requesting more than 256 CPUs may result in long queue times');
    }

    if (gpus && gpus > 8) {
      warnings.push('Requesting more than 8 GPUs may result in long queue times');
    }

    res.json({
      success: true,
      status: 'success',
      valid: errors.length === 0,
      errors,
      warnings
    });
  } catch (error) {
    logger.error('[SLURM] validateResources error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Delete a job
 * DELETE /api/slurm/jobs/:jobId
 */
exports.deleteJob = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Check ownership
    if (job.user_id !== req.user.id && !req.user.is_superuser) {
      return response.forbidden(res, 'Not authorized to delete this job');
    }

    // Cancel if still running
    if (job.slurm_job_id && job.status === JOB_STATUS.RUNNING) {
      const safeJobId = sanitizeSlurmJobId(job.slurm_job_id);
      if (safeJobId) {
        await execCommand('scancel', [safeJobId]).catch(() => {});
      }
    }

    await Job.deleteOne({ id: jobId });

    return response.success(res, { message: 'Job deleted' });
  } catch (error) {
    logger.error('[SLURM] deleteJob error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update job status
 * PATCH /api/slurm/jobs/:jobId/status
 */
exports.updateJobStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { status } = req.body;

    const validStatuses = [JOB_STATUS.PENDING, JOB_STATUS.RUNNING, JOB_STATUS.COMPLETED, JOB_STATUS.SUCCESS, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED, 'error'];
    if (!validStatuses.includes(status)) {
      return response.badRequest(res, `Invalid status. Must be one of: ${validStatuses.join(', ')}`);
    }

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Check ownership
    if (job.user_id !== req.user.id && !req.user.is_superuser) {
      return response.forbidden(res, 'Not authorized to update this job');
    }

    const updateData = {
      status,
      updated_at: new Date()
    };

    // Set end time for terminal states
    if (TERMINAL_STATUSES.includes(status) || status === 'error') {
      updateData.end_time = new Date();
    }

    await Job.findOneAndUpdate({ id: jobId }, updateData);

    return response.success(res, { message: 'Job status updated' });
  } catch (error) {
    logger.error('[SLURM] updateJobStatus error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Toggle email notification for a job
 * PATCH /api/slurm/jobs/:jobId/notify
 */
exports.toggleNotifyEmail = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId });
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Check ownership
    if (job.user_id !== req.user.id && !req.user.is_superuser) {
      return response.forbidden(res, 'Not authorized to modify this job');
    }

    job.notify_email = !job.notify_email;
    await job.save();

    return response.success(res, {
      notify_email: job.notify_email,
      message: job.notify_email ? 'Email notification enabled' : 'Email notification disabled'
    });
  } catch (error) {
    logger.error('[SLURM] toggleNotifyEmail error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get host machine resource limits for local job execution
 * GET /api/slurm/resource-limits
 */
exports.getResourceLimits = async (req, res) => {
  try {
    const { getSystemResources } = require('../utils/systemResources');
    const sys = getSystemResources();

    return response.successData(res, {
      total_cpus: sys.totalCpus,
      available_cpus: sys.availableCpus,
      reserved_cpus: sys.reservedCpus,
      gpu_count: sys.gpuCount,
      max_mpi: sys.availableCpus,
      max_threads: sys.availableCpus,
      max_gpus: sys.gpuCount,
    });
  } catch (error) {
    logger.error('[SLURM] getResourceLimits error:', error);
    return response.serverError(res, error.message);
  }
};
