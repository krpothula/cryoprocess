/**
 * SmartScope Controller
 *
 * REST API endpoints for SmartScope integration (session/watch mode).
 *
 * SmartScope sends optics params + watch directory, CryoProcess watches
 * for new movies and runs Import → MotionCorr → CTF. SmartScope polls
 * /results/:sessionId to get per-micrograph CTF data.
 *
 * Endpoints:
 *   GET  /api/smartscope/health              — Health check
 *   POST /api/smartscope/start               — Start watching raw directory
 *   GET  /api/smartscope/results/:sessionId  — Get completed results
 *   POST /api/smartscope/stop/:sessionId     — Stop watching
 *   POST /api/smartscope/pause/:sessionId    — Pause watching
 *   POST /api/smartscope/resume/:sessionId   — Resume watching
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const response = require('../utils/responseHelper');
const settings = require('../config/settings');
const smartscopeService = require('../services/smartscopeService');
const { parseStarFile } = require('../utils/starParser');
const LiveSession = require('../models/LiveSession');
const Project = require('../models/Project');
const Job = require('../models/Job');
const { getLiveOrchestrator } = require('../services/liveOrchestrator');

/**
 * Health check / connection test
 * GET /api/smartscope/health
 *
 * Response: { "status": "ok", "slurm_partition": "gpu" }
 */
exports.health = async (req, res) => {
  return response.success(res, {
    status: 'ok',
    slurm_partition: settings.SLURM_PARTITION
  });
};

/**
 * Start watching a raw directory for new micrographs
 * POST /api/smartscope/start
 *
 * Request: {
 *   watch_dir, grid_name, output_dir, pixel_size, voltage, cs,
 *   amplitude_contrast, threads, gpus, n_processes
 * }
 * Response: { "session_id": "sess-abc-123" }
 */
exports.startSession = async (req, res) => {
  try {
    const {
      watch_dir,
      grid_name,
      output_dir,
      pixel_size,
      voltage,
      cs,
      amplitude_contrast = 0.1,
      file_pattern = '*.tiff',
      threads,
      gpus,
      n_processes
    } = req.body;

    // Validate required fields
    if (!watch_dir) {
      return response.badRequest(res, 'watch_dir is required');
    }
    if (!pixel_size || pixel_size <= 0) {
      return response.badRequest(res, 'pixel_size must be a positive number');
    }
    if (!voltage || voltage <= 0) {
      return response.badRequest(res, 'voltage must be a positive number');
    }
    if (cs === undefined || cs === null) {
      return response.badRequest(res, 'cs (spherical aberration) is required');
    }

    // Validate watch directory exists
    if (!fs.existsSync(watch_dir)) {
      return response.badRequest(res, `Watch directory not found: ${watch_dir}`);
    }

    // Project name: use grid_name if provided, otherwise date-based
    const projName = grid_name || `SmartScope_${new Date().toISOString().split('T')[0]}`;
    const sessionName = projName;

    // Create or find project
    let project = await Project.findOne({ project_name: projName });
    if (!project) {
      project = new Project({
        id: Project.generateId(),
        project_name: projName,
        description: `SmartScope session: ${sessionName}`,
        folder_name: projName,
        created_by_id: req.user.id
      });

      // Create project directory
      const projectPath = project.getPath(settings.ROOT_PATH);
      if (!fs.existsSync(projectPath)) {
        fs.mkdirSync(projectPath, { recursive: true });
      }

      await project.save();
      logger.info(`[SmartScope] Created project: ${projName} (${project.id})`);
    }

    // Create live session (Import → MotionCorr → CTF only)
    const session = new LiveSession({
      id: LiveSession.generateId ? LiveSession.generateId() : require('mongoose').Types.ObjectId().toString(),
      project_id: project.id,
      user_id: req.user.id,
      session_name: sessionName,
      status: 'pending',
      input_mode: 'watch',
      watch_directory: watch_dir,
      file_pattern,
      optics: {
        pixel_size: parseFloat(pixel_size),
        voltage: parseFloat(voltage),
        cs: parseFloat(cs),
        amplitude_contrast: parseFloat(amplitude_contrast)
      },
      // SmartScope only needs Import → MotionCorr → CTF
      picking_config: { enabled: false },
      extraction_config: { enabled: false },
      class2d_config: { enabled: false }
    });

    await session.save();
    logger.info(`[SmartScope] Session created: ${session.id} | grid: ${grid_name || 'default'} | watching: ${watch_dir}`);

    // Start the session via live orchestrator
    const orchestrator = getLiveOrchestrator();
    await orchestrator.startSession(session.id);

    return response.success(res, { session_id: session.id }, 201);

  } catch (err) {
    logger.error(`[SmartScope] Start error: ${err.message}`);
    return response.serverError(res, err.message);
  }
};

/**
 * Get completed micrograph results
 * GET /api/smartscope/results/:sessionId
 *
 * Response: {
 *   "micrographs": [
 *     { "micrograph_name": "micrograph_001", "status": "completed", "defocus": 1.5, ... },
 *     { "micrograph_name": "micrograph_002", "status": "running" },
 *     { "micrograph_name": "micrograph_003", "status": "failed", "error": "..." }
 *   ]
 * }
 *
 * micrograph_name = filename without extension
 * status = completed | running | queued | failed
 */
