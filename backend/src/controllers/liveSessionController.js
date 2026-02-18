/**
 * Live Session Controller
 *
 * Handles live processing session management API endpoints.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const LiveSession = require('../models/LiveSession');
const Project = require('../models/Project');
const Job = require('../models/Job');
const response = require('../utils/responseHelper');
const { getProjectPath } = require('../utils/pathUtils');
const { mapKeys } = require('../utils/mapKeys');

/**
 * Create a new live session (and optionally a new project)
 * POST /api/live-sessions/
 */
exports.createSession = async (req, res) => {
  try {
    const {
      // Project fields (if creating new project)
      projectName,
      description,
      // Or existing project
      projectId: existingProjectId,
      // Session config
      inputMode,
      watchDirectory,
      filePattern,
      optics,
      motionConfig,
      ctfConfig,
      pickingConfig,
      extractionConfig,
      class2dConfig,
      thresholds,
      slurmConfig
    } = req.body;

    // Validate inputMode
    if (inputMode && !['watch', 'existing'].includes(inputMode)) {
      return response.badRequest(res, 'inputMode must be "watch" or "existing"');
    }

    // Validate watch directory
    if (!watchDirectory) {
      return response.badRequest(res, 'Watch directory is required');
    }

    // Validate optics
    if (!optics || !optics.pixelSize || !optics.voltage || !optics.cs) {
      return response.badRequest(res, 'Optics parameters (pixelSize, voltage, cs) are required');
    }

    // Validate optics numeric ranges
    if (optics.pixelSize <= 0) {
      return response.badRequest(res, 'Pixel size must be positive');
    }
    if (optics.voltage <= 0) {
      return response.badRequest(res, 'Voltage must be positive');
    }

    // Validate watch directory exists
    try {
      const stats = fs.statSync(watchDirectory);
      if (!stats.isDirectory()) {
        return response.badRequest(res, 'Watch directory path is not a directory');
      }
    } catch (err) {
      return response.badRequest(res, `Watch directory does not exist: ${watchDirectory}`);
    }

    let projectId = existingProjectId;

    // Create new project if projectName is provided
    if (projectName && !existingProjectId) {
      const project = new Project({
        id: Project.generateId(),
        project_name: projectName,
        description: description || '',
        folder_name: projectName.replace(/[^a-zA-Z0-9_-]/g, '_'),
        created_by_id: req.user.id
      });

      // Create project directory
      const projectPath = project.getPath(require('../config/settings').ROOT_PATH);
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      await project.save();
      projectId = project.id;
      logger.info(`[LiveSession] Created project "${projectName}" (${projectId})`);
    }

    if (!projectId) {
      return response.badRequest(res, 'Either projectId or projectName is required');
    }

    // Verify project exists
    const project = await Project.findOne({ id: projectId });
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    // Create live session
    const sessionId = LiveSession.generateId();
    const sessionName = await LiveSession.getNextSessionName(projectId);

    const session = new LiveSession({
      id: sessionId,
      project_id: projectId,
      user_id: req.user.id,
      session_name: sessionName,
      input_mode: inputMode || 'watch',
      watch_directory: watchDirectory,
      file_pattern: filePattern || '*.tiff',
      optics: {
        pixel_size: optics.pixelSize,
        voltage: optics.voltage,
        cs: optics.cs,
        amplitude_contrast: optics.amplitudeContrast || 0.1,
        optics_group_name: optics.opticsGroupName || 'opticsGroup1'
      },
      motion_config: motionConfig || {},
      ctf_config: ctfConfig || {},
      picking_config: pickingConfig || {},
      extraction_config: extractionConfig || {},
      class2d_config: class2dConfig || {},
      thresholds: thresholds || {},
      slurm_config: slurmConfig || {},
      activity_log: [{
        timestamp: new Date(),
        event: 'session_created',
        message: `Live session "${sessionName}" created`
      }]
    });

    await session.save();

    logger.info(`[LiveSession] Created session "${sessionName}" (${sessionId}) for project ${projectId}`);

    return response.success(res, {
      data: mapKeys(session.toObject()),
      projectId,
      sessionId,
      sessionName
    });
  } catch (error) {
    logger.error(`[LiveSession] Create failed: ${error.message}`);

    // Handle duplicate project name
    if (error.code === 11000) {
      return response.conflict(res, 'A project with that name already exists');
    }

    return response.serverError(res, error.message);
  }
};

