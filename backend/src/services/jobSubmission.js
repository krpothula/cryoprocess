/**
 * Job Submission Service
 *
 * Handles job submission to local or SLURM execution.
 */

const { spawn } = require('child_process');
const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const Job = require('../models/Job');
const { isPathSafe } = require('../utils/security');
const { JOB_STATUS } = require('../config/constants');
const { execCommand, writeRemoteFile, isSSHMode, createUserSSHSession } = require('../utils/remoteExec');

// Allowed SLURM submit commands (whitelist)
const ALLOWED_SUBMIT_COMMANDS = ['sbatch', '/usr/bin/sbatch'];

/**
 * Sanitize SLURM parameter to prevent injection
 * @param {string} value - Parameter value
 * @param {string} paramName - Parameter name (for logging)
 * @param {string} allowedPattern - Regex pattern for allowed characters
 * @param {number} maxLength - Maximum allowed length
 * @returns {string|null} Sanitized value or null
 */
const sanitizeSlurmParam = (value, paramName, allowedPattern = /^[\w\-.,:/]+$/, maxLength = 256) => {
  if (value === null || value === undefined) {
    return null;
  }

  value = String(value).trim();

  if (value.length > maxLength) {
    logger.warn(`[SLURM] Parameter ${paramName} exceeds max length, truncating`);
    value = value.substring(0, maxLength);
  }

  // Reject values with dangerous characters instead of silently stripping them
  const dangerous = /[;|&`$()<>{}!\\\n\r]/;
  if (dangerous.test(value)) {
    logger.warn(`[SLURM] Rejected ${paramName}: contains dangerous characters`);
    return null;
  }

  if (!allowedPattern.test(value)) {
    logger.warn(`[SLURM] Rejected ${paramName}: contains invalid characters: ${value.substring(0, 50)}`);
    return null;
  }

  return value || null;
};

/**
 * Generate SLURM script content
 * @param {Object} options - Script options
 * @returns {string} SLURM script content
 */
const generateSlurmScript = (options) => {
  const {
    jobName,
    outputDir,
    projectPath,
    command,
    partition,
    mpiProcs = 1,
    threads = 1,
    gpus = 0,
    additionalArgs = ''
  } = options;

  let script = `#!/bin/bash
#SBATCH --job-name=${jobName}
#SBATCH --output=${path.join(outputDir, 'run.out')}
#SBATCH --error=${path.join(outputDir, 'run.err')}
`;

  if (partition) {
    script += `#SBATCH --partition=${partition}\n`;
  }

  if (mpiProcs > 1) {
    script += `#SBATCH --ntasks=${mpiProcs}\n`;
  }

  if (threads > 1) {
    script += `#SBATCH --cpus-per-task=${threads}\n`;
  }

  if (gpus > 0) {
    script += `#SBATCH --gres=gpu:${gpus}\n`;
  }

  if (additionalArgs) {
    script += `${additionalArgs}\n`;
  }

  script += `
# Suppress PMIx munge warnings (harmless when munge daemon is not installed)
export PMIX_MCA_psec=native

# Override TORCH_HOME to writable location (container default is read-only)
# SINGULARITYENV_ prefix ensures it overrides the container's %environment
export SINGULARITYENV_TORCH_HOME=\${HOME}/.cache/torch
export TORCH_HOME=\${HOME}/.cache/torch

# Change to project directory
cd ${projectPath}

# Run the command
`;

  // Format command - quote arguments containing glob patterns or spaces
  const formatArg = (arg) => {
    // Quote if contains glob patterns (* or ?) or spaces
    if (/[*? ]/.test(arg)) {
      return `"${arg}"`;
    }
    return arg;
  };
  const cmdStr = Array.isArray(command)
    ? command.map(formatArg).join(' ')
    : command;

  // Check if we should use Singularity
  // In SSH mode, the .sif file is on the remote machine — skip local fs.existsSync check
  const singularityAvailable = settings.SINGULARITY_IMAGE &&
    (isSSHMode() || fs.existsSync(settings.SINGULARITY_IMAGE));
  if (singularityAvailable) {
    let singularityCmd = 'singularity exec';

    // Add bind paths if configured
    if (settings.SINGULARITY_BIND_PATHS) {
      singularityCmd += ` --bind "${settings.SINGULARITY_BIND_PATHS}"`;
    }

    // Add GPU support (--nv) only when GPUs are allocated
    // This prevents SLURM errors when no GPUs are requested but --nv is used
    if (gpus > 0 && settings.SINGULARITY_OPTIONS) {
      singularityCmd += ` ${settings.SINGULARITY_OPTIONS}`;
    }

    singularityCmd += ` "${settings.SINGULARITY_IMAGE}" ${cmdStr}`;

    // For MPI jobs with Singularity, we need mpirun to spawn multiple processes
    // SLURM's --ntasks only allocates slots, but doesn't launch MPI processes with singularity exec
    if (mpiProcs > 1) {
      script += `mpirun -n ${mpiProcs} ${singularityCmd}\n`;
    } else {
      script += `${singularityCmd}\n`;
    }
  } else if (mpiProcs > 1) {
    // Native MPI (without Singularity) - use mpirun
    script += `mpirun -n ${mpiProcs} ${cmdStr}\n`;
  } else {
    script += `${cmdStr}\n`;
  }

  // Create RELION exit status markers if not already present
  // Some RELION utilities (e.g. relion_star_handler) don't create these markers,
  // which prevents the SLURM monitor from detecting job completion
  script += `
# Create RELION exit status markers (safety net for commands that don't create them)
CMD_EXIT_CODE=$?
if [ $CMD_EXIT_CODE -eq 0 ]; then
  [ -f ${outputDir}/RELION_JOB_EXIT_SUCCESS ] || touch ${outputDir}/RELION_JOB_EXIT_SUCCESS
else
  [ -f ${outputDir}/RELION_JOB_EXIT_FAILURE ] || touch ${outputDir}/RELION_JOB_EXIT_FAILURE
fi
exit $CMD_EXIT_CODE
`;

  return script;
};

