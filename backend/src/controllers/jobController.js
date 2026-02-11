/**
 * Job Controller
 *
 * Handles job submission and management.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const Job = require('../models/Job');
const Project = require('../models/Project');
const { submitJobDirect } = require('../services/jobSubmission');
const { getProjectPath } = require('../utils/pathUtils');
const response = require('../utils/responseHelper');
const { JOB_STATUS } = require('../config/constants');
const { getJobProgress, getTotalExpected } = require('../utils/progressHelper');
const { isGpuEnabled } = require('../utils/paramHelper');
const ProjectMember = require('../models/ProjectMember');
const { checkProjectAccess } = require('./projectMemberController');

// Import unified job registry (single source of truth)
const {
  JOB_BUILDERS,
  JOB_VALIDATORS,
  STAGE_NAMES,
  getJobDefinition
} = require('../config/jobRegistry');

/**
 * Submit a job
 * POST /api/jobs/:jobType
 */
exports.submitJob = async (req, res) => {
  const { jobType } = req.params;
  const startTime = Date.now();

  try {
    // Get validator for job type
    const validator = JOB_VALIDATORS[jobType];
    if (!validator) {
      logger.warn(`[JOB:${jobType.toUpperCase()}] Unknown job type requested`);
      return response.badRequest(res, `Unknown job type: ${jobType}`);
    }

    // Validate parameters
    const { value: data, error: validationError } = validator(req.body);
    if (validationError) {
      logger.warn(`[JOB:${jobType.toUpperCase()}] Validation failed:`, validationError);
      return response.validationError(res, validationError.details || validationError);
    }

    // Get project and verify access (need editor role to submit jobs)
    const project = await Project.findOne({ id: data.project_id }).lean();
    if (!project) {
      logger.job.error(jobType, new Error(`Project not found: ${data.project_id}`));
      return response.notFound(res, 'Project not found');
    }

    const access = await checkProjectAccess(data.project_id, req.user.id, 'editor');
    if (!access.hasAccess) {
      return response.forbidden(res, 'You do not have permission to submit jobs in this project');
    }

    const projectPath = getProjectPath(project);

    // Start job logging (both combined and project logs)
    logger.job.start(jobType, data.project_id, req.user.id);
    logger.project.start(projectPath, project.id, jobType, req.user.id);

    logger.job.step(jobType, 1, 'Parameters validated', { project_id: data.project_id });
    logger.project.step(projectPath, project.id, jobType, 1, 'Parameters validated', { project_id: data.project_id });

    logger.job.step(jobType, 2, 'Project found', { project_name: project.project_name });
    logger.project.step(projectPath, project.id, jobType, 2, 'Project found', { project_name: project.project_name });

    // Get builder
    const BuilderClass = JOB_BUILDERS[jobType];
    if (!BuilderClass) {
      logger.job.error(jobType, new Error('No builder registered for this job type'));
      return response.badRequest(res, `No builder for job type: ${jobType}`);
    }

    // Create builder and validate
    const builder = new BuilderClass(data, project, req.user);
    const { valid, error: builderError } = builder.validate();
    if (!valid) {
      logger.job.error(jobType, new Error(builderError));
      logger.project.error(projectPath, project.id, jobType, new Error(builderError));
      return response.badRequest(res, builderError);
    }

    logger.job.step(jobType, 3, 'Builder validated');
    logger.project.step(projectPath, project.id, jobType, 3, 'Builder validated');

    // Get next job name
    const jobName = await Job.getNextJobName(project.id);
    const outputDir = builder.getOutputDir(jobName);

    logger.job.step(jobType, 4, 'Building command', { job_name: jobName });
    logger.project.step(projectPath, project.id, jobType, 4, 'Building command', { job_name: jobName });
    const cmd = builder.buildCommand(outputDir, jobName);
    logger.job.command(jobType, cmd);
    logger.project.command(projectPath, project.id, jobType, cmd);

    // Get input job names (extracted from input file paths)
    const inputJobNames = builder.getInputJobIds();

    // Resolve job names to database IDs for tree connections
    let resolvedInputJobIds = [];
    if (inputJobNames.length > 0) {
      // Look up jobs by name within this project
      const inputJobs = await Job.find({
        project_id: project.id,
        job_name: { $in: inputJobNames }
      }).select('id job_name').lean();

      // Map job names to database IDs
      const nameToId = {};
      for (const j of inputJobs) {
        nameToId[j.job_name] = j.id;
      }

      // Preserve order from inputJobNames
      resolvedInputJobIds = inputJobNames
        .map(name => nameToId[name])
        .filter(Boolean);

      logger.job.step(jobType, 5, 'Input jobs resolved', {
        names: inputJobNames.join(','),
        ids: resolvedInputJobIds.join(',')
      });
      logger.project.step(projectPath, project.id, jobType, 5, 'Input jobs resolved', {
        names: inputJobNames.join(','),
        ids: resolvedInputJobIds.join(',')
      });
    }

    // Create job in database
    const jobId = Job.generateId();
    const stageName = STAGE_NAMES[jobType] || jobType;
    const commandStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;

    // Inherit pipeline_stats from upstream job chain
    const inheritedStats = {
      pixel_size: null,
      micrograph_count: 0,
      particle_count: 0,
      box_size: null,
      resolution: null,
      class_count: 0,
      iteration_count: 0
    };

    if (resolvedInputJobIds.length > 0) {
      // First try immediate upstream job
      const upstreamJob = await Job.findOne({ id: resolvedInputJobIds[0] }).lean();
      if (upstreamJob) {
        const us = upstreamJob.pipeline_stats || {};
        inheritedStats.micrograph_count = us.micrograph_count || upstreamJob.micrograph_count || 0;
        inheritedStats.particle_count = us.particle_count || upstreamJob.particle_count || 0;
        inheritedStats.pixel_size = us.pixel_size || upstreamJob.pixel_size ||
          upstreamJob.pipeline_metadata?.original_pixel_size || null;
        inheritedStats.box_size = us.box_size || upstreamJob.box_size ||
          upstreamJob.parameters?.particleBoxSize || null;
        inheritedStats.resolution = us.resolution || null;
        inheritedStats.class_count = us.class_count || 0;
        inheritedStats.iteration_count = us.iteration_count || 0;

        // If values are missing, look further upstream
        if (!inheritedStats.box_size || !inheritedStats.pixel_size || !inheritedStats.micrograph_count) {
          const toCheck = [...(upstreamJob.input_job_ids || [])];
          const checked = new Set([resolvedInputJobIds[0]]);

          while (toCheck.length > 0 && (!inheritedStats.box_size || !inheritedStats.pixel_size || !inheritedStats.micrograph_count)) {
            const jobId = toCheck.shift();
            if (checked.has(jobId)) continue;
            checked.add(jobId);

            const ancestorJob = await Job.findOne({ id: jobId }).lean();
            if (!ancestorJob) continue;
            const as = ancestorJob.pipeline_stats || {};

            if (!inheritedStats.box_size) {
              inheritedStats.box_size = as.box_size || ancestorJob.box_size ||
                ancestorJob.parameters?.particleBoxSize || null;
            }
            if (!inheritedStats.pixel_size) {
              inheritedStats.pixel_size = as.pixel_size || ancestorJob.pixel_size ||
                ancestorJob.pipeline_metadata?.original_pixel_size || null;
            }
            if (!inheritedStats.micrograph_count) {
              inheritedStats.micrograph_count = as.micrograph_count || ancestorJob.micrograph_count || 0;
            }
            if (!inheritedStats.particle_count) {
              inheritedStats.particle_count = as.particle_count || ancestorJob.particle_count || 0;
            }

            if (ancestorJob.input_job_ids) {
              toCheck.push(...ancestorJob.input_job_ids);
            }
          }
        }

        logger.info(`[${jobType}] Inherited from chain (starting ${upstreamJob.job_name}): mic=${inheritedStats.micrograph_count}, part=${inheritedStats.particle_count}, pix=${inheritedStats.pixel_size}, box=${inheritedStats.box_size}`);
      }
    }

    // For Import jobs, get pixel_size from angpix parameter
    if (stageName === 'Import' && data.angpix) {
      const parsed = parseFloat(data.angpix);
      if (!isNaN(parsed) && parsed > 0) {
        inheritedStats.pixel_size = parsed;
      }
    }

    // For Extract jobs, set box_size from particleBoxSize parameter
    if (stageName === 'Extract' && data.particleBoxSize) {
      const parsed = parseInt(data.particleBoxSize, 10);
      if (!isNaN(parsed) && parsed > 0) {
        inheritedStats.box_size = parsed;
      }
    }

    const newJob = await Job.create({
      id: jobId,
      project_id: project.id,
      user_id: req.user.id,
      job_name: jobName,
      job_type: stageName,
      status: JOB_STATUS.PENDING,
      input_job_ids: resolvedInputJobIds,  // Database IDs for tree connections
      output_file_path: outputDir,
      command: commandStr,
      execution_mode: data.execution_mode || 'slurm',
      parameters: req.body,
      pipeline_stats: inheritedStats
    });

    logger.job.step(jobType, 6, 'Job saved to database', { job_id: jobId, output_dir: outputDir });
    logger.project.step(projectPath, project.id, jobType, 6, 'Job saved to database', { job_id: jobId, output_dir: outputDir });

    // Determine execution mode
    let executionMode = data.execution_mode || 'slurm';
    const submitToQueue = data.submitToQueue || data.SubmitToQueue;
    if (submitToQueue === 'No' || submitToQueue === false) {
      executionMode = 'local';
    }

    // Clamp resources for local execution to prevent overloading host machine
    if (executionMode === 'local') {
      const { getSystemResources } = require('../utils/systemResources');
      const sys = getSystemResources();
      const maxCpus = sys.availableCpus;

      let mpi = parseInt(data.runningmpi || data.numberOfMpiProcs || data.mpiProcs || 1, 10);
      let threads = parseInt(data.threads || data.numberOfThreads || 1, 10);

      if (mpi * threads > maxCpus) {
        const origMpi = mpi, origThreads = threads;
        threads = Math.max(1, Math.floor(maxCpus / mpi));
        if (mpi * threads > maxCpus) {
          mpi = Math.max(1, Math.floor(maxCpus / threads));
        }
        logger.info(`[${jobType}] Resource clamped: mpi ${origMpi}->${mpi}, threads ${origThreads}->${threads} (max ${maxCpus} CPUs)`);
      }

      data.runningmpi = mpi;
      data.numberOfMpiProcs = mpi;
      data.mpiProcs = mpi;
      data.threads = threads;
      data.numberOfThreads = threads;
      data.gres = Math.min(parseInt(data.gres || 0, 10), sys.gpuCount);
    }

    // Extract SLURM parameters
    let slurmParams = null;
    if (executionMode === 'slurm') {
      // GPU detection: Check multiple parameter formats
      // - gpuAcceleration: "Yes"/"No" (frontend checkbox)
      // - useGPU: "0" (GPU device ID, means GPU is requested)
      // - gres/gpus: explicit GPU count
      const gpuRequested = isGpuEnabled(data);
      const explicitGres = parseInt(data.gres || data.gpus || 0, 10);
      const requestedGres = gpuRequested ? Math.max(1, explicitGres) : explicitGres;
      const effectiveGres = builder.supportsGpu ? requestedGres : 0;

      // Log GPU allocation decision for debugging
      if (gpuRequested) {
        logger.info(`[${jobType}] GPU requested: gpuAcceleration=${data.gpuAcceleration}, useGPU=${data.useGPU}, allocating ${effectiveGres} GPU(s)`);
      }

      if (!builder.supportsGpu && requestedGres > 0) {
        logger.warn(`[${jobType}] Job type does not support GPU, ignoring gres=${requestedGres}`);
      }

      // For non-MPI jobs, force mpiProcs=1 to prevent srun usage
      const requestedMpi = data.runningmpi || data.numberOfMpiProcs || data.mpiProcs || 1;
      const effectiveMpi = builder.supportsMpi ? requestedMpi : 1;

      if (!builder.supportsMpi && requestedMpi > 1) {
        logger.info(`[${jobType}] Job type does not support MPI, ignoring mpiProcs=${requestedMpi}`);
      }

      slurmParams = {
        queuename: data.queuename || data.queueName || data.QueueName,
        queueSubmitCommand: data.queueSubmitCommand || data.QueueSubmitCommand || 'sbatch',
        runningmpi: effectiveMpi,
        threads: data.threads || data.numberOfThreads,
        gres: effectiveGres,
        coresPerNode: data.coresPerNode || data.minimumDedicatedcoresPerNode,
        clustername: data.clustername,
        arguments: data.arguments || data.slurmArguments || data.AdditionalArguments
      };
    }

    logger.job.step(jobType, 7, 'Preparing submission', { execution_mode: executionMode });
    logger.project.step(projectPath, project.id, jobType, 7, 'Preparing submission', { execution_mode: executionMode });

    // Special handling for link_movies - execute directly (no SLURM)
    if (jobType === 'link_movies' || jobType === 'linkmovies') {
      logger.job.step(jobType, 8, 'Executing symlink creation directly');
      const result = builder.execute();

      // Update job status based on result
      const jobStatus = result.status === 'success' ? JOB_STATUS.SUCCESS : JOB_STATUS.FAILED;
      await Job.findOneAndUpdate(
        { id: jobId },
        {
          status: jobStatus,
          start_time: new Date(),
          end_time: new Date(),
          error_message: result.status === 'error' ? result.message : null
        }
      );

      const duration = Date.now() - startTime;
      if (result.status === 'success') {
        logger.job.success(jobType, jobId, jobName);
        logger.info(`[JOB:${jobType.toUpperCase()}] Duration: ${duration}ms`);
      } else {
        logger.job.error(jobType, new Error(result.message), jobId);
      }

      return res.status(result.status === 'success' ? 200 : 500).json({
        status: result.status,
        id: jobId,
        job_name: jobName,
        message: result.message,
        source: result.source,
        destination: result.destination
      });
    }

    // Special handling for ManualSelect - processes data directly in buildCommand(), no SLURM
    if (stageName === 'ManualSelect' || cmd === null) {
      logger.job.step(jobType, 8, 'ManualSelect processed directly');

      // Check if processing was successful (builder creates success marker)
      const selectionResult = builder.getSelectionResult ? builder.getSelectionResult() : null;
      const isSuccess = selectionResult && selectionResult.num_particles > 0;

      // Update job status and particle count
      await Job.findOneAndUpdate(
        { id: jobId },
        {
          status: isSuccess ? JOB_STATUS.SUCCESS : JOB_STATUS.FAILED,
          start_time: new Date(),
          end_time: new Date(),
          particle_count: selectionResult?.num_particles || 0,
          error_message: isSuccess ? null : 'No particles found in selected classes'
        }
      );

      const duration = Date.now() - startTime;
      if (isSuccess) {
        logger.job.success(jobType, jobId, jobName);
        logger.info(`[JOB:${jobType.toUpperCase()}] Duration: ${duration}ms | Particles: ${selectionResult.num_particles}`);
      } else {
        logger.job.error(jobType, new Error('Selection failed'), jobId);
      }

      return res.status(isSuccess ? 200 : 500).json({
        status: isSuccess ? 'success' : 'error',
        id: jobId,
        job_name: jobName,
        message: isSuccess ? `Selected ${selectionResult.num_particles} particles` : 'No particles found in selected classes',
        particle_count: selectionResult?.num_particles || 0,
        selected_classes: selectionResult?.selected_classes || []
      });
    }

    // Submit job
    logger.job.step(jobType, 8, 'Submitting to SLURM queue');
    logger.project.step(projectPath, project.id, jobType, 8, 'Submitting to SLURM queue');
    const submissionResult = await submitJobDirect({
      cmd,
      jobId,
      jobName,
      stageName,
      projectPath: getProjectPath(project),
      outputDir,
      executionMode,
      slurmParams,
      postCommand: builder.postCommand
    });

    const duration = Date.now() - startTime;

    if (submissionResult.success) {
      logger.job.success(jobType, jobId, jobName, submissionResult.slurm_job_id);
      logger.project.success(projectPath, project.id, jobType, jobId, jobName, submissionResult.slurm_job_id);
      logger.slurm.submit(jobName, submissionResult.slurm_job_id, slurmParams?.queuename);
    } else {
      logger.job.error(jobType, new Error(submissionResult.error || 'Submission failed'), jobId);
      logger.project.error(projectPath, project.id, jobType, new Error(submissionResult.error || 'Submission failed'), jobId);
    }
    logger.info(`[JOB:${jobType.toUpperCase()}] Duration: ${duration}ms`);

    // Return response
    const responseStatus = submissionResult.success ? 'running' : 'error';

    res.status(submissionResult.success ? 202 : 500).json({
      status: responseStatus,
      id: jobId,
      job_name: jobName,
      slurm_job_id: submissionResult.slurm_job_id,
      message: submissionResult.message || `${stageName} job submitted successfully`,
      error: submissionResult.error
    });
  } catch (error) {
    logger.job.error(jobType, error);
    // Note: project path may not be available if project lookup failed
    return response.serverError(res, error.message);
  }
};

