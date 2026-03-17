/**
 * Live Session Controller
 *
 * Handles live processing session management API endpoints.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../utils/logger');
const LiveSession = require('../models/LiveSession');
const Project = require('../models/Project');
const Job = require('../models/Job');
const response = require('../utils/responseHelper');
const { getProjectPath } = require('../utils/pathUtils');
const { mapKeys, mapKeysToSnake } = require('../utils/mapKeys');

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
      batchSize,
      optics,
      motionConfig,
      ctfConfig,
      pickingConfig,
      extractionConfig,
      class2dConfig,
      autoSelectConfig,
      inimodelConfig,
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
      batch_size: parseInt(batchSize) || 25,
      optics: {
        pixel_size: optics.pixelSize,
        voltage: optics.voltage,
        cs: optics.cs,
        amplitude_contrast: optics.amplitudeContrast || 0.1,
        optics_group_name: optics.opticsGroupName || 'opticsGroup1'
      },
      motion_config: mapKeysToSnake(motionConfig || {}),
      ctf_config: mapKeysToSnake(ctfConfig || {}),
      picking_config: mapKeysToSnake(pickingConfig || {}),
      extraction_config: mapKeysToSnake(extractionConfig || {}),
      class2d_config: mapKeysToSnake(class2dConfig || {}),
      auto_select_config: mapKeysToSnake(autoSelectConfig || {}),
      inimodel_config: mapKeysToSnake(inimodelConfig || {}),
      thresholds: mapKeysToSnake(thresholds || {}),
      slurm_config: mapKeysToSnake(slurmConfig || {}),
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

    // Prevent two sessions on the same project from running simultaneously
    // (they would share the Movies/ directory → file conflicts and data corruption)
    const conflicting = await LiveSession.findOne({
      project_id: session.project_id,
      id: { $ne: session.id },
      status: { $in: ['running', 'paused'] }
    });
    if (conflicting) {
      return response.badRequest(res,
        `Another session ("${conflicting.session_name}") is already active on this project. Stop it first.`
      );
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

    // Include latest job status for all stages so frontend can show failed (red) vs completed (green)
    const Job = require('../models/Job');
    const latestJobStatus = {};
    // Single-job stages
    for (const [key, field] of [['import', 'import_id'], ['motion', 'motion_id'], ['ctf', 'ctf_id'], ['pick', 'pick_id'], ['extract', 'extract_id']]) {
      const jobId = session.jobs?.[field];
      if (jobId) {
        const job = await Job.findOne({ id: jobId }).select('status').lean();
        latestJobStatus[key] = job?.status || null;
      }
    }
    // Array-based stages
    for (const [key, field] of [['class2d', 'class2d_ids'], ['select', 'select_ids'], ['inimodel', 'inimodel_ids']]) {
      const ids = session.jobs?.[field] || [];
      if (ids.length > 0) {
        const latest = await Job.findOne({ id: ids[ids.length - 1] }).select('status').lean();
        latestJobStatus[key] = latest?.status || null;
      }
    }
    session.latest_job_status = latestJobStatus;

    return response.success(res, { data: mapKeys(session) });
  } catch (error) {
    logger.error(`[LiveSession] Get failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};

/**
 * Update live session config mid-run.
 * PATCH /api/live-sessions/:id/config
 *
 * Only allows updating processing parameters that the orchestrator reads fresh
 * from the database on each pipeline pass. Rejects changes to watcher/startup
 * fields (watch_directory, file_pattern, input_mode, optics).
 */