/**
 * Submit job directly (no Celery)
 * @param {Object} options - Submission options
 * @returns {Promise<{success: boolean, slurm_job_id: string|null, message: string, error: string|null}>}
 */
const submitJobDirect = async (options) => {
  const {
    cmd,
    jobId,
    jobName,
    stageName,
    projectId,
    projectPath,
    outputDir,
    executionMethod = 'slurm',
    slurmParams = {},
    postCommand = null
  } = options;

  logger.info(`[JobSubmit] Starting | job_id: ${jobId} | method: ${executionMethod}`);

  // Update job status to running
  await Job.findOneAndUpdate(
    { id: jobId },
    {
      status: JOB_STATUS.RUNNING,
      start_time: new Date(),
      updated_at: new Date()
    }
  );

  if (executionMethod === 'slurm') {
    return submitToSlurm(options);
  } else {
    return submitLocal(options);
  }
};

/**
 * Submit job to SLURM
 * When options.userCredentials is provided ({ username, privateKey }),
 * a temporary per-user SSH session is used instead of the global connection.
 */
const submitToSlurm = async (options) => {
  const {
    cmd,
    jobId,
    jobName,
    projectPath,
    outputDir,
    slurmParams = {},
    userCredentials = null
  } = options;

  let userSession = null;

  try {
    // If per-user credentials are provided, create a temporary SSH session
    if (userCredentials) {
      logger.info(`[JobSubmit] Using per-user SSH session for ${userCredentials.username}`);
      userSession = await createUserSSHSession(userCredentials);
    }

    // Use per-user session methods when available, otherwise fall back to global
    const doWriteFile = userSession ? userSession.writeRemoteFile : writeRemoteFile;
    const doExecCommand = userSession ? userSession.execCommand : execCommand;

    // Generate SLURM script
    const scriptContent = generateSlurmScript({
      jobName,
      outputDir,
      projectPath,
      command: cmd,
      partition: sanitizeSlurmParam(slurmParams.queuename, 'partition'),
      mpiProcs: Math.min(Math.max(parseInt(slurmParams.mpiProcs) || 1, 1), 128),
      threads: Math.min(Math.max(parseInt(slurmParams.threads) || 1, 1), 256),
      gpus: Math.min(Math.max(parseInt(slurmParams.gres) || 0, 0), 16),
      additionalArgs: sanitizeSlurmParam(slurmParams.arguments, 'arguments', /^[\w\-.,:/\s=]+$/, 512)
    });

    // Write script to file (locally, via global SFTP, or via per-user SFTP)
    const scriptPath = path.join(outputDir, 'run.sh');
    await doWriteFile(scriptPath, scriptContent, { mode: 0o755 });
    logger.info(`[JobSubmit] SLURM script written: ${scriptPath}`);

    // Submit to SLURM - validate submit command against whitelist
    let submitCmd = slurmParams.queueSubmitCommand || 'sbatch';
    if (!ALLOWED_SUBMIT_COMMANDS.includes(submitCmd)) {
      logger.warn(`[JobSubmit] Invalid submit command rejected: ${submitCmd}`);
      submitCmd = 'sbatch'; // Fall back to safe default
    }

    // Validate script path doesn't contain shell metacharacters
    if (!isPathSafe(scriptPath)) {
      logger.error(`[JobSubmit] Invalid script path rejected: ${scriptPath}`);
      return {
        success: false,
        slurm_job_id: null,
        message: 'Invalid script path',
        error: 'Script path contains invalid characters'
      };
    }

    try {
      const { stdout, stderr } = await doExecCommand(submitCmd, [scriptPath], { cwd: projectPath });

      // Parse SLURM job ID from output (e.g., "Submitted batch job 12345")
      const match = stdout.match(/Submitted batch job (\d+)/);
      const slurmJobId = match ? match[1] : null;

      if (!slurmJobId) {
        // sbatch ran without error but we couldn't parse the job ID.
        // Mark as failed so it doesn't become a ghost job stuck RUNNING forever.
        logger.error(`[JobSubmit] Failed to parse SLURM job ID from sbatch output: "${stdout.trim()}"`);
        if (stderr) logger.error(`[JobSubmit] sbatch stderr: ${stderr.trim()}`);
        await Job.findOneAndUpdate(
          { id: jobId },
          {
            status: JOB_STATUS.FAILED,
            error_message: `SLURM job ID could not be parsed from sbatch output: ${stdout.trim()}`,
            end_time: new Date()
          }
        );
        return {
          success: false,
          slurm_job_id: null,
          message: 'Failed to parse SLURM job ID',
          error: `Unexpected sbatch output: ${stdout.trim()}`
        };
      }

      logger.info(`[JobSubmit] SLURM job submitted | slurm_id: ${slurmJobId}`);

      // Update job with SLURM ID
      await Job.findOneAndUpdate(
        { id: jobId },
        { slurm_job_id: slurmJobId }
      );

      return {
        success: true,
        slurm_job_id: slurmJobId,
        message: `Job submitted to SLURM (ID: ${slurmJobId})`,
        error: null
      };
    } catch (submitError) {
      const errorDetail = submitError.stderr
        ? `${submitError.message} | stderr: ${submitError.stderr.trim()}`
        : submitError.message;
      logger.error(`[JobSubmit] SLURM submission failed: ${errorDetail}`);
      await Job.findOneAndUpdate(
        { id: jobId },
        {
          status: JOB_STATUS.FAILED,
          error_message: errorDetail,
          end_time: new Date()
        }
      );
      return {
        success: false,
        slurm_job_id: null,
        message: 'SLURM submission failed',
        error: errorDetail
      };
    }
  } catch (error) {
    logger.error(`[JobSubmit] Error: ${error.message}`);
    await Job.findOneAndUpdate(
      { id: jobId },
      {
        status: JOB_STATUS.FAILED,
        error_message: error.message,
        end_time: new Date()
      }
    );
    return {
      success: false,
      slurm_job_id: null,
      message: 'Job submission failed',
      error: error.message
    };
  } finally {
    // Always close the per-user SSH session when done
    if (userSession) {
      userSession.close();
    }
  }
};