/**
 * Get job results
 * GET /api/jobs/:jobType/results/:jobId
 */
exports.getJobResults = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Verify ownership
    if (job.user_id !== req.user.id) {
      return response.forbidden(res);
    }

    return response.successData(res, {
      id: job.id,
      job_name: job.job_name,
      job_type: job.job_type,
      job_status: job.status,
      command: job.command,
      output_dir: job.output_file_path,
      parameters: job.parameters
    });
  } catch (error) {
    logger.error('[JobResults] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get job summary for a project
 * GET /api/jobs/:jobType/summary
 */
exports.getJobSummary = async (req, res) => {
  try {
    const { jobType } = req.params;
    const { project_id: projectId } = req.query;

    if (!projectId) {
      return response.badRequest(res, 'project_id is required');
    }

    const stageName = STAGE_NAMES[jobType] || jobType;

    const jobs = await Job.find({
      project_id: projectId,
      job_type: stageName
    }).sort({ created_at: -1 }).lean();

    const jobsData = jobs.map(job => {
      const params = job.parameters || {};

      return {
        id: job.id,
        job_name: job.job_name,
        status: job.status,
        input_files: params.input_files || '',
        movies_count: job.pipeline_stats?.micrograph_count || 0,
        angpix: params.angpix,
        kV: params.kV,
        output_dir: job.output_file_path,
        command: job.command,
        created_at: job.created_at
      };
    });

    return response.success(res, {
      jobs: jobsData,
      count: jobsData.length
    });
  } catch (error) {
    logger.error('[JobSummary] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get job details by ID
 * GET /api/jobs/:jobId
 */
exports.getJobDetails = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Verify ownership
    if (job.user_id !== req.user.id) {
      return response.forbidden(res);
    }

    return response.successData(res, {
      id: job.id,
      job_name: job.job_name,
      job_type: job.job_type,
      status: job.status,
      parameters: job.parameters,
      start_time: job.start_time,
      end_time: job.end_time,
      project_id: job.project_id
    });
  } catch (error) {
    logger.error('[JobDetails] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Browse files for job input
 * GET /api/files?project_id=...&type=...
 */
exports.browseFiles = async (req, res) => {
  // Delegated to fileController
  return response.error(res, 'Use /api/files endpoint', 501);
};

/**
 * List all jobs for a project
 * GET /jobs?project_id=...&skip=...&limit=...
 */
exports.listJobs = async (req, res) => {
  try {
    const { project_id: projectId, skip = 0, limit = 1000 } = req.query;

    if (!projectId) {
      return response.badRequest(res, 'project_id is required');
    }

    // Verify user has access to this project
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res, 'You do not have access to this project');
    }

    logger.info(`[Jobs] Listing jobs for project: ${projectId}`);

    const parsedSkip = Math.max(0, parseInt(skip, 10) || 0);
    const parsedLimit = Math.min(1000, Math.max(1, parseInt(limit, 10) || 100));

    const jobs = await Job.find({ project_id: projectId })
      .sort({ created_at: -1 })
      .skip(parsedSkip)
      .limit(parsedLimit)
      .lean();

    // Transform to match frontend expectations
    const jobsData = jobs.map(job => ({
      id: job.id,
      job_name: job.job_name,
      job_type: job.job_type,
      status: job.status,
      slurm_job_id: job.slurm_job_id,
      created_at: job.created_at,
      updated_at: job.updated_at,
      start_time: job.start_time,
      end_time: job.end_time,
      output_file_path: job.output_file_path,
      input_job_ids: job.input_job_ids || [],
      error_message: job.error_message,
      command: job.command || null,
      parameters: job.parameters || {}
    }));

    const total = await Job.countDocuments({ project_id: projectId });

    return response.success(res, {
      data: jobsData,
      count: total,
      skip: parsedSkip,
      limit: parsedLimit
    });
  } catch (error) {
    logger.error('[Jobs] List error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get job tree for a project (hierarchical view)
 * GET /api/jobs/tree?project_id=...
 * Returns hierarchical data with parent-child relationships for ReactFlow.
 *
 * Uses single-parent tree model (like CryoSPARC):
 * Each job connects to only its PRIMARY parent (most recent predecessor).
 * This gives a clean linear pipeline: Import -> Motion -> CTF -> AutoPick -> Extract -> ...
 * Jobs that reference multiple inputs (e.g., Extract uses both CTF micrographs and AutoPick coords)
 * connect only to the most recent one for tree display.
 */
exports.getJobsTree = async (req, res) => {
  try {
    const { project_id: projectId } = req.query;

    if (!projectId) {
      return response.badRequest(res, 'project_id is required');
    }

    // Verify user has access to this project
    const access = await checkProjectAccess(projectId, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res, 'You do not have access to this project');
    }

    logger.info(`[Jobs] Getting job tree for project: ${projectId}`);

    const jobs = await Job.find(
      { project_id: projectId },
      { id: 1, job_name: 1, job_type: 1, status: 1, created_at: 1, command: 1, output_file_path: 1, input_job_ids: 1 }
    ).sort({ created_at: 1 }).lean();

    // Build job lookup maps
    const jobMap = new Map();       // id -> tree node
    const jobDataMap = new Map();   // id -> raw job data (for created_at comparison)

    jobs.forEach(job => {
      jobMap.set(job.id, {
        id: job.id,
        job_name: job.job_name,
        job_type: job.job_type,
        status: job.status,
        created_at: job.created_at,
        command: job.command || null,
        output_file_path: job.output_file_path,
        parent_id: '',
        children: []
      });
      jobDataMap.set(job.id, job);
    });

    // Build parent-child relationships using single primary parent.
    // Primary parent = the most recently created job among input_job_ids.
    // This prevents diamond patterns (e.g., Extract connecting to both CTF and AutoPick).
    const rootJobs = [];
    const childOf = new Set(); // track which nodes are children

    jobs.forEach(job => {
      const node = jobMap.get(job.id);
      const inputIds = (job.input_job_ids || []).filter(id => jobMap.has(id));

      if (inputIds.length === 0) {
        rootJobs.push(node);
      } else {
        // Pick the most recent parent (highest created_at) as the primary parent
        let primaryParentId = inputIds[0];
        let latestTime = new Date(0);

        for (const parentId of inputIds) {
          const parentData = jobDataMap.get(parentId);
          if (parentData) {
            const parentTime = new Date(parentData.created_at);
            if (parentTime > latestTime) {
              latestTime = parentTime;
              primaryParentId = parentId;
            }
          }
        }

        node.parent_id = primaryParentId;
        const parent = jobMap.get(primaryParentId);
        if (parent) {
          parent.children.push(node);
          childOf.add(job.id);
        } else {
          rootJobs.push(node);
        }
      }
    });

    return response.success(res, {
      data: rootJobs,
      total_jobs: jobs.length
    });
  } catch (error) {
    logger.error('[Jobs] Tree error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get job progress (on-demand, for dashboard polling)
 * GET /api/jobs/:jobId/progress
 *
 * Only called when dashboard is open - counts output files to determine progress.
 * No background watchers - efficient for large datasets.
 */
exports.getJobProgress = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // If job is not running, return null progress (no need to count files)
    if (job.status !== JOB_STATUS.RUNNING && job.status !== 'running') {
      return response.success(res, {
        data: {
          status: job.status,
          processed: null,
          total: null,
          percentage: job.status === JOB_STATUS.SUCCESS ? 100 : null
        }
      });
    }

    const outputDir = job.output_file_path;
    if (!outputDir || !fs.existsSync(outputDir)) {
      return response.success(res, {
        data: {
          status: job.status,
          processed: 0,
          total: null,
          percentage: 0
        }
      });
    }

    // Get expected total - first try job parameters, then input Import job
    let totalExpected = getTotalExpected(job);
    logger.info(`[JobProgress] Job ${job.job_name}: totalExpected=${totalExpected}, input_job_ids=${JSON.stringify(job.input_job_ids)}`);

    // If no total found, try to find the Import job
    if (!totalExpected) {
      // Method 1: Look up input_job_ids if available
      if (job.input_job_ids && job.input_job_ids.length > 0) {
        const inputJobs = await Job.find({ id: { $in: job.input_job_ids } }).lean();
        for (const inputJob of inputJobs) {
          if (inputJob.job_type === 'Import' && (inputJob.pipeline_stats?.micrograph_count || inputJob.micrograph_count) > 0) {
            totalExpected = inputJob.pipeline_stats?.micrograph_count || inputJob.micrograph_count;
            logger.info(`[JobProgress] Found Import job via input_job_ids with ${totalExpected} micrographs`);
            break;
          }
        }
      }

      // Method 2: Extract upstream job name from parameters and look up in database
      if (!totalExpected && job.parameters) {
        const inputPath = job.parameters.inputMicrographs || job.parameters.input_star_file || job.parameters.inputMovies;
        if (inputPath) {
          // Extract job name from path like "Import/Job008/movies.star", "MotionCorr/Job003/corrected_micrographs.star", or "CtfFind/Job005/micrographs_ctf.star"
          const match = inputPath.match(/(Import|MotionCorr|Motion|CtfFind|CTF)\/(Job\d+)/i);
          if (match) {
            const upstreamJobName = match[2];
            logger.info(`[JobProgress] Looking up upstream job: ${upstreamJobName} for project ${job.project_id}`);

            // Find the upstream job in the database by job_name
            const upstreamJob = await Job.findOne({
              project_id: job.project_id,
              job_name: upstreamJobName
            }).lean();

            if (upstreamJob) {
              // Check micrograph_count first, then star_cache.total_count
              const usMicCount = upstreamJob.pipeline_stats?.micrograph_count || upstreamJob.micrograph_count || 0;
              if (usMicCount > 0) {
                totalExpected = usMicCount;
                logger.info(`[JobProgress] Found upstream job ${upstreamJobName} with ${totalExpected} micrographs (from pipeline_stats)`);
              } else if (upstreamJob.star_cache?.total_count > 0) {
                totalExpected = upstreamJob.star_cache.total_count;
                logger.info(`[JobProgress] Found upstream job ${upstreamJobName} with ${totalExpected} micrographs (from star_cache)`);
              } else {
                // Try to get count from upstream's input_job_ids (trace back to Import)
                if (upstreamJob.input_job_ids && upstreamJob.input_job_ids.length > 0) {
                  const importJob = await Job.findOne({
                    id: { $in: upstreamJob.input_job_ids },
                    job_type: 'Import'
                  }).lean();
                  if ((importJob?.pipeline_stats?.micrograph_count || importJob?.micrograph_count) > 0) {
                    totalExpected = importJob.pipeline_stats?.micrograph_count || importJob.micrograph_count;
                    logger.info(`[JobProgress] Found Import job via upstream with ${totalExpected} micrographs`);
                  }
                }
              }
            } else {
              logger.info(`[JobProgress] Upstream job ${upstreamJobName} not found`);
            }
          }
        }
      }
    }

    // Get progress by counting output files
    const progress = getJobProgress(outputDir, job.job_type, totalExpected);

    if (!progress) {
      // Job type not supported for progress tracking
      return response.success(res, {
        data: {
          status: job.status,
          processed: null,
          total: null,
          percentage: null,
          message: 'Progress tracking not available for this job type'
        }
      });
    }

    return response.success(res, {
      data: {
        status: job.status,
        processed: progress.processed,
        total: progress.total,
        percentage: progress.percentage,
        description: progress.description,
        type: progress.type,
        files: progress.files || []
      }
    });
  } catch (error) {
    logger.error('[JobProgress] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get job output files and downstream suggestions for auto-population
 * GET /api/jobs/:jobId/outputs
 */
exports.getJobOutputs = async (req, res) => {
  try {
    const { jobId } = req.params;

    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      return response.notFound(res, 'Job not found');
    }

    // Access check
    const access = await checkProjectAccess(job.project_id, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res, 'Access denied');
    }

    // If output_files not yet populated and job succeeded, catalog on-demand
    let outputFiles = job.output_files || [];
    if (outputFiles.length === 0 && job.status === JOB_STATUS.SUCCESS) {
      const { catalogOutputFiles } = require('../utils/pipelineMetadata');
      await catalogOutputFiles(job);
      const refreshed = await Job.findOne({ id: jobId }).lean();
      outputFiles = refreshed?.output_files || [];
    }

    // If still no output files (job running/pending/failed), predict from STAGE_OUTPUT_CATALOG
    // This allows users to pre-populate downstream inputs before the job completes
    if (outputFiles.length === 0 && job.output_file_path) {
      const { STAGE_OUTPUT_CATALOG } = require('../config/constants');
      const catalogEntries = STAGE_OUTPUT_CATALOG[job.job_type] || [];
      const seenRoles = new Set();

      // Derive project root from output_file_path (go up 2 levels: Stage/JobXXX -> projectRoot)
      const projectRoot = path.dirname(path.dirname(job.output_file_path));

      // Get iteration/class count from job parameters for predicting iterative filenames
      const totalIterations = job.parameters?.numberOfIterations ||
                              job.parameters?.numberIterations || 25;
      const iterStr = String(totalIterations).padStart(3, '0');

      for (const entry of catalogEntries) {
        // Only use the first file per role
        if (seenRoles.has(entry.role)) continue;

        let fileName = entry.pattern;

        if (entry.iterationAware) {
          // Predict filename by replacing iteration/class wildcards
          fileName = fileName.replace('*', iterStr);
          if (fileName.includes('*')) {
            fileName = fileName.replace('*', '001');
          }
        } else if (fileName.includes('*')) {
          // Generic wildcard pattern (e.g., *.cif) — can't predict filename
          continue;
        }

        seenRoles.add(entry.role);
        const absolutePath = path.join(job.output_file_path, fileName);
        outputFiles.push({
          role: entry.role,
          fileType: entry.fileType,
          fileName: fileName,
          relativePath: path.relative(projectRoot, absolutePath),
          predicted: true,
        });
      }
    }

    // Get downstream mapping
    const { DOWNSTREAM_INPUT_MAP } = require('../config/constants');
    const downstreamOptions = DOWNSTREAM_INPUT_MAP[job.job_type] || [];

    // Build suggestions by matching output files to downstream options
    const suggestions = downstreamOptions
      .map(opt => {
        const matchingFile = outputFiles.find(f => f.role === opt.role);
        return {
          downstream: opt.downstream,
          field: opt.field,
          role: opt.role,
          filePath: matchingFile?.relativePath || null,
          entryCount: matchingFile?.entryCount || 0,
        };
      })
      .filter(s => s.filePath); // Only include suggestions where we found a matching file

    return response.success(res, {
      data: {
        job_id: job.id,
        job_name: job.job_name,
        job_type: job.job_type,
        status: job.status,
        output_files: outputFiles,
        downstream_suggestions: suggestions,
      }
    });
  } catch (error) {
    logger.error('[JobOutputs] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get output files from completed jobs of specified stages (database-backed)
 * Replaces filesystem-scanning getStageStarFiles/getStageMrcFiles
 * GET /api/jobs/stage-outputs?project_id=...&stages=Extract,Subset&file_type=star&role=particlesStar
 */
exports.getStageOutputFiles = async (req, res) => {
  try {
    const { project_id, stages, file_type, role } = req.query;

    if (!project_id || !stages) {
      return response.badRequest(res, 'project_id and stages are required');
    }

    // Access check
    const access = await checkProjectAccess(project_id, req.user.id, 'viewer');
    if (!access.hasAccess) {
      return response.forbidden(res, 'Access denied');
    }

    const stageList = stages.split(',').map(s => s.trim()).filter(Boolean);

    // Find completed jobs of the requested stages
    const jobs = await Job.find({
      project_id,
      job_type: { $in: stageList },
      status: JOB_STATUS.SUCCESS,
    }).sort({ created_at: -1 }).lean();

    logger.info(`[StageOutputs] Query: project=${project_id}, stages=${stageList.join(',')}, file_type=${file_type || 'all'} -> found ${jobs.length} jobs`);
    for (const j of jobs) {
      logger.info(`[StageOutputs]   ${j.job_name} (${j.job_type}, status=${j.status}, output_files=${(j.output_files || []).length}, path=${j.output_file_path})`);
    }

    // Backfill: for jobs with empty output_files, catalog on-demand (max 3 concurrent)
    const { catalogOutputFiles } = require('../utils/pipelineMetadata');
    const backfillJobs = jobs.filter(j => !j.output_files || j.output_files.length === 0);

    if (backfillJobs.length > 0) {
      const BACKFILL_CONCURRENCY = 3;
      for (let i = 0; i < backfillJobs.length; i += BACKFILL_CONCURRENCY) {
        const batch = backfillJobs.slice(i, i + BACKFILL_CONCURRENCY);
        await Promise.all(
          batch.map(j => catalogOutputFiles(j).catch(err => {
            logger.warn(`[StageOutputs] Backfill failed for ${j.job_name}: ${err.message}`);
          }))
        );
      }

      // Re-fetch backfilled jobs
      const backfillIds = backfillJobs.map(j => j.id);
      const refreshed = await Job.find({
        id: { $in: backfillIds }
      }).lean();

      for (const rj of refreshed) {
        const idx = jobs.findIndex(j => j.id === rj.id);
        if (idx >= 0) jobs[idx] = rj;
      }
    }

    // Build flat output list
    const results = [];
    for (const job of jobs) {
      const outputFiles = job.output_files || [];
      for (const file of outputFiles) {
        // Apply filters
        // Match file type (treat 'mrc' as also matching 'mrcs')
        if (file_type && file.fileType !== file_type && !(file_type === 'mrc' && file.fileType === 'mrcs')) continue;
        if (role && file.role !== role) continue;

        results.push({
          filePath: file.relativePath,
          fileName: file.fileName,
          role: file.role,
          fileType: file.fileType,
          entryCount: file.entryCount || 0,
          jobName: job.job_name,
          jobType: job.job_type,
          jobStatus: job.status,
          createdAt: job.created_at,
        });
      }
    }

    return response.success(res, { data: results });
  } catch (error) {
    logger.error('[StageOutputs] Error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Save a pasted FASTA sequence as a file in the project
 * POST /api/jobs/save-fasta
 * Body: { project_id, fasta_type: 'protein'|'dna'|'rna', sequence_text, filename? }
 */
exports.saveFastaSequence = async (req, res) => {
  try {
    const { project_id, fasta_type, sequence_text, filename } = req.body;

    if (!project_id || !fasta_type || !sequence_text) {
      return response.badRequest(res, 'project_id, fasta_type, and sequence_text are required');
    }

    const validTypes = ['protein', 'dna', 'rna'];
    if (!validTypes.includes(fasta_type)) {
      return response.badRequest(res, `fasta_type must be one of: ${validTypes.join(', ')}`);
    }

    // Size limit: 1MB
    if (sequence_text.length > 1024 * 1024) {
      return response.badRequest(res, 'Sequence text exceeds 1MB limit');
    }

    // Validate FASTA format
    const trimmed = sequence_text.trim();
    if (!trimmed.startsWith('>')) {
      return response.badRequest(res, 'Invalid FASTA: must start with a header line beginning with ">"');
    }

    const lines = trimmed.split('\n');
    let hasHeader = false;
    let hasSequence = false;

    // Character sets per type
    const charSets = {
      protein: /^[ACDEFGHIKLMNPQRSTVWYX*\s]+$/i,
      dna: /^[ACGTNX\s]+$/i,
      rna: /^[ACGUNX\s]+$/i,
    };
    const allowedChars = charSets[fasta_type];

    for (const line of lines) {
      const l = line.trim();
      if (!l) continue; // skip blank lines

      if (l.startsWith('>')) {
        hasHeader = true;
      } else {
        if (!hasHeader) {
          return response.badRequest(res, 'Invalid FASTA: sequence data found before header line');
        }
        if (!allowedChars.test(l)) {
          return response.badRequest(res, `Invalid FASTA: sequence contains invalid characters for ${fasta_type}`);
        }
        hasSequence = true;
      }
    }

    if (!hasSequence) {
      return response.badRequest(res, 'Invalid FASTA: no sequence data found after header');
    }

    // Verify project access
    const project = await Project.findOne({ id: project_id }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    const access = await checkProjectAccess(project_id, req.user.id, 'editor');
    if (!access.hasAccess) {
      return response.forbidden(res, 'You do not have permission to modify this project');
    }

    const projectPath = getProjectPath(project);

    // Build safe filename
    const { sanitizeFilename } = require('../utils/pathUtils');
    const baseName = filename
      ? sanitizeFilename(filename).replace(/\.fasta$/i, '')
      : `${fasta_type}_sequence`;
    const safeFilename = `${baseName}.fasta`;

    // Write to <projectPath>/sequences/<filename>.fasta
    const seqDir = path.join(projectPath, 'sequences');
    if (!fs.existsSync(seqDir)) {
      fs.mkdirSync(seqDir, { recursive: true });
    }

    const filePath = path.join(seqDir, safeFilename);
    fs.writeFileSync(filePath, trimmed + '\n', 'utf8');

    const relativePath = `sequences/${safeFilename}`;
    logger.info(`[SaveFasta] Saved ${fasta_type} FASTA to ${relativePath} for project ${project_id}`);

    return response.successData(res, { path: relativePath });
  } catch (error) {
    logger.error('[SaveFasta] Error:', error);
    return response.serverError(res, error.message);
  }
};