exports.updateSessionConfig = async (req, res) => {
  try {
    const { id } = req.params;
    const body = req.body;

    const session = await LiveSession.findOne({ id });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // Fields that are safe to update mid-run
    const UPDATABLE_CONFIGS = {
      batchSize:        'batch_size',
      thresholds:       'thresholds',
      motionConfig:     'motion_config',
      ctfConfig:        'ctf_config',
      pickingConfig:    'picking_config',
      extractionConfig: 'extraction_config',
      class2dConfig:    'class2d_config',
      autoSelectConfig: 'auto_select_config',
      inimodelConfig:   'inimodel_config',
      slurmConfig:      'slurm_config',
    };

    // Reject unsafe fields
    const UNSAFE_FIELDS = ['watchDirectory', 'filePattern', 'inputMode', 'optics', 'watch_directory', 'file_pattern', 'input_mode'];
    const rejected = Object.keys(body).filter(k => UNSAFE_FIELDS.includes(k));
    if (rejected.length > 0) {
      return response.badRequest(res, `Cannot change mid-run: ${rejected.join(', ')}. These are locked after session start.`);
    }

    const updateFields = {};
    const changedKeys = [];

    for (const [formKey, dbField] of Object.entries(UPDATABLE_CONFIGS)) {
      if (body[formKey] === undefined) continue;

      changedKeys.push(formKey);

      if (formKey === 'batchSize') {
        // Scalar field
        updateFields[dbField] = parseInt(body[formKey], 10) || 25;
      } else {
        // Nested config object — merge with existing to preserve unset fields
        const existing = session[dbField]?.toObject?.() || session[dbField] || {};
        const incoming = mapKeysToSnake(body[formKey] || {});
        updateFields[dbField] = { ...existing, ...incoming };
      }
    }

    if (changedKeys.length === 0) {
      return response.badRequest(res, 'No updatable fields provided');
    }

    await LiveSession.findOneAndUpdate({ id }, { $set: updateFields });

    // Log activity
    await session.addActivity('config_updated', `Configuration updated: ${changedKeys.join(', ')}`, {
      level: 'info',
      context: { changedKeys }
    });

    // Notify orchestrator to handle newly-enabled stages
    try {
      const { getLiveOrchestrator } = require('../services/liveOrchestrator');
      const orchestrator = getLiveOrchestrator();
      await orchestrator.onConfigUpdated(id, changedKeys);
    } catch (orchErr) {
      logger.debug(`[LiveSession] Orchestrator notification skipped: ${orchErr.message}`);
    }

    const updated = await LiveSession.findOne({ id }).lean();
    logger.info(`[LiveSession] Config updated for session ${id}: ${changedKeys.join(', ')}`);

    return response.success(res, { data: mapKeys(updated), changedKeys });
  } catch (error) {
    logger.error(`[LiveSession] Config update failed: ${error.message}`);
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
      session.jobs?.import_id,
      session.jobs?.motion_id,
      session.jobs?.ctf_id,
      session.jobs?.pick_id,
      session.jobs?.extract_id,
      ...(session.jobs?.class2d_ids || []),
      ...(session.jobs?.select_ids || []),
      ...(session.jobs?.inimodel_ids || [])
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
        state: mapKeys(session.state),
        jobs: mapKeys(jobsByType),
        thresholds: mapKeys(session.thresholds)
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
    if (!session.jobs?.ctf_id) {
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
      ...(session.jobs?.class2d_ids || []),
      ...(session.jobs?.select_ids || []),
      ...(session.jobs?.inimodel_ids || [])
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

/**
 * Get selected 2D class gallery for a live session.
 * Reads class images from the parent Class2D job and filters to
 * only the classes present in the Select (class_ranker) output.
 * GET /api/live-sessions/:id/select-gallery
 */
exports.getSelectGallery = async (req, res) => {
  try {
    const { id } = req.params;

    const session = await LiveSession.findOne({ id }).lean();
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // Find the latest select job
    const selectIds = session.jobs?.select_ids || [];
    if (selectIds.length === 0) {
      return response.successData(res, { classes: [], message: 'No select jobs yet' });
    }

    const selectJobId = selectIds[selectIds.length - 1];
    const selectJob = await Job.findOne({ id: selectJobId }).lean();
    if (!selectJob) {
      return response.successData(res, { classes: [], message: 'Select job not found' });
    }

    // Find the parent Class2D job (from input_job_ids)
    const class2dJobId = selectJob.input_job_ids?.[0];
    if (!class2dJobId) {
      return response.successData(res, { classes: [], message: 'Parent Class2D job not found' });
    }

    const class2dJob = await Job.findOne({ id: class2dJobId }).lean();
    if (!class2dJob) {
      return response.successData(res, { classes: [], message: 'Parent Class2D job not found' });
    }

    const project = await Project.findOne({ id: session.project_id }).lean();
    if (!project) {
      return response.notFound(res, 'Project not found');
    }

    const projectPath = getProjectPath(project);

    // --- Determine selected class numbers from particles.star ---
    const selectOutputDir = path.isAbsolute(selectJob.output_file_path)
      ? selectJob.output_file_path
      : path.join(projectPath, selectJob.output_file_path);
    const particlesPath = path.join(selectOutputDir, 'particles.star');

    let selectedClassNumbers = new Set();
    if (fs.existsSync(particlesPath)) {
      // Parse particles.star to find unique _rlnClassNumber values
      const content = fs.readFileSync(particlesPath, 'utf-8');
      const lines = content.split('\n');
      let classColIdx = -1;
      let inLoop = false;
      let pastHeaders = false;

      for (const rawLine of lines) {
        const line = rawLine.trim();
        if (!line || line.startsWith('#')) continue;

        if (line === 'loop_') {
          inLoop = true;
          classColIdx = -1;
          pastHeaders = false;
          continue;
        }
        if (line.startsWith('data_')) {
          inLoop = false;
          classColIdx = -1;
          pastHeaders = false;
          continue;
        }

        if (inLoop && line.startsWith('_')) {
          const parts = line.split(/\s+/);
          const idxMatch = parts[1] && parts[1].match(/#(\d+)/);
          if (idxMatch && parts[0] === '_rlnClassNumber') {
            classColIdx = parseInt(idxMatch[1], 10) - 1;
          }
          continue;
        }

        // Data row
        if (inLoop && classColIdx >= 0 && !line.startsWith('_')) {
          pastHeaders = true;
          const values = line.split(/\s+/);
          if (classColIdx < values.length) {
            selectedClassNumbers.add(parseInt(values[classColIdx], 10));
          }
        }
      }
    }

    selectedClassNumbers = [...selectedClassNumbers].sort((a, b) => a - b);

    // --- Read class images from Class2D output ---
    const class2dOutputDir = path.isAbsolute(class2dJob.output_file_path)
      ? class2dJob.output_file_path
      : path.join(projectPath, class2dJob.output_file_path);

    // Find latest iteration .mrcs file
    const mrcsFiles = glob.sync(path.join(class2dOutputDir, '*_it*_classes.mrcs'));
    if (mrcsFiles.length === 0) {
      return response.successData(res, {
        classes: [],
        selectedClassNumbers,
        selectJobId,
        selectJobName: selectJob.job_name,
        class2dJobName: class2dJob.job_name,
        message: 'No class image files found'
      });
    }

    // Sort and pick latest
    mrcsFiles.sort();
    const latestMrcs = mrcsFiles[mrcsFiles.length - 1];

    // Parse model.star for metadata
    const modelPath = latestMrcs.replace('_classes.mrcs', '_model.star');
    const classMetadata = {};
    if (fs.existsSync(modelPath)) {
      const content = fs.readFileSync(modelPath, 'utf8');
      if (content.includes('data_model_classes')) {
        const blocks = content.split(/\n(?=data_)/);
        for (const block of blocks) {
          if (!block.includes('data_model_classes')) continue;
          const bLines = block.trim().split('\n');
          const headers = {};
          let headerIdx = 0;
          for (let i = 0; i < bLines.length; i++) {
            const colMatch = bLines[i].match(/(_rln\w+)\s+#(\d+)/);
            if (colMatch) {
              headers[colMatch[1]] = parseInt(colMatch[2], 10) - 1;
              headerIdx = i;
            }
          }
          for (let i = headerIdx + 1; i < bLines.length; i++) {
            const line = bLines[i].trim();
            if (!line || line.startsWith('#') || line.startsWith('_') || line.startsWith('loop')) continue;
            const parts = line.split(/\s+/);
            if (parts.length < 2) continue;
            const refImage = parts[headers['_rlnReferenceImage'] || 0];
            const match2d = refImage && refImage.match(/^(\d+)@/);
            if (match2d) {
              const classNum = parseInt(match2d[1], 10);
              const distIdx = headers['_rlnClassDistribution'];
              const resIdx = headers['_rlnEstimatedResolution'];
              classMetadata[classNum] = {
                distribution: distIdx != null && distIdx < parts.length ? parseFloat(parts[distIdx]) : 0,
                estimatedResolution: resIdx != null && resIdx < parts.length ? parseFloat(parts[resIdx]) : 999,
              };
            }
          }
          break;
        }
      }
    }

    // Read MRCS frames and render selected classes as PNG
    const { readMrcFrame, normalizeWithPercentile, getMrcInfo } = require('../utils/mrcParser');
    const sharp = require('sharp');

    const mrcInfo = getMrcInfo(latestMrcs);
    if (!mrcInfo) {
      return response.serverError(res, 'Could not read class file');
    }

    const classesData = [];
    const numClasses = mrcInfo.num_frames;

    // If we couldn't determine selected classes from particles.star, show all
    const showAll = selectedClassNumbers.length === 0;

    for (let i = 0; i < numClasses; i++) {
      const classNum = i + 1;
      if (!showAll && !selectedClassNumbers.includes(classNum)) continue;

      try {
        const frame = readMrcFrame(latestMrcs, i);
        if (!frame) continue;

        const uint8Data = normalizeWithPercentile(frame.data, 1, 99);
        let image = sharp(uint8Data, { raw: { width: frame.width, height: frame.height, channels: 1 } });

        const maxSize = 128;
        if (frame.width > maxSize || frame.height > maxSize) {
          image = image.resize(maxSize, maxSize, { fit: 'inside' });
        }

        const pngBuffer = await image.png().toBuffer();
        const meta = classMetadata[classNum] || {};

        classesData.push({
          classNumber: classNum,
          image: `data:image/png;base64,${pngBuffer.toString('base64')}`,
          distribution: meta.distribution || 0,
          estimatedResolution: meta.estimatedResolution || 999,
          particleFraction: meta.distribution ? Math.round(meta.distribution * 10000) / 100 : 0,
        });
      } catch (e) {
        logger.warn(`[LiveSession] Error reading class ${classNum}: ${e.message}`);
      }
    }

    // Parse iteration number from filename
    const iterMatch = path.basename(latestMrcs).match(/_it(\d+)_classes/);
    const iteration = iterMatch ? parseInt(iterMatch[1], 10) : null;

    return response.successData(res, {
      selectJobId,
      selectJobName: selectJob.job_name,
      selectJobStatus: selectJob.status,
      class2dJobName: class2dJob.job_name,
      iteration,
      numSelected: classesData.length,
      numTotal: numClasses,
      selectedClassNumbers,
      classes: classesData,
    });
  } catch (error) {
    logger.error(`[LiveSession] Select gallery failed: ${error.message}`);
    return response.serverError(res, error.message);
  }
};