/**
 * Submit job for local execution
 */
const submitLocal = async (options) => {
  const {
    cmd,
    jobId,
    jobName,
    projectId,
    projectPath,
    outputDir,
    postCommand
  } = options;

  try {
    // Format command
    const cmdArray = Array.isArray(cmd) ? cmd : cmd.split(' ');

    // Wrap with Singularity if container is configured
    let finalCmd;
    if (settings.SINGULARITY_IMAGE && fs.existsSync(settings.SINGULARITY_IMAGE)) {
      // Build singularity exec prefix
      const singularityPrefix = ['singularity', 'exec'];

      if (settings.SINGULARITY_BIND_PATHS) {
        singularityPrefix.push('--bind', settings.SINGULARITY_BIND_PATHS);
      }

      // Only add GPU support (--nv) when the command actually uses GPU,
      // matching the SLURM script behavior which checks gpus > 0
      const gpuInCmd = cmdArray.some(a => a === '--gpu');
      if (gpuInCmd && settings.SINGULARITY_OPTIONS) {
        singularityPrefix.push(...settings.SINGULARITY_OPTIONS.split(/\s+/).filter(Boolean));
      }

      singularityPrefix.push(settings.SINGULARITY_IMAGE);

      // For MPI jobs, mpirun must be OUTSIDE the container so it can
      // spawn multiple container instances (matching SLURM script behavior).
      // Builder produces: ['mpirun', '-np', 'N', 'relion_cmd_mpi', ...flags]
      if (cmdArray[0] === 'mpirun') {
        const relionIdx = cmdArray.findIndex(c => typeof c === 'string' && c.startsWith('relion_'));
        const mpiPrefix = cmdArray.slice(0, relionIdx);   // ['mpirun', '-np', 'N']
        const relionCmd = cmdArray.slice(relionIdx);       // ['relion_cmd_mpi', ...flags]
        finalCmd = [...mpiPrefix, ...singularityPrefix, ...relionCmd];
      } else {
        finalCmd = [...singularityPrefix, ...cmdArray];
      }

      logger.info(`[JobSubmit] Using Singularity container: ${settings.SINGULARITY_IMAGE}`);
    } else {
      finalCmd = cmdArray;
    }

    // Handle command chaining (&&) for local execution.
    // spawn() without shell doesn't interpret &&, so use sh -c for chained commands.
    // The && tokens come from builder code (not user input), so shell mode is safe.
    if (finalCmd.some(a => a === '&&')) {
      const cmdStr = finalCmd.join(' ');
      finalCmd = ['sh', '-c', cmdStr];
    }

    const executable = finalCmd[0];
    const args = finalCmd.slice(1);

    logger.info(`[JobSubmit] Starting local execution | cmd: ${executable} ${args.join(' ')}`);

    // Open output files
    const stdout = fs.openSync(path.join(outputDir, 'run.out'), 'a');
    const stderr = fs.openSync(path.join(outputDir, 'run.err'), 'a');

    // Spawn process with TORCH_HOME override for writable model weight storage
    const child = spawn(executable, args, {
      cwd: projectPath,
      detached: true,
      stdio: ['ignore', stdout, stderr],
      env: {
        ...process.env,
        TORCH_HOME: path.join(process.env.HOME || '/tmp', '.cache', 'torch'),
        SINGULARITYENV_TORCH_HOME: path.join(process.env.HOME || '/tmp', '.cache', 'torch')
      }
    });

    child.unref();

    // Store PID so direct jobs can be cancelled and orphans detected on restart
    await Job.findOneAndUpdate(
      { id: jobId },
      { local_pid: child.pid }
    );
    logger.info(`[JobSubmit] Local process spawned | job_id: ${jobId} | pid: ${child.pid}`);

    // Handle process completion
    child.on('close', async (code) => {
      fs.closeSync(stdout);
      fs.closeSync(stderr);

      logger.info(`[JobSubmit] Local job completed | job_id: ${jobId} | exit_code: ${code}`);

      // Guard: don't overwrite terminal states (e.g. user cancelled while process was dying)
      const currentJob = await Job.findOne({ id: jobId }).select('status').lean();
      if (currentJob && [JOB_STATUS.SUCCESS, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(currentJob.status)) {
        // Already terminal — just clear the PID
        await Job.findOneAndUpdate({ id: jobId }, { local_pid: null });
        logger.info(`[JobSubmit] Job ${jobId} already ${currentJob.status}, skipping status update`);
        return;
      }

      const status = code === 0 ? JOB_STATUS.SUCCESS : JOB_STATUS.FAILED;

      await Job.findOneAndUpdate(
        { id: jobId },
        {
          status,
          end_time: new Date(),
          local_pid: null,
          error_message: code !== 0 ? `Process exited with code ${code}` : null
        }
      );

      // Store pipeline metadata and catalog output files on success
      if (code === 0) {
        try {
          const { storeJobMetadata } = require('../utils/pipelineMetadata');
          await storeJobMetadata(jobId);
        } catch (metaError) {
          logger.error(`[JobSubmit] Failed to store pipeline metadata for ${jobId}: ${metaError.message}`);
        }
      }

      // Broadcast status change via WebSocket (local jobs aren't monitored
      // by the SLURM monitor, so we need to push the notification here)
      try {
        const { getWebSocketServer } = require('./websocket');
        getWebSocketServer().broadcastJobUpdate({
          projectId,
          jobId,
          oldStatus: JOB_STATUS.RUNNING,
          newStatus: status,
          slurmStatus: null
        });
      } catch (wsErr) {
        logger.debug(`[JobSubmit] WebSocket broadcast failed for ${jobId}: ${wsErr.message}`);
      }

      // Run post-command if provided and job succeeded
      // Note: postCommand comes from builder.postCommand which is internal code
      if (code === 0 && postCommand) {
        logger.info(`[JobSubmit] Running post-command: ${postCommand}`);
        // Parse command into executable and args for safer execution
        const postCmdArray = Array.isArray(postCommand) ? postCommand : postCommand.split(/\s+/);
        const postExe = postCmdArray[0];
        const postArgs = postCmdArray.slice(1);

        // Use spawn instead of exec for better security
        const postProcess = spawn(postExe, postArgs, {
          cwd: projectPath,
          stdio: 'ignore',
          detached: true
        });
        postProcess.unref();

        postProcess.on('error', async (err) => {
          logger.error(`[JobSubmit] Post-command failed for job ${jobId}: ${err.message}`);
          // Record post-command failure on the job (don't override success status, just log it)
          try {
            await Job.findOneAndUpdate(
              { id: jobId },
              { error_message: `Job succeeded but post-command failed: ${err.message}` }
            );
          } catch (dbErr) {
            logger.error(`[JobSubmit] Failed to record post-command error: ${dbErr.message}`);
          }
        });

        postProcess.on('close', async (postCode) => {
          if (postCode !== 0 && postCode !== null) {
            logger.warn(`[JobSubmit] Post-command exited with code ${postCode} for job ${jobId}`);
            try {
              await Job.findOneAndUpdate(
                { id: jobId },
                { error_message: `Job succeeded but post-command exited with code ${postCode}` }
              );
            } catch (dbErr) {
              logger.error(`[JobSubmit] Failed to record post-command error: ${dbErr.message}`);
            }
          }
        });
      }
    });

    child.on('error', async (error) => {
      logger.error(`[JobSubmit] Local job error: ${error.message}`);
      await Job.findOneAndUpdate(
        { id: jobId },
        {
          status: JOB_STATUS.FAILED,
          error_message: error.message,
          end_time: new Date(),
          local_pid: null
        }
      );

      // Broadcast failure via WebSocket
      try {
        const { getWebSocketServer } = require('./websocket');
        getWebSocketServer().broadcastJobUpdate({
          projectId,
          jobId,
          oldStatus: JOB_STATUS.RUNNING,
          newStatus: JOB_STATUS.FAILED,
          slurmStatus: null
        });
      } catch (wsErr) {
        logger.debug(`[JobSubmit] WebSocket broadcast failed for ${jobId}: ${wsErr.message}`);
      }
    });

    return {
      success: true,
      slurm_job_id: null,
      message: 'Job started locally',
      error: null
    };
  } catch (error) {
    logger.error(`[JobSubmit] Error: ${error.message}`);
    await Job.findOneAndUpdate(
      { id: jobId },
      {
        status: JOB_STATUS.FAILED,
        error_message: error.message,
        end_time: new Date()
      }
    );
    return {
      success: false,
      slurm_job_id: null,
      message: 'Job execution failed',
      error: error.message
    };
  }
};

module.exports = {
  submitJobDirect,
  submitToSlurm,
  submitLocal,
  sanitizeSlurmParam,
  generateSlurmScript
};