exports.getResults = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    // No CTF job yet — return empty micrographs
    if (!session.jobs.ctf_id) {
      return response.success(res, { micrographs: [] });
    }

    const ctfJob = await Job.findOne({ id: session.jobs.ctf_id }).lean();
    if (!ctfJob || !ctfJob.output_file_path) {
      return response.success(res, { micrographs: [] });
    }

    const ctfStarPath = path.join(ctfJob.output_file_path, 'micrographs_ctf.star');
    if (!fs.existsSync(ctfStarPath)) {
      return response.success(res, { micrographs: [] });
    }

    // Resolve project root for converting RELION relative paths to absolute
    const project = await Project.findOne({ id: session.project_id });
    const projectRoot = project ? project.getPath(settings.ROOT_PATH) : '';

    const toAbsolute = (relPath) => {
      if (!relPath) return '';
      if (path.isAbsolute(relPath)) return relPath;
      return projectRoot ? path.join(projectRoot, relPath) : relPath;
    };

    // Parse CTF STAR file
    const starData = await parseStarFile(ctfStarPath);
    const rows = starData.micrographs?.rows || starData.files || [];

    const micrographs = [];
    for (const row of rows) {
      const relMicrographPath = row.rlnMicrographName || '';
      const relCtfImagePath = row.rlnCtfImage || '';
      const micrographPath = toAbsolute(relMicrographPath);
      const ctfImagePath = toAbsolute(relCtfImagePath);

      // micrograph_name = filename without extension
      const micrographName = relMicrographPath
        ? path.basename(relMicrographPath, path.extname(relMicrographPath))
        : '';

      const defocusU = parseFloat(row.rlnDefocusU || 0);
      const defocusV = parseFloat(row.rlnDefocusV || 0);
      const defocusAngle = parseFloat(row.rlnDefocusAngle || 0);
      const ctfFit = parseFloat(row.rlnCtfFigureOfMerit || 0);
      const imageX = parseInt(row.rlnImageSizeX || 0, 10);
      const imageY = parseInt(row.rlnImageSizeY || 0, 10);

      // Convert defocus from Angstroms to micrometers
      const defocus = (defocusU + defocusV) / 2 / 10000;
      const astig = Math.abs(defocusU - defocusV) / 10000;

      // Generate PNGs lazily (cached on disk after first conversion)
      const micrographPng = await smartscopeService.mrcToPng(micrographPath);
      const ctfPng = await smartscopeService.mrcToPng(ctfImagePath, '_ctf');

      micrographs.push({
        micrograph_name: micrographName,
        status: 'completed',
        defocus: Math.round(defocus * 1000) / 1000,
        astig: Math.round(astig * 1000) / 1000,
        angast: Math.round(defocusAngle * 10) / 10,
        ctffit: Math.round(ctfFit * 1000) / 1000,
        shape_x: imageX,
        shape_y: imageY,
        pixel_size: session.optics.pixel_size,
        micrograph_png: micrographPng,
        ctf_png: ctfPng
      });
    }

    return response.success(res, { micrographs });

  } catch (err) {
    logger.error(`[SmartScope] Results error: ${err.message}`);
    return response.serverError(res, err.message);
  }
};

/**
 * Stop watching
 * POST /api/smartscope/stop/:sessionId
 *
 * Response: { "status": "stopped" }
 */
exports.stopSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status === 'stopped' || session.status === 'completed') {
      return response.success(res, { status: session.status });
    }

    const orchestrator = getLiveOrchestrator();
    await orchestrator.stopSession(sessionId);

    return response.success(res, { status: 'stopped' });

  } catch (err) {
    logger.error(`[SmartScope] Stop error: ${err.message}`);
    return response.serverError(res, err.message);
  }
};

/**
 * Pause watching
 * POST /api/smartscope/pause/:sessionId
 *
 * Response: { "status": "paused" }
 */
exports.pauseSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status === 'stopped' || session.status === 'completed') {
      return response.badRequest(res, `Cannot pause session in ${session.status} state`);
    }

    const orchestrator = getLiveOrchestrator();
    await orchestrator.pauseSession(sessionId);

    return response.success(res, { status: 'paused' });

  } catch (err) {
    logger.error(`[SmartScope] Pause error: ${err.message}`);
    return response.serverError(res, err.message);
  }
};

/**
 * Resume watching
 * POST /api/smartscope/resume/:sessionId
 *
 * Response: { "status": "running" }
 */
exports.resumeSession = async (req, res) => {
  try {
    const { sessionId } = req.params;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) {
      return response.notFound(res, 'Session not found');
    }

    if (session.status === 'stopped' || session.status === 'completed') {
      return response.badRequest(res, `Cannot resume session in ${session.status} state`);
    }

    const orchestrator = getLiveOrchestrator();
    await orchestrator.resumeSession(sessionId);

    return response.success(res, { status: 'running' });

  } catch (err) {
    logger.error(`[SmartScope] Resume error: ${err.message}`);
    return response.serverError(res, err.message);
  }
};