/**
 * Start a live session
 * POST /api/live-sessions/:id/start
 */
exports.startSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status === 'running') {
      return response.badRequest(res, 'Session is already running');
    }

    if (session.status === 'stopped' || session.status === 'completed') {
      return response.badRequest(res, 'Cannot restart a stopped/completed session. Create a new one.');
    }

    // Lazy-load orchestrator to avoid circular deps
    const { getLiveOrchestrator } = require('../services/liveOrchestrator');
    const orchestrator = getLiveOrchestrator();
    await orchestrator.startSession(id);

    return response.success(res, { message: 'Session started' });
  } catch (error) {
    logger.error(`[LiveSession] Start failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Pause a live session
 * POST /api/live-sessions/:id/pause
 */
exports.pauseSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status !== 'running') {
      return response.badRequest(res, 'Session is not running');
    }

    const { getLiveOrchestrator } = require('../services/liveOrchestrator');
    const orchestrator = getLiveOrchestrator();
    await orchestrator.pauseSession(id);

    return response.success(res, { message: 'Session paused' });
  } catch (error) {
    logger.error(`[LiveSession] Pause failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Resume a paused live session
 * POST /api/live-sessions/:id/resume
 */
exports.resumeSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status !== 'paused') {
      return response.badRequest(res, 'Session is not paused');
    }

    const { getLiveOrchestrator } = require('../services/liveOrchestrator');
    const orchestrator = getLiveOrchestrator();
    await orchestrator.resumeSession(id);

    return response.success(res, { message: 'Session resumed' });
  } catch (error) {
    logger.error(`[LiveSession] Resume failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Stop a live session
 * POST /api/live-sessions/:id/stop
 */
exports.stopSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status === 'stopped' || session.status === 'completed') {
      return response.badRequest(res, 'Session is already stopped');
    }

    const { getLiveOrchestrator } = require('../services/liveOrchestrator');
    const orchestrator = getLiveOrchestrator();
    await orchestrator.stopSession(id);

    return response.success(res, { message: 'Session stopped' });
  } catch (error) {
    logger.error(`[LiveSession] Stop failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Get live session details
 * GET /api/live-sessions/:id
 */
exports.getSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id }).lean();
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    return response.success(res, { data: mapKeys(session) });
  } catch (error) {
    logger.error(`[LiveSession] Get failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Get quality stats for live session (CTF res distribution, motion distribution)
 * GET /api/live-sessions/:id/stats
 */
exports.getSessionStats = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id }).lean();
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // Get all jobs created by this session
    const jobIds = [
      session.jobs.import_id,
      session.jobs.motion_id,
      session.jobs.ctf_id,
      session.jobs.pick_id,
      session.jobs.extract_id,
      ...(session.jobs.class2d_ids || [])
    ].filter(Boolean);

    const jobs = await Job.find({ id: { $in: jobIds } })
      .select('id job_name job_type status pipeline_stats start_time end_time')
      .lean();

    const jobsByType = {};
    for (const job of jobs) {
      jobsByType[job.job_type] = job;
    }

    return response.success(res, {
      data: {
        state: session.state,
        jobs: mapKeys(jobsByType),
        thresholds: session.thresholds
      }
    });
  } catch (error) {
    logger.error(`[LiveSession] Stats failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Get per-micrograph exposure data for the session
 * GET /api/live-sessions/:id/exposures
 */
exports.getSessionExposures = async (req, res) => {
  try {
    const { id } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    const session = await LiveSession.findOne({ id }).lean();
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // Get CTF job to read micrograph-level results
    if (!session.jobs.ctf_id) {
      return response.success(res, { data: [], total: 0 });
    }

    const ctfJob = await Job.findOne({ id: session.jobs.ctf_id }).lean();
    if (!ctfJob || !ctfJob.output_file_path) {
      return response.success(res, { data: [], total: 0 });
    }

    // Read micrographs_ctf.star to get per-micrograph data
    // This is handled by the existing dashboard controller pattern
    const project = await Project.findOne({ id: session.project_id });
    if (!project) {
      return response.success(res, { data: [], total: 0 });
    }

    const projectPath = getProjectPath(project);
    const ctfOutputDir = path.isAbsolute(ctfJob.output_file_path)
      ? ctfJob.output_file_path
      : path.join(projectPath, ctfJob.output_file_path);
    const starFile = path.join(ctfOutputDir, 'micrographs_ctf.star');

    if (!fs.existsSync(starFile)) {
      return response.success(res, { data: [], total: 0 });
    }

    // Parse STAR file for exposure data
    const { parseStarFile } = require('../utils/starParser');
    const starData = await parseStarFile(starFile);

    const micrographs = (starData.files || []).map(mic => ({
      filename: path.basename(mic.rlnMicrographName || ''),
      ctfResolution: mic.rlnCtfMaxResolution || null,
      defocusU: mic.rlnDefocusU || null,
      defocusV: mic.rlnDefocusV || null,
      astigmatism: mic.rlnCtfAstigmatism || null,
      phaseShift: mic.rlnPhaseShift || null
    }));

    const total = micrographs.length;
    const sliced = micrographs.slice(parseInt(offset), parseInt(offset) + parseInt(limit));

    return response.success(res, {
      data: sliced,
      total,
      offset: parseInt(offset),
      limit: parseInt(limit)
    });
  } catch (error) {
    logger.error(`[LiveSession] Exposures failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Get activity log for session
 * GET /api/live-sessions/:id/activity
 */
exports.getSessionActivity = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 100, level, stage, search } = req.query;

    const session = await LiveSession.findOne({ id })
      .select('activity_log')
      .lean();

    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    const allLogs = session.activity_log || [];
    const unfilteredTotal = allLogs.length;

    // Apply filters
    let filtered = allLogs;

    // Filter by severity level (comma-separated: "error,warning")
    if (level) {
      const levels = level.split(',').map(l => l.trim().toLowerCase());
      filtered = filtered.filter(entry => levels.includes(entry.level || 'info'));
    }

    // Filter by pipeline stage
    if (stage) {
      const stageLower = stage.toLowerCase();
      filtered = filtered.filter(entry =>
        entry.stage && entry.stage.toLowerCase() === stageLower
      );
    }

    // Free-text search across message and event
    if (search) {
      const searchLower = search.toLowerCase();
      filtered = filtered.filter(entry =>
        (entry.message && entry.message.toLowerCase().includes(searchLower)) ||
        (entry.event && entry.event.toLowerCase().includes(searchLower))
      );
    }

    const total = filtered.length;
    const logs = filtered
      .slice(-parseInt(limit))
      .reverse(); // Most recent first

    return response.success(res, { data: logs.map(mapKeys), total, unfilteredTotal });
  } catch (error) {
    logger.error(`[LiveSession] Activity failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * List live sessions for a project
 * GET /api/live-sessions/project/:projectId
 */
exports.listProjectSessions = async (req, res) => {
  try {
    const { projectId } = req.params;

    const sessions = await LiveSession.find({ project_id: projectId })
      .sort({ created_at: -1 })
      .select('id session_name status state input_mode created_at start_time end_time')
      .lean();

    return response.success(res, { data: sessions.map(mapKeys) });
  } catch (error) {
    logger.error(`[LiveSession] List failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Delete a live session
 * DELETE /api/live-sessions/:id
 */
exports.deleteSession = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // Must stop first if running
    if (session.status === 'running' || session.status === 'paused') {
      const { getLiveOrchestrator } = require('../services/liveOrchestrator');
      const orchestrator = getLiveOrchestrator();
      await orchestrator.stopSession(id);
    }

    // Clean up associated jobs to avoid orphans
    const jobIds = [
      session.jobs?.import_id,
      session.jobs?.motion_id,
      session.jobs?.ctf_id,
      session.jobs?.pick_id,
      session.jobs?.extract_id,
      ...(session.jobs?.class2d_ids || [])
    ].filter(Boolean);

    if (jobIds.length > 0) {
      const deleted = await Job.deleteMany({ id: { $in: jobIds } });
      logger.info(`[LiveSession] Cleaned up ${deleted.deletedCount} jobs for session ${id}`);
    }

    await LiveSession.deleteOne({ id });

    logger.info(`[LiveSession] Deleted session ${id}`);
    return response.success(res, { message: 'Session deleted' });
  } catch (error) {
    logger.error(`[LiveSession] Delete failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};
