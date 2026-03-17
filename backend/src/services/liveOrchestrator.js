/**
 * Live Session Pipeline Orchestrator
 *
 * Chains RELION jobs automatically for live processing sessions.
 * Listens to:
 *  - File watcher events (new movies detected)
 *  - SLURM monitor events (job completions)
 *  - Triggers next pipeline stage when previous completes
 *
 * Pipeline: Import -> MotionCorr -> CTF -> [QualityFilter] -> AutoPick -> Extract -> Class2D -> [AutoSelect] -> [InitialModel]
 *
 * RELION processes batches via STAR files. On each "pass":
 *  1. Re-run Import (picks up new movies from watch directory)
 *  2. Re-run MotionCorr (processes new micrographs)
 *  3. Continue through pipeline
 *  4. RELION's --pipeline_control skips already-processed data
 */

const EventEmitter = require('events');
const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const LiveSession = require('../models/LiveSession');
const Job = require('../models/Job');
const Project = require('../models/Project');
const { submitJobDirect } = require('./jobSubmission');
const { getProjectPath } = require('../utils/pathUtils');
const { JOB_STATUS } = require('../config/constants');
const { getLiveWatcher } = require('./liveWatcher');
const { mapKeys } = require('../utils/mapKeys');

// Import builders directly to avoid circular dependency with job registry
const ImportJobBuilder = require('./importBuilder');
const MotionCorrectionBuilder = require('./motionBuilder');
const CTFBuilder = require('./ctfBuilder');
const AutoPickBuilder = require('./autopickBuilder');
const ExtractBuilder = require('./extractBuilder');
const Class2DBuilder = require('./class2dBuilder');
const SubsetBuilder = require('./subsetBuilder');
const InitialModelBuilder = require('./initialModelBuilder');

/**
 * Format milliseconds into a human-readable duration string.
 */
function formatDuration(ms) {
  if (!ms || ms < 0) return '';
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainSec = seconds % 60;
  if (minutes < 60) return `${minutes}m ${remainSec}s`;
  const hours = Math.floor(minutes / 60);
  const remainMin = minutes % 60;
  return `${hours}h ${remainMin}m`;
}

// Pipeline stage order
const PIPELINE_STAGES = [
  { key: 'import', type: 'Import', jobField: 'import_id', builder: ImportJobBuilder },
  { key: 'motion', type: 'MotionCorr', jobField: 'motion_id', builder: MotionCorrectionBuilder },
  { key: 'ctf', type: 'CtfFind', jobField: 'ctf_id', builder: CTFBuilder },
  { key: 'pick', type: 'AutoPick', jobField: 'pick_id', builder: AutoPickBuilder },
  { key: 'extract', type: 'Extract', jobField: 'extract_id', builder: ExtractBuilder },
];

class LiveOrchestrator extends EventEmitter {
  constructor() {
    super();
    this.activeSessions = new Map();  // sessionId -> { running, stageRunning: {}, stagePending: {} }
    this._initialized = false;
  }

  /**
   * Initialize orchestrator - connect to SLURM monitor events
   */
  initialize() {
    if (this._initialized) return;

    // Connect to SLURM monitor for job completion events
    const { getMonitor } = require('./slurmMonitor');
    const monitor = getMonitor();
    monitor.on('statusChange', (data) => this._onJobStatusChange(data));

    // Connect to file watcher for new movie events
    const watcher = getLiveWatcher();
    watcher.on('newFiles', (data) => this._onNewFiles(data));
    watcher.on('noFiles', (data) => this._onNoFiles(data));
    watcher.on('error', (data) => this._onWatcherError(data));

    this._initialized = true;
    logger.info('[LiveOrchestrator] Initialized');
  }

  /**
   * Start a live session
   * Creates the initial pipeline jobs and starts the file watcher.
   * @param {string} sessionId
   */
  async startSession(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) throw new Error(`Session ${sessionId} not found`);

    const project = await Project.findOne({ id: session.project_id });
    if (!project) throw new Error(`Project ${session.project_id} not found`);

    logger.info(`[LiveOrchestrator] Starting session ${session.session_name} (${sessionId})`);

    // Create Movies/ directory for per-file symlinks to the watch directory.
    // We symlink individual files in batches (controlled by batch_size) so that
    // RELION Import only sees batch_size files at a time.
    const projectPath = getProjectPath(project);
    const moviesDir = path.join(projectPath, 'Movies');

    if (fs.existsSync(moviesDir)) {
      const stat = fs.lstatSync(moviesDir);
      if (stat.isSymbolicLink()) {
        // Old-style directory symlink from a previous session — replace with real dir
        fs.unlinkSync(moviesDir);
        fs.mkdirSync(moviesDir, { recursive: true });
        logger.info(`[LiveOrchestrator] Replaced directory symlink with per-file Movies/ dir`);
      }
      // else: already a real directory (from a previous run), keep it
    } else {
      fs.mkdirSync(moviesDir, { recursive: true });
      logger.info(`[LiveOrchestrator] Created Movies/ directory: ${moviesDir}`);
    }

    // Mark as running
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        status: 'running',
        start_time: new Date(),
        'state.current_stage': 'starting'
      }
    );

    const stageFlags = () => ({ import: false, motion: false, ctf: false, pick: false, extract: false, class2d: false, select: false, inimodel: false });
    this.activeSessions.set(sessionId, {
      running: true,
      stageRunning: stageFlags(),
      stagePending: stageFlags()
    });

    // Add activity
    await session.addActivity('session_started', `Live session "${session.session_name}" started`, {
      level: 'success',
      context: {
        inputMode: session.input_mode,
        watchDirectory: session.watch_directory,
        filePattern: session.file_pattern,
        pixelSize: session.optics?.pixel_size,
        enabledStages: this._getEnabledStageNames(session)
      }
    });

    // Start file watcher
    const watcher = getLiveWatcher();
    watcher.start(sessionId, session.watch_directory, session.file_pattern, session.input_mode);

    // Broadcast via WebSocket
    this._broadcast(session.project_id, sessionId, 'session_started', {
      sessionName: session.session_name
    }, 'success');
  }

  /**
   * Trigger a pipeline stage (streaming model).
   *
   * Replaces the old batch-pass model. Each stage runs independently:
   * - If already running, mark pending for re-trigger after completion
   * - If no new work available, skip
   * - Otherwise submit the stage to SLURM
   *
   * @param {string} sessionId
   * @param {string} stageKey - e.g., 'import', 'motion', 'ctf'
   */
  async _triggerStage(sessionId, stageKey) {
    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState || !sessionState.running) return;

    // If this stage is already running, queue for re-trigger
    if (sessionState.stageRunning[stageKey]) {
      sessionState.stagePending[stageKey] = true;
      logger.debug(`[LiveOrchestrator] Stage ${stageKey} already running, queued re-trigger | session: ${sessionId}`);
      return;
    }

    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || session.status !== 'running') return;

    // Check if stage is enabled
    if (!this._isStageEnabled(session, stageKey)) {
      // Skip to downstream stage
      const nextKey = this._getNextStageKey(stageKey);
      if (nextKey) await this._triggerStage(sessionId, nextKey);
      return;
    }

    // Check if there's actually work for this stage (upstream count > this stage's count)
    if (!this._hasWorkForStage(session, stageKey)) {
      logger.debug(`[LiveOrchestrator] No new work for stage ${stageKey}, skipping`);
      return;
    }

    // Submit the stage
    sessionState.stageRunning[stageKey] = true;
    try {
      await this._submitStage(sessionId, stageKey);
    } catch (err) {
      sessionState.stageRunning[stageKey] = false;
      logger.error(`[LiveOrchestrator] Stage ${stageKey} trigger failed: ${err.message}`);
      await this._handleStageError(sessionId, stageKey, err);
    }
  }

  /**
   * Check if a stage has new work to process based on upstream/downstream counts.
   * @param {Object} session - Lean session document
   * @param {string} stageKey
   * @returns {boolean}
   */
  _hasWorkForStage(session, stageKey) {
    const s = session.state || {};
    switch (stageKey) {
      case 'import':
        return (s.movies_found || 0) > (s.movies_imported || 0);
      case 'motion':
        return (s.movies_imported || 0) > (s.movies_motion || 0);
      case 'ctf':
        return (s.movies_motion || 0) > (s.movies_ctf || 0);
      case 'pick': {
        // Use filtered count when quality filter is active, otherwise use ctf count.
        // Without this, movies_ctf > movies_picked stays true forever when the filter
        // rejects micrographs (pick can never process the rejected ones → infinite loop).
        const pickUpstream = (s.movies_filtered != null && s.movies_filtered > 0)
          ? s.movies_filtered
          : (s.movies_ctf || 0);
        return pickUpstream > (s.movies_picked || 0);
      }
      case 'extract':
        return (s.movies_picked || 0) > (s.micrographs_extracted || 0);
      default:
        return false;
    }
  }

  /**
   * Get the next downstream pipeline stage key.
   * @param {string} currentKey
   * @returns {string|null}
   */
  _getNextStageKey(currentKey) {
    const idx = PIPELINE_STAGES.findIndex(s => s.key === currentKey);
    if (idx >= 0 && idx + 1 < PIPELINE_STAGES.length) {
      return PIPELINE_STAGES[idx + 1].key;
    }
    return null;
  }

  /**
   * Submit a pipeline stage job.
   *
   * CRITICAL: On subsequent pipeline passes we REUSE the same job record
   * (same job_name, same output directory) so that RELION's --pipeline_control
   * can detect previously-processed micrographs in the output directory and
   * skip them. Creating a fresh job/directory each pass would lose the
   * tracking data and cause RELION to reprocess everything.
   *
   * @param {string} sessionId
   * @param {string} stageKey - e.g., 'import', 'motion', 'ctf'
   */
  async _submitStage(sessionId, stageKey) {
    const sessionState = this.activeSessions.get(sessionId);
    const resetStage = () => { if (sessionState) sessionState.stageRunning[stageKey] = false; };

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session || session.status !== 'running') {
      resetStage();
      return;
    }

    const project = await Project.findOne({ id: session.project_id });
    if (!project) {
      resetStage();
      return;
    }

    const stage = PIPELINE_STAGES.find(s => s.key === stageKey);
    if (!stage) {
      resetStage();
      return;
    }

    const projectPath = getProjectPath(project);

    // Build job parameters for this stage
    const jobParams = await this._buildJobParams(session, stageKey, projectPath);

    // Create builder
    const BuilderClass = stage.builder;
    const builder = new BuilderClass(jobParams, project, { id: session.user_id });

    // Validate
    const { valid, error: validError } = builder.validate();
    if (!valid) {
      logger.warn(`[LiveOrchestrator] Stage ${stageKey} validation failed: ${validError}`);
      await session.addActivity('stage_skipped', `${stage.type} skipped: ${validError}`, {
        level: 'warning',
        stage: stage.type,
        context: { validationError: validError }
      });
      resetStage();
      return;
    }

    // ---- Check for existing job (re-run) vs first run ----
    const existingJobId = session.jobs?.[stage.jobField];
    let existingJob = null;
    if (existingJobId) {
      existingJob = await Job.findOne({ id: existingJobId }).lean();
    }

    let jobId, jobName, outputDir;
    const isRerun = !!existingJob;

    if (isRerun) {
      // RE-RUN: Reuse same job & output dir so --pipeline_control deduplicates
      jobId = existingJob.id;
      jobName = existingJob.job_name;
      outputDir = existingJob.output_file_path;

      // Guard: don't resubmit if previous run is still active in SLURM
      if ([JOB_STATUS.PENDING, JOB_STATUS.RUNNING].includes(existingJob.status)) {
        logger.warn(`[LiveOrchestrator] Stage ${stageKey} job ${jobName} still ${existingJob.status}, skipping`);
        resetStage();
        return;
      }

      // Ensure output directory still exists (could have been cleaned up)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logger.warn(`[LiveOrchestrator] Recreated missing output dir for re-run: ${outputDir}`);
      }

      // Remove RELION marker files so --pipeline_control re-runs the job
      // (RELION skips entirely if RELION_JOB_EXIT_SUCCESS exists)
      for (const marker of ['RELION_JOB_EXIT_SUCCESS', 'RELION_JOB_EXIT_FAILURE', 'RELION_JOB_EXIT_ABORTED']) {
        const markerPath = path.join(outputDir, marker);
        if (fs.existsSync(markerPath)) {
          fs.unlinkSync(markerPath);
        }
      }

      logger.info(`[LiveOrchestrator] Re-running ${stage.type} (${jobName}) | reusing output dir for --pipeline_control dedup`);
    } else {
      // FIRST RUN: Create new job
      jobId = Job.generateId();
      jobName = await Job.getNextJobName(session.project_id);
      outputDir = builder.getOutputDir(jobName);
    }

    // Build command using the (possibly reused) output directory
    const cmd = builder.buildCommand(outputDir, jobName);
    const commandStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;

    if (isRerun) {
      // Safety: cancel old SLURM job if it still has an ID
      // (e.g., ghost detection marked it failed but SLURM process may still be running)
      if (existingJob.slurm_job_id) {
        const { getMonitor } = require('./slurmMonitor');
        getMonitor().cancelJob(existingJob.slurm_job_id).catch(() => {});
      }

      // Update existing job record: reset status, refresh command
      await Job.findOneAndUpdate({ id: jobId }, {
        status: JOB_STATUS.PENDING,
        command: commandStr,
        parameters: jobParams,
        slurm_job_id: null  // Clear stale SLURM ID
      });
    } else {
      // Resolve input job IDs for the new record
      const inputJobNames = builder.getInputJobIds();
      let resolvedInputJobIds = [];
      if (inputJobNames.length > 0) {
        const inputJobs = await Job.find({
          project_id: session.project_id,
          job_name: { $in: inputJobNames }
        }).select('id job_name').lean();
        resolvedInputJobIds = inputJobs.map(j => j.id).filter(Boolean);
      }

      await Job.create({
        id: jobId,
        project_id: session.project_id,
        user_id: session.user_id,
        job_name: jobName,
        job_type: stage.type,
        status: JOB_STATUS.PENDING,
        input_job_ids: resolvedInputJobIds,
        output_file_path: outputDir,
        command: commandStr,
        execution_method: session.slurm_config?.execution_method || 'slurm',
        system_type: 'local',
        parameters: jobParams,
        pipeline_stats: {
          pixel_size: this._computePixelSize(session, stageKey),
          micrograph_count: 0,
          particle_count: 0,
          box_size: null,
          resolution: null,
          class_count: 0,
          iteration_count: 0
        }
      });

      // Store job ID in session (only on first creation)
      await LiveSession.findOneAndUpdate(
        { id: sessionId },
        { [`jobs.${stage.jobField}`]: jobId }
      );
    }

    // Update current stage
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { 'state.current_stage': stage.type }
    );

    const passLabel = isRerun ? '(re-run)' : '(new)';
    logger.info(`[LiveOrchestrator] Submitting ${stage.type} ${passLabel} (${jobName}) | session: ${session.session_name}`);

    // Determine execution method from session config
    const executionMethod = session.slurm_config?.execution_method || 'slurm';

    // Build SLURM params (only used for SLURM execution)
    const slurmParams = this._buildSlurmParams(session, stageKey, builder);

    // Submit job
    const result = await submitJobDirect({
      cmd,
      jobId,
      jobName,
      stageName: stage.type,
      projectId: session.project_id,
      projectPath,
      outputDir,
      executionMethod,
      slurmParams: executionMethod === 'slurm' ? slurmParams : {},
      postCommand: builder.postCommand
    });

    if (result.success) {
      const commandPreview = commandStr.length > 120
        ? commandStr.substring(0, 120) + '...'
        : commandStr;
      const methodLabel = executionMethod === 'slurm' ? `SLURM: ${result.slurm_job_id}` : 'local';

      await session.addActivity('stage_submitted',
        `${stage.type} ${jobName} submitted ${passLabel} (${methodLabel})`, {
        level: 'info',
        stage: stage.type,
        jobName: jobName,
        passNumber: session.state?.pass_count,
        context: {
          slurmJobId: result.slurm_job_id,
          isRerun: isRerun,
          commandPreview: commandPreview,
          slurmParams: {
            partition: slurmParams.queuename,
            mpiProcs: slurmParams.mpiProcs,
            threads: slurmParams.threads,
            gpus: slurmParams.gres
          }
        }
      });
      this._broadcast(session.project_id, sessionId, 'stage_submitted', {
        stage: stage.type, jobName: jobName, slurmJobId: result.slurm_job_id
      });
    } else {
      logger.error(`[LiveOrchestrator] ${stage.type} submission failed: ${result.error}`);
      await session.addActivity('error', `${stage.type} submission failed: ${result.error}`, {
        level: 'error',
        stage: stage.type,
        jobName: jobName,
        context: { errorMessage: result.error, isRerun: isRerun }
      });
      await this._handleStageError(sessionId, stageKey, new Error(result.error));
    }
  }

  /**
   * Handle SLURM job status change - trigger next pipeline stage
   * @param {Object} data - { jobId, projectId, oldStatus, newStatus }
   */
  async _onJobStatusChange(data) {
    const { jobId, projectId, newStatus } = data;

    // Only care about terminal states
    if (newStatus !== 'success' && newStatus !== 'failed') return;

    // Find if this job belongs to an active live session (running OR paused)
    // Paused sessions still need to process completed SLURM jobs
    const session = await LiveSession.findOne({
      project_id: projectId,
      status: { $in: ['running', 'paused'] },
      $or: [
        { 'jobs.import_id': jobId },
        { 'jobs.motion_id': jobId },
        { 'jobs.ctf_id': jobId },
        { 'jobs.pick_id': jobId },
        { 'jobs.extract_id': jobId },
        { 'jobs.class2d_ids': jobId },
        { 'jobs.select_ids': jobId },
        { 'jobs.inimodel_ids': jobId }
      ]
    }).lean();

    if (!session) return;

    const sessionId = session.id;
    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) return;

    // Determine which stage completed
    const stageKey = this._getStageKeyFromJobId(session, jobId);
    if (!stageKey) return;

    logger.info(`[LiveOrchestrator] Job ${job.job_name} (${stageKey}) completed with status: ${newStatus} | session: ${session.session_name}`);

    if (newStatus === 'success') {
      await this._handleStageSuccess(sessionId, stageKey, job);
    } else {
      await this._handleStageError(sessionId, stageKey, new Error(`Job ${job.job_name} failed`));
    }
  }

  /**
   * Handle successful stage completion - advance pipeline
   * @param {string} sessionId
   * @param {string} stageKey
   * @param {Object} job
   */
  async _handleStageSuccess(sessionId, stageKey, job) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    const sessionState = this.activeSessions.get(sessionId);

    // Update processing counters
    await this._updateCounters(sessionId, stageKey, job);

    const durationMs = (job.start_time && job.end_time)
      ? new Date(job.end_time).getTime() - new Date(job.start_time).getTime()
      : null;
    const durationStr = durationMs ? ` (${formatDuration(durationMs)})` : '';

    await session.addActivity('stage_complete',
      `${job.job_type} completed: ${job.job_name}${durationStr}`, {
      level: 'success',
      stage: job.job_type,
      jobName: job.job_name,
      context: {
        slurmJobId: job.slurm_job_id,
        durationMs: durationMs,
        micrographCount: job.pipeline_stats?.micrograph_count ?? job.micrograph_count ?? null,
        particleCount: job.pipeline_stats?.particle_count ?? job.particle_count ?? null
      }
    });
    this._broadcast(session.project_id, sessionId, 'stage_complete', {
      stage: job.job_type, jobName: job.job_name, state: session.state
    }, 'success');

    // Class2D, Select, InitialModel are not in PIPELINE_STAGES - handle separately
    if (stageKey === 'class2d') {
      logger.info(`[LiveOrchestrator] Class2D completed: ${job.job_name} | session: ${session.session_name}`);
      // Don't cascade if session is paused — record resume point
      if (session.status === 'paused') {
        logger.info(`[LiveOrchestrator] Session paused — not cascading after Class2D`);
        return;
      }
      // Cascade: Class2D → Auto Select (class ranker)
      if (session.auto_select_config?.enabled) {
        await this._submitAutoSelect(sessionId, job.id);
      } else if (session.input_mode === 'existing') {
        await this._checkExistingModeCompletion(sessionId);
      }
      return;
    }
    if (stageKey === 'select') {
      logger.info(`[LiveOrchestrator] AutoSelect completed: ${job.job_name} | session: ${session.session_name}`);
      if (session.status === 'paused') {
        logger.info(`[LiveOrchestrator] Session paused — not cascading after AutoSelect`);
        return;
      }
      // Cascade: Select → 3D Initial Model
      if (session.inimodel_config?.enabled) {
        await this._submitInitialModel(sessionId, job.id);
      } else if (session.input_mode === 'existing') {
        await this._checkExistingModeCompletion(sessionId);
      }
      return;
    }
    if (stageKey === 'inimodel') {
      logger.info(`[LiveOrchestrator] InitialModel completed: ${job.job_name} | session: ${session.session_name}`);
      if (session.input_mode === 'existing') {
        await this._checkExistingModeCompletion(sessionId);
      }
      return;
    }

    // Mark stage as no longer running
    if (sessionState) {
      sessionState.stageRunning[stageKey] = false;
    }

    // If session is paused, record where we left off but don't advance
    if (session.status === 'paused') {
      const nextKey = this._getNextStageKey(stageKey);
      await LiveSession.findOneAndUpdate(
        { id: sessionId },
        { 'state.current_stage': `paused_after_${stageKey}`, 'state.resume_from': nextKey || stageKey }
      );
      logger.info(`[LiveOrchestrator] Session paused - stage ${stageKey} done, will resume from ${nextKey || 'complete'}`);
      return;
    }

    // === Quality filter: run inline after CTF before triggering AutoPick ===
    if (stageKey === 'ctf') {
      try {
        await this._applyQualityFilter(sessionId);
      } catch (filterErr) {
        logger.warn(`[LiveOrchestrator] Quality filter failed (continuing): ${filterErr.message}`);
      }
    }

    // === CASCADE: Trigger downstream stage ===
    const nextKey = this._getNextStageKey(stageKey);
    if (nextKey) {
      await this._triggerStage(sessionId, nextKey);
    } else {
      // Last stage (extract) completed — check Class2D threshold
      if (session.class2d_config?.enabled) {
        await this._check2DClassification(sessionId);
      }
      // For 'existing' input mode, check if all processing is complete
      if (session.input_mode === 'existing') {
        await this._checkExistingModeCompletion(sessionId);
      }
    }

    // === RE-TRIGGER SELF if pending or more upstream work exists ===
    let shouldRetrigger = false;
    if (sessionState?.stagePending[stageKey]) {
      sessionState.stagePending[stageKey] = false;
      shouldRetrigger = true;
    }

    // Read fresh session to check for work (needed for both pending and poll paths)
    const freshSession = await LiveSession.findOne({ id: sessionId }).lean();

    if (!shouldRetrigger && freshSession && this._hasWorkForStage(freshSession, stageKey)) {
      shouldRetrigger = true;
    }

    // For import re-triggers: release the next batch of files into Movies/ first.
    // Only re-trigger if new files were actually released (prevents empty re-runs).
    if (shouldRetrigger && stageKey === 'import' && freshSession
        && freshSession.input_mode !== 'existing') {
      const batchSize = freshSession.batch_size || 25;
      const unprocessed = (freshSession.state?.movies_found || 0)
                        - (freshSession.state?.movies_imported || 0);
      if (unprocessed < batchSize) {
        logger.debug(`[LiveOrchestrator] Import re-trigger deferred (${unprocessed}/${batchSize} new movies)`);
        shouldRetrigger = false;
        // Future _onNewFiles calls will trigger when enough movies accumulate
      } else {
        // Release next batch of files into Movies/ before re-triggering
        const released = await this._releaseNextBatch(sessionId);
        if (released === 0) {
          logger.debug(`[LiveOrchestrator] Import re-trigger: no new files to release`);
          shouldRetrigger = false;
        }
      }
    }

    if (shouldRetrigger) {
      await this._triggerStage(sessionId, stageKey);
    }
  }

  /**
   * Check if an 'existing' mode session is fully complete.
   * Done when all stages are idle and all counts have caught up.
   * @param {string} sessionId
   */
  async _checkExistingModeCompletion(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || session.input_mode !== 'existing') return;

    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) return;

    // Check if any pipeline stage is still running
    const anyRunning = Object.values(sessionState.stageRunning).some(v => v);
    if (anyRunning) return;

    // Check if all stages have caught up to import count
    const s = session.state || {};
    const imported = s.movies_imported || 0;
    if (imported === 0) return;

    const allCaughtUp = (s.movies_motion || 0) >= imported
      && (s.movies_ctf || 0) >= imported
      && (s.movies_picked || 0) >= imported
      && (s.micrographs_extracted || 0) >= imported;

    if (!allCaughtUp) return;

    // Check for running/pending Class2D, Select, or InitialModel
    const downstreamIds = [
      ...(session.jobs?.class2d_ids || []),
      ...(session.jobs?.select_ids || []),
      ...(session.jobs?.inimodel_ids || [])
    ];
    if (downstreamIds.length > 0) {
      const runningDownstream = await Job.countDocuments({
        id: { $in: downstreamIds },
        status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] }
      });
      if (runningDownstream > 0) {
        logger.info(`[LiveOrchestrator] All stages done but downstream jobs still running, deferring completion`);
        return;
      }
    }

    await this._markSessionCompleted(sessionId, null);
  }

  /**
   * Handle new files detected by watcher.
   * In streaming mode, only triggers Import (not a full pipeline pass).
   * @param {Object} data - { sessionId, files, count }
   */
  async _onNewFiles(data) {
    const { sessionId, files, count } = data;

    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState || !sessionState.running) return;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session || session.status !== 'running') return;

    // Use atomic $max to prevent race conditions where concurrent _onNewFiles
    // calls could overwrite a higher count with a lower one
    const totalFound = getLiveWatcher().getFileCount(sessionId);
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { $max: { 'state.movies_found': totalFound } }
    );

    logger.info(`[LiveOrchestrator] ${count} new files detected (total: ${totalFound}) | session: ${session.session_name}`);
    await session.addActivity('new_files', `${count} new movie file(s) detected`, {
      level: 'info',
      context: {
        fileCount: count,
        totalFound: totalFound,
        sampleFiles: files.slice(0, 3).map(f => path.basename(f))
      }
    });

    this._broadcast(session.project_id, sessionId, 'new_files_detected', { count, total: totalFound });

    // Release the next batch of files into Movies/ via per-file symlinks.
    // For 'existing' mode: release ALL files at once (watcher fires once, no batching).
    // For 'watch' mode: release batch_size files; wait for more if not enough yet.
    if (session.input_mode === 'existing') {
      // Release everything — existing mode processes all files in one pass
      const released = await this._releaseNextBatch(sessionId, totalFound);
      if (released === 0 && totalFound > 0) {
        logger.debug(`[LiveOrchestrator] Existing mode: all files already released | session: ${session.session_name}`);
      }
    } else {
      // Watch mode: don't release files or trigger Import while it's already running.
      // The re-trigger mechanism after Import completes will release the next batch.
      // (Releasing mid-Import causes stranded files: Import already expanded its glob
      // and won't see the new symlinks, but _releaseNextBatch later returns 0.)
      if (sessionState.stageRunning?.import) {
        logger.debug(`[LiveOrchestrator] Import already running, deferring file release | session: ${session.session_name}`);
        return;
      }

      const batchSize = session.batch_size || 25;
      const imported = session.state?.movies_imported || 0;
      const unprocessed = totalFound - imported;
      if (batchSize > 0 && unprocessed < batchSize) {
        logger.debug(`[LiveOrchestrator] Waiting for batch (${unprocessed}/${batchSize} new movies) | session: ${session.session_name}`);
        return;
      }
      // Release exactly batch_size files into Movies/
      const released = await this._releaseNextBatch(sessionId);
      if (released === 0) {
        logger.debug(`[LiveOrchestrator] No new files to release | session: ${session.session_name}`);
        return;
      }
    }

    // Trigger Import stage (streaming: cascades to downstream stages on completion)
    await this._triggerStage(sessionId, 'import');
  }

  /**
   * Handle no files found in existing mode
   * @param {Object} data - { sessionId, directory }
   */
  async _onNoFiles(data) {
    const { sessionId, directory } = data;
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    logger.warn(`[LiveOrchestrator] No matching files in ${directory} | session: ${session.session_name}`);
    await session.addActivity('warning', `No matching files found in ${directory}`, {
      level: 'warning',
      context: { directory, filePattern: session.file_pattern }
    });

    // Mark as completed - nothing to process
    await this._markSessionCompleted(sessionId, session);
  }

  /**
   * Handle watcher filesystem error - log to session activity
   * @param {Object} data - { sessionId, error }
   */
  async _onWatcherError(data) {
    const { sessionId, error: errorMsg } = data;
    try {
      const session = await LiveSession.findOne({ id: sessionId });
      if (session) {
        await session.addActivity('watcher_error', `File watcher error: ${errorMsg}`, {
          level: 'error',
          stage: 'Watcher',
          context: { errorMessage: errorMsg }
        });
      }
    } catch (err) {
      logger.error(`[LiveOrchestrator] Failed to log watcher error: ${err.message}`);
    }
  }

  /**
   * Handle stage error - pause session and notify
   * @param {string} sessionId
   * @param {string} stageKey
   * @param {Error} error
   */
  async _handleStageError(sessionId, stageKey, error) {
    const sessionState = this.activeSessions.get(sessionId);
    if (sessionState) {
      sessionState.stageRunning[stageKey] = false;
      sessionState.stagePending[stageKey] = false;
    }

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    // ---- Deep error context gathering ----
    const stage = PIPELINE_STAGES.find(s => s.key === stageKey);
    const stageName = stage?.type || stageKey;
    const jobId = session.jobs?.[stage?.jobField];
    const errorContext = { errorMessage: error.message, stageKey };

    if (jobId) {
      const job = await Job.findOne({ id: jobId }).lean();
      if (job) {
        errorContext.jobName = job.job_name;
        errorContext.slurmJobId = job.slurm_job_id;
        errorContext.errorMessage = job.error_message || error.message;

        // Get SLURM details (exit code, state) - best effort
        if (job.slurm_job_id) {
          try {
            const { getMonitor } = require('./slurmMonitor');
            const details = await getMonitor().getJobDetails(job.slurm_job_id);
            if (details) {
              errorContext.slurmState = details.state;
              errorContext.exitCode = details.exitCode;
              errorContext.elapsed = details.elapsed;
            }
          } catch (e) { /* non-fatal */ }
        }

        // Read last 20 lines of stderr (run.err) - only read tail to avoid OOM on large logs
        if (job.output_file_path) {
          try {
            const errFile = path.join(job.output_file_path, 'run.err');
            if (fs.existsSync(errFile)) {
              const content = this._readFileTail(errFile, 8192); // Last 8KB
              const lines = content.trim().split('\n');
              errorContext.stderrPreview = lines.slice(-20).join('\n');
              errorContext.logFilePath = errFile;
            }
          } catch (e) { /* non-fatal */ }

          // Scan last portion of stdout for RELION error lines
          try {
            const outFile = path.join(job.output_file_path, 'run.out');
            if (fs.existsSync(outFile)) {
              const content = this._readFileTail(outFile, 32768); // Last 32KB
              const lines = content.trim().split('\n');
              const errorLines = lines.filter(l =>
                /error|ERROR|FATAL|Segmentation|killed|OOM/i.test(l)
              ).slice(-10);
              if (errorLines.length > 0) {
                errorContext.relionErrors = errorLines.join('\n');
              }
            }
          } catch (e) { /* non-fatal */ }
        }

        // Duration
        if (job.start_time) {
          errorContext.durationMs = (job.end_time ? new Date(job.end_time) : new Date()).getTime()
            - new Date(job.start_time).getTime();
        }
      }
    }

    // Build descriptive human-readable message
    const jobLabel = errorContext.jobName ? ` (${errorContext.jobName})` : '';
    const slurmLabel = errorContext.slurmJobId ? ` [SLURM: ${errorContext.slurmJobId}]` : '';
    const exitLabel = errorContext.exitCode && errorContext.exitCode !== '0:0' ? ` exit=${errorContext.exitCode}` : '';
    const stateLabel = errorContext.slurmState ? ` state=${errorContext.slurmState}` : '';
    const message = `${stageName}${jobLabel} failed${slurmLabel}${stateLabel}${exitLabel}: ${errorContext.errorMessage}`;

    logger.error(`[LiveOrchestrator] ${message} | session: ${session.session_name}`);

    // Pause the session on error (don't stop - user can fix and resume)
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        status: 'paused',
        'state.current_stage': `${stageKey}_error`,
        'state.resume_from': stageKey
      }
    );

    if (sessionState) {
      sessionState.running = false;
    }

    await session.addActivity('error', message, {
      level: 'error',
      stage: stageName,
      jobName: errorContext.jobName || null,
      passNumber: session.state?.pass_count,
      context: errorContext
    });

    this._broadcast(session.project_id, sessionId, 'session_error', {
      stage: stageKey, error: error.message, context: errorContext
    }, 'error');
  }

  /**
   * Pause a live session
   * @param {string} sessionId
   */
  async pauseSession(sessionId) {
    const sessionState = this.activeSessions.get(sessionId);
    if (sessionState) {
      sessionState.running = false;
    }

    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { status: 'paused' }
    );

    const session = await LiveSession.findOne({ id: sessionId });
    if (session) {
      await session.addActivity('session_paused', 'Session paused by user', {
        level: 'warning',
        context: { currentStage: session.state?.current_stage }
      });
      this._broadcast(session.project_id, sessionId, 'session_paused', {}, 'warning');
    }

    logger.info(`[LiveOrchestrator] Session ${sessionId} paused`);
  }

  /**
   * Resume a paused session
   * @param {string} sessionId
   */
  async resumeSession(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) throw new Error(`Session ${sessionId} not found`);

    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { status: 'running' }
    );

    const stageFlags = () => ({ import: false, motion: false, ctf: false, pick: false, extract: false, class2d: false, select: false, inimodel: false });
    let sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) {
      sessionState = { running: true, stageRunning: stageFlags(), stagePending: stageFlags() };
      this.activeSessions.set(sessionId, sessionState);
    } else {
      sessionState.running = true;
      sessionState.stageRunning = stageFlags();
      sessionState.stagePending = stageFlags();
    }

    // Restart watcher if not already running (only for watch mode)
    if (session.input_mode === 'watch') {
      const watcher = getLiveWatcher();
      if (!watcher.isWatching(sessionId)) {
        watcher.start(sessionId, session.watch_directory, session.file_pattern, session.input_mode);
      }

      // Sync movies_found from watcher — files may have arrived during pause
      // (watcher kept running but _onNewFiles returned early while paused)
      const currentFileCount = watcher.getFileCount(sessionId);
      if (currentFileCount > 0) {
        await LiveSession.findOneAndUpdate(
          { id: sessionId },
          { $max: { 'state.movies_found': currentFileCount } }
        );
      }
    }

    const resumeFrom = session.state?.resume_from;
    await session.addActivity('session_resumed', `Session resumed by user${resumeFrom ? ` (resuming from ${resumeFrom})` : ''}`, {
      level: 'info',
      context: {
        resumeFrom: resumeFrom || null,
        inputMode: session.input_mode,
        stateSnapshot: {
          moviesFound: session.state?.movies_found || 0,
          moviesMotion: session.state?.movies_motion || 0,
          moviesCTF: session.state?.movies_ctf || 0,
          passCount: session.state?.pass_count || 0
        }
      }
    });
    this._broadcast(session.project_id, sessionId, 'session_resumed', {}, 'info');

    // Clear resume_from marker
    if (resumeFrom) {
      await LiveSession.findOneAndUpdate(
        { id: sessionId },
        { 'state.resume_from': null }
      );
    }

    // Trigger all stages that have pending work (streaming: each stage runs independently)
    const freshSession = await LiveSession.findOne({ id: sessionId }).lean();
    if (freshSession) {
      for (const stage of PIPELINE_STAGES) {
        if (this._isStageEnabled(freshSession, stage.key) && this._hasWorkForStage(freshSession, stage.key)) {
          logger.info(`[LiveOrchestrator] Resume: triggering ${stage.key} (has pending work) | session: ${session.session_name}`);
          await this._triggerStage(sessionId, stage.key);
        }
      }
    }

    // Check for missed downstream cascades (e.g., Class2D completed but Select never triggered)
    await this._recoverDownstreamCascades(sessionId);

    logger.info(`[LiveOrchestrator] Session ${sessionId} resumed`);
  }

  /**
   * Stop a live session permanently
   * @param {string} sessionId
   */
  async stopSession(sessionId) {
    // Stop watcher
    const watcher = getLiveWatcher();
    await watcher.stop(sessionId);

    // Update state
    this.activeSessions.delete(sessionId);

    const session = await LiveSession.findOne({ id: sessionId });

    // Cancel any running SLURM jobs belonging to this session
    if (session) {
      const jobIds = [
        session.jobs.import_id, session.jobs.motion_id, session.jobs.ctf_id,
        session.jobs.pick_id, session.jobs.extract_id,
        ...(session.jobs.class2d_ids || []),
        ...(session.jobs.select_ids || []),
        ...(session.jobs.inimodel_ids || [])
      ].filter(Boolean);

      if (jobIds.length > 0) {
        const runningJobs = await Job.find({
          id: { $in: jobIds },
          status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] }
        }).lean();

        for (const job of runningJobs) {
          if (job.slurm_job_id) {
            try {
              const { getMonitor } = require('./slurmMonitor');
              await getMonitor().cancelJob(job.slurm_job_id);
              logger.info(`[LiveOrchestrator] Cancelled SLURM job ${job.slurm_job_id} (${job.job_name})`);
            } catch (err) {
              logger.warn(`[LiveOrchestrator] Failed to cancel SLURM job ${job.slurm_job_id}: ${err.message}`);
            }
          }
        }

        // Update Job records to 'cancelled' so they don't show as running/pending
        if (runningJobs.length > 0) {
          const runningJobIds = runningJobs.map(j => j.id);
          await Job.updateMany(
            { id: { $in: runningJobIds } },
            { status: JOB_STATUS.CANCELLED, end_time: new Date() }
          );
          logger.info(`[LiveOrchestrator] Marked ${runningJobs.length} jobs as cancelled`);
        }
      }
    }

    // Clean up symlink created during startSession
    if (session) {
      try {
        const project = await Project.findOne({ id: session.project_id });
        if (project) {
          const projectPath = getProjectPath(project);
          const symlinkPath = path.join(projectPath, 'Movies');
          if (fs.existsSync(symlinkPath) && fs.lstatSync(symlinkPath).isSymbolicLink()) {
            fs.unlinkSync(symlinkPath);
            logger.info(`[LiveOrchestrator] Cleaned up symlink: ${symlinkPath}`);
          }
        }
      } catch (err) {
        logger.warn(`[LiveOrchestrator] Failed to clean up symlink: ${err.message}`);
      }
    }

    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { status: 'stopped', end_time: new Date() }
    );

    if (session) {
      // Gather info about cancelled jobs for the log
      const cancelledJobs = [];
      const jobIds = [
        session.jobs?.import_id, session.jobs?.motion_id, session.jobs?.ctf_id,
        session.jobs?.pick_id, session.jobs?.extract_id,
        ...(session.jobs?.class2d_ids || []),
        ...(session.jobs?.select_ids || []),
        ...(session.jobs?.inimodel_ids || [])
      ].filter(Boolean);
      if (jobIds.length > 0) {
        const cancelledDocs = await Job.find({
          id: { $in: jobIds },
          status: JOB_STATUS.CANCELLED
        }).select('job_name slurm_job_id job_type').lean();
        cancelledDocs.forEach(j => cancelledJobs.push({
          jobName: j.job_name, slurmJobId: j.slurm_job_id, jobType: j.job_type
        }));
      }

      await session.addActivity('session_stopped', 'Session stopped by user', {
        level: 'warning',
        context: {
          cancelledJobs: cancelledJobs.length > 0 ? cancelledJobs : null,
          cancelledCount: cancelledJobs.length,
          stateSnapshot: {
            moviesFound: session.state?.movies_found || 0,
            moviesMotion: session.state?.movies_motion || 0,
            moviesCTF: session.state?.movies_ctf || 0,
            particlesExtracted: session.state?.particles_extracted || 0,
            passCount: session.state?.pass_count || 0
          }
        }
      });
      this._broadcast(session.project_id, sessionId, 'session_stopped', {}, 'warning');
    }

    logger.info(`[LiveOrchestrator] Session ${sessionId} stopped`);
  }

  /**
   * Resume sessions that were running before server restart.
   * Handles edge cases: stale busy flags, already-tracked sessions.
   */
  async resumeRunningSessions() {
    const runningSessions = await LiveSession.find({
      status: { $in: ['running'] }
    }).lean();

    if (runningSessions.length === 0) return;

    logger.info(`[LiveOrchestrator] Found ${runningSessions.length} sessions to resume after restart`);

    for (const session of runningSessions) {
      try {
        // Skip if already tracked (e.g., double-init)
        if (this.activeSessions.has(session.id)) {
          logger.warn(`[LiveOrchestrator] Session ${session.session_name} already active, skipping`);
          continue;
        }

        // Cancel any SLURM jobs that were running before restart
        // (they may be stale or orphaned)
        const jobIds = [
          session.jobs?.import_id, session.jobs?.motion_id, session.jobs?.ctf_id,
          session.jobs?.pick_id, session.jobs?.extract_id,
          ...(session.jobs?.class2d_ids || [])
        ].filter(Boolean);
        if (jobIds.length > 0) {
          const staleJobs = await Job.find({
            id: { $in: jobIds },
            status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] }
          }).lean();
          for (const job of staleJobs) {
            if (job.slurm_job_id) {
              try {
                const { getMonitor } = require('./slurmMonitor');
                await getMonitor().cancelJob(job.slurm_job_id);
              } catch (e) { /* best effort */ }
            }
            await Job.findOneAndUpdate({ id: job.id }, {
              status: JOB_STATUS.CANCELLED,
              end_time: new Date()
            });
          }
          if (staleJobs.length > 0) {
            logger.info(`[LiveOrchestrator] Cancelled ${staleJobs.length} stale jobs for session ${session.session_name}`);
          }
        }

        logger.info(`[LiveOrchestrator] Resuming session ${session.session_name} after restart`);
        await this.startSession(session.id);

        // Check for missed downstream cascades (e.g., Class2D completed but Select never triggered)
        await this._recoverDownstreamCascades(session.id);
      } catch (err) {
        logger.error(`[LiveOrchestrator] Failed to resume session ${session.session_name}: ${err.message}`);
        // Mark as paused so user can manually fix and resume
        await LiveSession.findOneAndUpdate(
          { id: session.id },
          { status: 'paused', 'state.resume_from': 'import' }
        );
      }
    }
  }

  // ============================================================================
  // PRIVATE HELPERS
  // ============================================================================

  /**
   * Check if a pipeline stage is enabled in session config
   */
  _isStageEnabled(session, stageKey) {
    switch (stageKey) {
      case 'import': return true; // Always enabled
      case 'motion': return session.motion_config?.enabled !== false;
      case 'ctf': return session.ctf_config?.enabled !== false;
      case 'pick': return session.picking_config?.enabled !== false;
      case 'extract': return session.extraction_config?.enabled !== false;
      case 'class2d': return !!session.class2d_config?.enabled;
      case 'select': return !!session.auto_select_config?.enabled;
      case 'inimodel': return !!session.inimodel_config?.enabled;
      default: return true;
    }
  }

  /**
   * Build job parameters for a pipeline stage from session config.
   * Parameter names must exactly match what each builder expects.
   * @returns {Promise<Object>} Job parameters
   */
  async _buildJobParams(session, stageKey, projectPath) {
    const optics = session.optics;
    const threads = session.slurm_config?.threads || 4;
    const mpiProcs = this._getMpiProcs(session, stageKey);

    // Common params for all stages - submitToQueue tells builders to use MPI command format
    const common = { projectId: session.project_id, submitToQueue: 'Yes' };

    switch (stageKey) {
      case 'import':
        return {
          ...common,
          // Use relative symlink path (RELION requires relative import paths)
          inputFiles: `Movies/${session.file_pattern}`,
          rawMovies: 'Yes',
          multiFrameMovies: 'Yes',
          angpix: optics.pixel_size,
          kV: optics.voltage,
          spherical: optics.cs,
          amplitudeContrast: optics.amplitude_contrast,
          opticsGroupName: optics.optics_group_name || 'opticsGroup1'
        };

      case 'motion': {
        const mc = session.motion_config;
        const importJobName = await this._getJobName(session, 'import_id');
        const useGpu = mc.use_gpu === true;
        const params = {
          ...common,
          inputMovies: importJobName ? `Import/${importJobName}/movies.star` : null,
          binningFactor: mc.bin_factor || 1,
          dosePerFrame: mc.dose_per_frame || 1.0,
          doseWeighting: 'Yes',
          patchesX: mc.patch_x || 5,
          patchesY: mc.patch_y || 5,
          firstFrame: 1,
          lastFrame: -1,
          bfactor: 150,
          float16Output: useGpu ? 'No' : 'Yes',       // float16 not supported by MotionCor2
          savePowerSpectra: useGpu ? 'No' : 'Yes',     // power spectra not supported by MotionCor2
          sumPowerSpectra: 4,
          threads,
          mpiProcs
        };
        if (useGpu) {
          params.useRelionImplementation = 'No';
          params.gpuToUse = mc.gpu_ids || '0';
        } else {
          params.useRelionImplementation = 'Yes';
        }
        return params;
      }

      case 'ctf': {
        const ctf = session.ctf_config;
        const motionJobName = await this._getJobName(session, 'motion_id');
        return {
          ...common,
          inputStarFile: motionJobName ? `MotionCorr/${motionJobName}/corrected_micrographs.star` : null,
          minDefocus: ctf.defocus_min || 5000,
          maxDefocus: ctf.defocus_max || 50000,
          defocusStepSize: ctf.defocus_step || 500,
          fftBoxSize: 512,
          usePowerSpectraFromMotionCorr: 'Yes',
          useExhaustiveSearch: 'No',
          threads,
          mpiProcs
        };
      }

      case 'pick': {
        const pick = session.picking_config;
        const ctfJobName = await this._getJobName(session, 'ctf_id');
        // Use quality-filtered STAR file if it exists, otherwise fall back to unfiltered
        let ctfStarFile = 'micrographs_ctf.star';
        if (ctfJobName) {
          const filteredPath = path.join(projectPath, `CtfFind/${ctfJobName}/micrographs_ctf_filtered.star`);
          if (fs.existsSync(filteredPath)) {
            ctfStarFile = 'micrographs_ctf_filtered.star';
          }
        }
        const isLoG = (pick.method || 'LoG') === 'LoG';
        return {
          ...common,
          inputMicrographs: ctfJobName ? `CtfFind/${ctfJobName}/${ctfStarFile}` : null,
          laplacianGaussian: isLoG ? 'Yes' : 'No',
          templateMatching: isLoG ? 'No' : 'Yes',
          useTopaz: 'No',
          minDiameter: pick.min_diameter || 100,
          maxDiameter: pick.max_diameter || 200,
          defaultThreshold: pick.threshold || 0.0,
          threads,
          mpiProcs
        };
      }

      case 'extract': {
        const ext = session.extraction_config;
        const ctfJobName = await this._getJobName(session, 'ctf_id');
        const pickJobName = await this._getJobName(session, 'pick_id');
        return {
          ...common,
          micrographStarFile: ctfJobName ? `CtfFind/${ctfJobName}/micrographs_ctf.star` : null,
          inputCoordinates: pickJobName ? `AutoPick/${pickJobName}/autopick.star` : null,
          particleBoxSize: ext.box_size || 256,
          rescaleParticles: ext.rescale ? 'Yes' : 'No',
          rescaledSize: ext.rescaled_size || 128,
          normalizeParticles: 'Yes',
          invertContrast: 'Yes',
          threads,
          mpiProcs
        };
      }

      default:
        return common;
    }
  }

  /**
   * Build SLURM parameters for a stage (GPU-aware)
   */
  _buildSlurmParams(session, stageKey, builder) {
    const cfg = session.slurm_config || {};

    // GPU allocation: ask the builder if it actually supports GPU
    // (MotionCorr with MotionCor2, Class2D with --gpu, template-matching AutoPick)
    const needsGpu = builder.supportsGpu;
    const gpuCount = needsGpu ? (cfg.gpu_count || 1) : 0;

    // MPI: use the same per-stage logic as _buildJobParams
    // so SLURM allocates enough tasks for the MPI processes
    const mpiProcs = builder.supportsMpi ? this._getMpiProcs({ slurm_config: cfg }, stageKey) : 1;

    return {
      queuename: cfg.queue || null,
      queueSubmitCommand: 'sbatch',
      mpiProcs,
      threads: cfg.threads || 4,
      gres: gpuCount
    };
  }

  /**
   * Get MPI process count for a pipeline stage.
   * For live processing, MPI parallelism is critical for throughput.
   *
   * Per-stage defaults when user sets mpi_procs=1 (auto):
   *  - import:  1  (single process, just creates STAR file)
   *  - motion:  4  (each MPI rank processes different movies)
   *  - ctf:     4  (each MPI rank processes different micrographs)
   *  - pick:    4  (each MPI rank picks on different micrographs)
   *  - extract: 4  (each MPI rank extracts from different micrographs)
   *  - class2d: 1 (RELION 5 VDAM/gradient does NOT support MPI)
   */
  _getMpiProcs(session, stageKey) {
    const userMpi = session.slurm_config?.mpi_procs || 1;

    // If user explicitly set MPI > 1, respect it for all stages
    if (userMpi > 1) return userMpi;

    // Auto MPI defaults for live processing stages
    // These stages process independent micrographs in parallel
    const autoMpiStages = { motion: 4, ctf: 4, pick: 4, extract: 4 };
    return autoMpiStages[stageKey] || 1;
  }

  /**
   * Compute the correct pixel_size for a given pipeline stage.
   * Accounts for binning (MotionCorr) and rescaling (Extract).
   *
   * Import:    raw pixel_size from optics
   * MotionCorr: pixel_size × bin_factor
   * CTF/Pick:  same as MotionCorr (inherits)
   * Extract:   if rescale, motionPixelSize × (box_size / rescaled_size)
   * Class2D+:  same as Extract
   */
  _computePixelSize(session, stageKey) {
    const rawPixelSize = session.optics?.pixel_size || 1.0;
    const binFactor = session.motion_config?.bin_factor || 1;
    const motionPixelSize = rawPixelSize * binFactor;

    switch (stageKey) {
      case 'import':
        return rawPixelSize;
      case 'motion':
        return motionPixelSize;
      case 'ctf':
      case 'pick':
        return motionPixelSize;
      case 'extract':
      case 'class2d': {
        const ext = session.extraction_config || {};
        if (ext.rescale && ext.rescaled_size && ext.box_size) {
          return motionPixelSize * (ext.box_size / ext.rescaled_size);
        }
        return motionPixelSize;
      }
      default:
        return motionPixelSize;
    }
  }

  /**
   * Get job name from session's stored job ID.
   * Looks up the Job document to get the job_name (e.g., "Job001").
   * @param {Object} session - Session document (lean or full)
   * @param {string} jobField - Field name in session.jobs (e.g., 'import_id')
   * @returns {Promise<string|null>} Job name or null
   */
  async _getJobName(session, jobField) {
    const jobId = session.jobs?.[jobField];
    if (!jobId) return null;

    const job = await Job.findOne({ id: jobId }).select('job_name').lean();
    return job?.job_name || null;
  }

  /**
   * Determine which stage key a job ID belongs to
   */
  _getStageKeyFromJobId(session, jobId) {
    if (session.jobs.import_id === jobId) return 'import';
    if (session.jobs.motion_id === jobId) return 'motion';
    if (session.jobs.ctf_id === jobId) return 'ctf';
    if (session.jobs.pick_id === jobId) return 'pick';
    if (session.jobs.extract_id === jobId) return 'extract';
    if (session.jobs.class2d_ids?.includes(jobId)) return 'class2d';
    if (session.jobs.select_ids?.includes(jobId)) return 'select';
    if (session.jobs.inimodel_ids?.includes(jobId)) return 'inimodel';
    return null;
  }

  /**
   * Update processing counters after stage completion
   */
  async _updateCounters(sessionId, stageKey, job) {
    const outputDir = job.output_file_path;

    // Map stage to its output STAR file and the session counter field
    const STAGE_STAR_MAP = {
      import:  { starFile: ['movies.star', 'micrographs.star'], field: 'state.movies_imported',    statsField: 'micrograph_count' },
      motion:  { starFile: ['corrected_micrographs.star'],      field: 'state.movies_motion',      statsField: 'micrograph_count' },
      ctf:     { starFile: ['micrographs_ctf.star'],            field: 'state.movies_ctf',         statsField: 'micrograph_count' },
      pick:    { starFile: ['autopick.star'],                   field: 'state.movies_picked',      statsField: 'micrograph_count' },
      extract: { starFile: ['particles.star'],                  field: 'state.particles_extracted', statsField: 'particle_count'   }
    };

    const mapping = STAGE_STAR_MAP[stageKey];
    if (!mapping || !outputDir) return;

    // Parse the actual RELION output STAR file to get the real count
    let count = 0;
    for (const starName of mapping.starFile) {
      const starPath = path.join(outputDir, starName);
      if (fs.existsSync(starPath)) {
        count = await this._countStarDataRows(starPath);
        if (count > 0) break;
      }
    }

    // Fallback to job.pipeline_stats if STAR file not found/empty
    if (count === 0) {
      const ps = job.pipeline_stats || {};
      count = ps[mapping.statsField] ?? 0;
    }

    if (count > 0) {
      // Update session counter
      const updateFields = { [mapping.field]: count };

      // For Extract: also track micrographs_extracted (= movies_picked) for re-trigger logic
      // particles_extracted is a particle count, but we need micrograph count to compare
      if (stageKey === 'extract') {
        const freshSession = await LiveSession.findOne({ id: sessionId }).lean();
        const pickedCount = freshSession?.state?.movies_picked || 0;
        if (pickedCount > 0) {
          updateFields['state.micrographs_extracted'] = pickedCount;
        }
      }

      await LiveSession.findOneAndUpdate({ id: sessionId }, updateFields);

      // Also update the Job's pipeline_stats so the dashboard stays in sync
      await Job.findOneAndUpdate(
        { id: job.id },
        { [`pipeline_stats.${mapping.statsField}`]: count }
      );

      logger.debug(`[LiveOrchestrator] Counter update: ${stageKey} = ${count} (from STAR file)`);
    }
  }

  /**
   * Count data rows in a RELION STAR file (largest block).
   * Lightweight — reads file and counts non-header lines.
   * @param {string} starPath
   * @returns {Promise<number>}
   */
  async _countStarDataRows(starPath) {
    try {
      const content = await fs.promises.readFile(starPath, 'utf-8');
      const lines = content.split('\n');

      let maxCount = 0;
      let blockCount = 0;
      let inLoop = false;
      let pastHeaders = false;

      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.startsWith('data_')) {
          if (blockCount > maxCount) maxCount = blockCount;
          blockCount = 0;
          inLoop = false;
          pastHeaders = false;
          continue;
        }
        if (trimmed.startsWith('loop_')) {
          inLoop = true;
          pastHeaders = false;
          continue;
        }
        if (inLoop && !pastHeaders && trimmed.startsWith('_')) continue;
        if (inLoop && trimmed && !trimmed.startsWith('#')) {
          pastHeaders = true;
          blockCount++;
        }
        if (inLoop && pastHeaders && !trimmed) {
          inLoop = false;
        }
      }

      if (blockCount > maxCount) maxCount = blockCount;
      return maxCount;
    } catch (err) {
      if (err.code !== 'ENOENT') {
        logger.warn(`[LiveOrchestrator] Failed to count STAR rows: ${starPath}: ${err.message}`);
      }
      return 0;
    }
  }

  /**
   * Check if 2D classification should be triggered
   */
  async _check2DClassification(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || !session.class2d_config?.enabled) return false;

    const threshold = session.class2d_config.particle_threshold || 5000;
    const particles = session.state.particles_extracted || 0;
    const class2dRuns = session.jobs?.class2d_ids?.length || 0;

    // Threshold-based: trigger at N, 2N, 3N, 4N...
    // e.g. threshold=50000 → 1st at 50K, 2nd at 100K, 3rd at 150K
    const nextThreshold = threshold * (class2dRuns + 1);

    if (particles >= nextThreshold) {
      logger.info(`[LiveOrchestrator] Triggering 2D classification | particles: ${particles} | threshold: ${nextThreshold} (run #${class2dRuns + 1}) | session: ${session.session_name}`);
      return await this._submit2DClassification(sessionId);
    }
    return false;
  }

  /**
   * Submit 2D classification batch job
   */
  async _submit2DClassification(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return false;

    const extractJob = session.jobs.extract_id
      ? await Job.findOne({ id: session.jobs.extract_id }).lean()
      : null;

    if (!extractJob) {
      logger.warn('[LiveOrchestrator] No extract job found for 2D classification');
      return false;
    }

    const cfg = session.class2d_config;
    const projectPath = getProjectPath(project);

    const gpuIds = session.motion_config?.gpu_ids || '0';
    const useVDAM = cfg.use_vdam !== false; // default true

    // VDAM (gradient) does NOT support MPI > 1; EM mode does
    const class2dMpi = useVDAM ? 1 : (session.slurm_config?.mpi_procs || 1);
    // VDAM uses many cheap iterations (default 200); EM uses fewer expensive ones (default 25)
    const defaultIter = useVDAM ? 200 : 25;

    const jobParams = {
      projectId: session.project_id,
      submitToQueue: 'Yes',
      inputStarFile: `Extract/${extractJob.job_name}/particles.star`,
      numberOfClasses: cfg.num_classes || 50,
      maskDiameter: cfg.particle_diameter || session.picking_config?.max_diameter || 200,
      numberEMIterations: cfg.iterations || defaultIter,
      useVDAM: useVDAM ? 'Yes' : 'No',
      vdamMiniBatches: cfg.vdam_mini_batches || 200,
      threads: session.slurm_config?.threads || 4,
      mpiProcs: class2dMpi,
      gpuAcceleration: 'Yes',
      gpuToUse: gpuIds
    };

    const builder = new Class2DBuilder(jobParams, project, { id: session.user_id });
    const { valid, error: validError } = builder.validate();
    if (!valid) {
      logger.warn(`[LiveOrchestrator] 2D validation failed: ${validError}`);
      return false;
    }

    const jobName = await Job.getNextJobName(session.project_id);
    const outputDir = builder.getOutputDir(jobName);
    const cmd = builder.buildCommand(outputDir, jobName);
    const jobId = Job.generateId();

    await Job.create({
      id: jobId,
      project_id: session.project_id,
      user_id: session.user_id,
      job_name: jobName,
      job_type: 'Class2D',
      status: JOB_STATUS.PENDING,
      input_job_ids: [session.jobs.extract_id],
      output_file_path: outputDir,
      command: Array.isArray(cmd) ? cmd.join(' ') : cmd,
      execution_method: session.slurm_config?.execution_method || 'slurm',
      system_type: 'local',
      parameters: jobParams,
      pipeline_stats: {
        pixel_size: this._computePixelSize(session, 'class2d'),
        micrograph_count: 0,
        particle_count: 0,
        box_size: null,
        resolution: null,
        class_count: 0,
        iteration_count: 0
      }
    });

    // Add to session's class2d jobs array, record trigger time, and update current stage
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        $push: { 'jobs.class2d_ids': jobId },
        'state.last_batch_2d': new Date(),
        'state.current_stage': 'Class2D'
      }
    );

    const slurmParams = {
      queuename: session.slurm_config?.queue || null,
      queueSubmitCommand: 'sbatch',
      mpiProcs: class2dMpi,
      threads: session.slurm_config?.threads || 4,
      gres: session.slurm_config?.gpu_count || 1  // Always request GPU for Class2D
    };

    const class2dExecMethod = session.slurm_config?.execution_method || 'slurm';
    await submitJobDirect({
      cmd, jobId, jobName,
      stageName: 'Class2D',
      projectId: session.project_id,
      projectPath,
      outputDir,
      executionMethod: class2dExecMethod,
      slurmParams: class2dExecMethod === 'slurm' ? slurmParams : {}
    });

    await session.addActivity('class2d_triggered', `2D Classification ${jobName} submitted (${session.state.particles_extracted} particles)`, {
      level: 'info',
      stage: 'Class2D',
      jobName: jobName,
      passNumber: session.state?.pass_count || null,
      context: {
        particleCount: session.state.particles_extracted,
        numClasses: session.class2d_config?.num_classes || 50,
        batchIntervalMs: session.class2d_config?.batch_interval_ms || 3600000
      }
    });
    this._broadcast(session.project_id, sessionId, 'class2d_triggered', {
      jobName: jobName, particles: session.state.particles_extracted
    }, 'info');

    return true;
  }

  /**
   * Release the next batch of movie files into the Movies/ directory.
   * Creates per-file symlinks from the watch directory into Movies/ so that
   * RELION Import only sees batch_size files at a time.
   * @param {string} sessionId
   * @returns {Promise<number>} Number of NEW files released (0 = nothing to release)
   */
  async _releaseNextBatch(sessionId, maxFiles) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session) return 0;

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return 0;

    const projectPath = getProjectPath(project);
    const moviesDir = path.join(projectPath, 'Movies');
    // If maxFiles is provided (existing mode), release up to that many; otherwise use batch_size
    const limit = maxFiles || session.batch_size || 25;

    // Get all files the watcher has found (sorted for deterministic order)
    const watcher = getLiveWatcher();
    const allFiles = watcher.getKnownFiles(sessionId);
    if (allFiles.length === 0) return 0;

    // Count files already symlinked into Movies/
    let existingCount = 0;
    const existingNames = new Set();
    try {
      const entries = fs.readdirSync(moviesDir);
      for (const entry of entries) {
        existingNames.add(entry);
        existingCount++;
      }
    } catch (e) { /* dir might not exist */ }

    // Calculate how many to release
    const toRelease = Math.min(limit, allFiles.length - existingCount);
    if (toRelease <= 0) return 0;

    // Symlink next batch of files
    let released = 0;
    for (const filePath of allFiles) {
      const basename = path.basename(filePath);
      if (existingNames.has(basename)) continue;

      const symlinkDest = path.join(moviesDir, basename);
      try {
        fs.symlinkSync(filePath, symlinkDest);
        released++;
        if (released >= toRelease) break;
      } catch (e) {
        if (e.code !== 'EEXIST') {
          logger.warn(`[LiveOrchestrator] Failed to symlink ${basename}: ${e.message}`);
        }
      }
    }

    if (released > 0) {
      logger.info(`[LiveOrchestrator] Released ${released} files into Movies/ (total: ${existingCount + released}/${allFiles.length}) | session: ${session.session_name}`);
    }
    return released;
  }

  /**
   * Apply quality filtering after CTF estimation.
   * Reads micrographs_ctf.star, filters out micrographs with bad CTF resolution
   * or excessive motion, writes micrographs_ctf_filtered.star.
   * This is inline Node.js processing, NOT a RELION job.
   */
  async _applyQualityFilter(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    const thresholds = session.thresholds || {};
    const maxRes = thresholds.ctf_resolution_max;
    const maxMotion = thresholds.total_motion_max;

    // Skip if no thresholds configured
    if (!maxRes && !maxMotion) {
      logger.debug('[LiveOrchestrator] No quality thresholds set, skipping filter');
      return;
    }

    const ctfJobName = await this._getJobName(session, 'ctf_id');
    if (!ctfJobName) return;

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return;

    const projectPath = getProjectPath(project);
    const ctfStarPath = path.join(projectPath, `CtfFind/${ctfJobName}/micrographs_ctf.star`);
    const filteredPath = path.join(projectPath, `CtfFind/${ctfJobName}/micrographs_ctf_filtered.star`);

    if (!fs.existsSync(ctfStarPath)) {
      logger.warn(`[LiveOrchestrator] CTF STAR file not found: ${ctfStarPath}`);
      return;
    }

    // Read and filter the STAR file preserving RELION 5 multi-block format.
    // RELION 5 STAR files contain multiple data blocks (e.g., data_optics + data_micrographs).
    // We copy all blocks verbatim and only filter data rows in the micrographs block.
    const content = await fs.promises.readFile(ctfStarPath, 'utf-8');
    const lines = content.split('\n');

    const outputLines = [];
    let currentBlock = '';
    let inLoop = false;
    let pastColumnDefs = false;
    let resIdx = -1;
    let motIdx = -1;
    let nameIdx = -1;
    let totalMicrographs = 0;
    let filteredCount = 0;
    const rejectedNames = [];

    for (const line of lines) {
      const trimmed = line.trim();

      // Detect new data block — reset per-block state
      if (trimmed.startsWith('data_')) {
        currentBlock = trimmed;
        inLoop = false;
        pastColumnDefs = false;
        resIdx = -1;
        motIdx = -1;
        outputLines.push(line);
        continue;
      }

      // Detect loop_
      if (trimmed === 'loop_') {
        inLoop = true;
        pastColumnDefs = false;
        outputLines.push(line);
        continue;
      }

      // Column definitions (e.g., _rlnCtfMaxResolution #5)
      if (inLoop && !pastColumnDefs && trimmed.startsWith('_')) {
        const parts = trimmed.split(/\s+/);
        const colIdxMatch = parts[1]?.match(/#(\d+)/);
        if (colIdxMatch) {
          const idx = parseInt(colIdxMatch[1], 10) - 1;
          if (parts[0] === '_rlnCtfMaxResolution') resIdx = idx;
          if (parts[0] === '_rlnAccumMotionTotal') motIdx = idx;
          if (parts[0] === '_rlnMicrographName') nameIdx = idx;
        }
        outputLines.push(line);
        continue;
      }

      // Data rows — only filter in the micrographs block
      if (inLoop && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('_') && !trimmed.startsWith('data_')) {
        pastColumnDefs = true;

        const isMicrographsBlock = currentBlock === 'data_micrographs';
        if (isMicrographsBlock) {
          totalMicrographs++;
          const values = trimmed.split(/\s+/);
          let pass = true;
          const reasons = [];
          if (maxRes && resIdx >= 0 && resIdx < values.length) {
            const resVal = parseFloat(values[resIdx]);
            if (!isNaN(resVal) && resVal > maxRes) {
              pass = false;
              reasons.push(`CTF ${resVal.toFixed(1)}Å > ${maxRes}Å`);
            }
          }
          if (maxMotion && motIdx >= 0 && motIdx < values.length) {
            const motVal = parseFloat(values[motIdx]);
            if (!isNaN(motVal) && motVal > maxMotion) {
              pass = false;
              reasons.push(`motion ${motVal.toFixed(1)}Å > ${maxMotion}Å`);
            }
          }
          if (pass) {
            filteredCount++;
            outputLines.push(line);
          } else {
            const name = (nameIdx >= 0 && nameIdx < values.length)
              ? path.basename(values[nameIdx])
              : `row${totalMicrographs}`;
            rejectedNames.push(`${name} (${reasons.join(', ')})`);
          }
        } else {
          // Non-micrographs block (e.g., optics) — pass through unchanged
          outputLines.push(line);
        }
        continue;
      }

      // Everything else (comments, # version, blank lines) — pass through
      outputLines.push(line);
    }

    await fs.promises.writeFile(filteredPath, outputLines.join('\n'));

    const rejected = totalMicrographs - filteredCount;
    const filtered = filteredCount;

    await LiveSession.findOneAndUpdate({ id: sessionId }, {
      'state.movies_filtered': filtered,
      'state.movies_rejected': rejected,
    });

    // Log rejected micrographs (cap at 20 to avoid huge activity entries)
    const rejectedSample = rejectedNames.slice(0, 20);
    const rejectedContext = {
      total: totalMicrographs,
      passed: filtered,
      rejected,
      thresholds: { ctf_resolution_max: maxRes, total_motion_max: maxMotion },
      rejectedMicrographs: rejectedSample,
    };

    if (filtered === 0 && totalMicrographs > 0) {
      await session.addActivity('quality_filter', `Quality filter rejected ALL ${totalMicrographs} micrographs — downstream stages will have no input. Consider relaxing thresholds.`, {
        level: 'error',
        stage: 'QualityFilter',
        context: rejectedContext
      });
      logger.warn(`[LiveOrchestrator] Quality filter rejected ALL ${totalMicrographs} micrographs | session: ${session.session_name}`);
    } else if (rejected > 0) {
      await session.addActivity('quality_filter', `Quality filter: ${filtered}/${totalMicrographs} micrographs passed (${rejected} rejected)`, {
        level: rejected > totalMicrographs * 0.5 ? 'warning' : 'info',
        stage: 'QualityFilter',
        context: rejectedContext
      });
    }

    logger.info(`[LiveOrchestrator] Quality filter: ${filtered}/${totalMicrographs} passed | session: ${session.session_name}`);
  }

  /**
   * Submit auto 2D class selection (relion_class_ranker) after Class2D completes.
   * @param {string} sessionId
   * @param {string} class2dJobId - The Class2D job that just completed
   */
  async _submitAutoSelect(sessionId, class2dJobId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    const cfg = session.auto_select_config || {};
    if (!cfg.enabled) return;

    const class2dJob = await Job.findOne({ id: class2dJobId }).lean();
    if (!class2dJob) {
      logger.warn('[LiveOrchestrator] Class2D job not found for auto-select');
      return;
    }

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return;

    const projectPath = getProjectPath(project);

    // Find latest _optimiser.star in Class2D output (relion_class_ranker needs this).
    // output_file_path is absolute; use directly for fs access, relative for RELION command.
    const class2dOutputDir = class2dJob.output_file_path;
    const class2dRelDir = path.relative(projectPath, class2dOutputDir);
    let optimiserFile = null;
    try {
      const files = fs.readdirSync(class2dOutputDir)
        .filter(f => f.endsWith('_optimiser.star'))
        .sort();
      if (files.length > 0) {
        optimiserFile = `${class2dRelDir}/${files[files.length - 1]}`;
      }
    } catch (e) {
      logger.warn(`[LiveOrchestrator] Failed to scan for optimiser files: ${e.message}`);
    }

    if (!optimiserFile) {
      logger.warn('[LiveOrchestrator] No optimiser.star found in Class2D output, skipping auto-select');
      return;
    }

    const jobParams = {
      projectId: session.project_id,
      classFromJob: optimiserFile,
      select2DClass: true,
      minThresholdAutoSelect: cfg.min_score || 0.5,
      manyParticles: cfg.min_particles ?? 3000,
      manyClasses: cfg.min_classes || -1
    };

    const builder = new SubsetBuilder(jobParams, project, { id: session.user_id });
    const { valid, error: validError } = builder.validate();
    if (!valid) {
      logger.warn(`[LiveOrchestrator] Auto-select validation failed: ${validError}`);
      return;
    }

    const jobName = await Job.getNextJobName(session.project_id);
    const outputDir = builder.getOutputDir(jobName);
    const cmd = builder.buildCommand(outputDir, jobName);
    const jobId = Job.generateId();
    const executionMethod = session.slurm_config?.execution_method || 'slurm';

    await Job.create({
      id: jobId,
      project_id: session.project_id,
      user_id: session.user_id,
      job_name: jobName,
      job_type: 'Subset',
      status: JOB_STATUS.PENDING,
      input_job_ids: [class2dJobId],
      output_file_path: outputDir,
      command: Array.isArray(cmd) ? cmd.join(' ') : cmd,
      execution_method: executionMethod,
      system_type: 'local',
      parameters: jobParams,
      pipeline_stats: {
        pixel_size: this._computePixelSize(session, 'class2d'),
        micrograph_count: 0,
        particle_count: 0,
        box_size: null,
        resolution: null,
        class_count: 0,
        iteration_count: 0
      }
    });

    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        $push: { 'jobs.select_ids': jobId },
        'state.current_stage': 'Select'
      }
    );

    const slurmParams = this._buildSlurmParams(session, 'select', builder);
    // Force CPU-only PyTorch for class_ranker — avoids segfault on unsupported GPU architectures
    slurmParams.envVars = { CUDA_VISIBLE_DEVICES: '""', SINGULARITYENV_CUDA_VISIBLE_DEVICES: '""' };
    await submitJobDirect({
      cmd, jobId, jobName,
      stageName: 'Select',
      projectId: session.project_id,
      projectPath,
      outputDir,
      executionMethod,
      slurmParams: executionMethod === 'slurm' ? slurmParams : {}
    });

    await session.addActivity('auto_select_triggered',
      `Auto 2D class selection ${jobName} submitted (class ranker min_score: ${cfg.min_score || 0.5})`, {
      level: 'info',
      stage: 'Select',
      jobName: jobName,
      context: {
        class2dJob: class2dJob.job_name,
        minScore: cfg.min_score || 0.5,
        optimiserFile
      }
    });
    this._broadcast(session.project_id, sessionId, 'auto_select_triggered', {
      jobName, class2dJob: class2dJob.job_name
    }, 'info');

    logger.info(`[LiveOrchestrator] Auto-select ${jobName} submitted | session: ${session.session_name}`);
  }

  /**
   * Submit 3D initial model (relion_refine --grad --denovo_3dref) after auto-select.
   * @param {string} sessionId
   * @param {string} selectJobId - The Select job that just completed
   */
  async _submitInitialModel(sessionId, selectJobId) {
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    const cfg = session.inimodel_config || {};
    if (!cfg.enabled) return;

    const selectJob = await Job.findOne({ id: selectJobId }).lean();
    if (!selectJob) {
      logger.warn('[LiveOrchestrator] Select job not found for initial model');
      return;
    }

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return;

    const projectPath = getProjectPath(project);

    // Check that selected particles exist.
    // output_file_path is absolute; use directly for fs access, relative for RELION command.
    const selectOutputDir = selectJob.output_file_path;
    const selectRelDir = path.relative(projectPath, selectOutputDir);
    const particlesPath = path.join(selectOutputDir, 'particles.star');
    if (!fs.existsSync(particlesPath)) {
      logger.warn(`[LiveOrchestrator] No particles.star from auto-select, skipping initial model`);
      return;
    }

    // Count selected particles
    const particleCount = await this._countStarDataRows(particlesPath);
    if (particleCount === 0) {
      logger.warn('[LiveOrchestrator] Auto-select produced 0 particles, skipping initial model');
      await session.addActivity('inimodel_skipped', 'Initial model skipped: no particles from auto-select', {
        level: 'warning',
        stage: 'InitialModel'
      });
      return;
    }

    const maskDiameter = cfg.mask_diameter || session.picking_config?.max_diameter || 200;
    const jobParams = {
      projectId: session.project_id,
      inputStarFile: `${selectRelDir}/particles.star`,
      numberOfClasses: cfg.num_classes || 1,
      symmetry: cfg.symmetry || 'C1',
      maskDiameter,
      numberOfVdam: cfg.iterations || 200,
      gpuAcceleration: cfg.use_gpu ? 'Yes' : 'No',
      gpuToUse: cfg.gpu_ids || '0',
      threads: session.slurm_config?.threads || 4,
    };

    const builder = new InitialModelBuilder(jobParams, project, { id: session.user_id });
    const { valid, error: validError } = builder.validate();
    if (!valid) {
      logger.warn(`[LiveOrchestrator] InitialModel validation failed: ${validError}`);
      return;
    }

    const jobName = await Job.getNextJobName(session.project_id);
    const outputDir = builder.getOutputDir(jobName);
    const cmd = builder.buildCommand(outputDir, jobName);
    const jobId = Job.generateId();
    const executionMethod = session.slurm_config?.execution_method || 'slurm';

    await Job.create({
      id: jobId,
      project_id: session.project_id,
      user_id: session.user_id,
      job_name: jobName,
      job_type: 'InitialModel',
      status: JOB_STATUS.PENDING,
      input_job_ids: [selectJobId],
      output_file_path: outputDir,
      command: Array.isArray(cmd) ? cmd.join(' ') : cmd,
      execution_method: executionMethod,
      system_type: 'local',
      parameters: jobParams,
      pipeline_stats: {
        pixel_size: this._computePixelSize(session, 'class2d'),
        micrograph_count: 0,
        particle_count: particleCount,
        box_size: null,
        resolution: null,
        class_count: cfg.num_classes || 1,
        iteration_count: 0
      }
    });

    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        $push: { 'jobs.inimodel_ids': jobId },
        'state.current_stage': 'InitialModel',
        'state.particles_selected': particleCount
      }
    );

    const slurmParams = this._buildSlurmParams(session, 'inimodel', builder);
    await submitJobDirect({
      cmd, jobId, jobName,
      stageName: 'InitialModel',
      projectId: session.project_id,
      projectPath,
      outputDir,
      executionMethod,
      slurmParams: executionMethod === 'slurm' ? slurmParams : {}
    });

    await session.addActivity('inimodel_triggered',
      `3D Initial Model ${jobName} submitted (${particleCount} particles, sym: ${cfg.symmetry || 'C1'})`, {
      level: 'info',
      stage: 'InitialModel',
      jobName: jobName,
      context: {
        particleCount,
        numClasses: cfg.num_classes || 1,
        symmetry: cfg.symmetry || 'C1',
        maskDiameter,
        selectJob: selectJob.job_name
      }
    });
    this._broadcast(session.project_id, sessionId, 'inimodel_triggered', {
      jobName, particles: particleCount
    }, 'info');

    logger.info(`[LiveOrchestrator] InitialModel ${jobName} submitted | session: ${session.session_name}`);
  }

  /**
   * Mark a session as completed and clean up
   */
  async _markSessionCompleted(sessionId, session) {
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { status: 'completed', end_time: new Date() }
    );

    const freshSession = session || await LiveSession.findOne({ id: sessionId });
    if (freshSession) {
      const durationMs = freshSession.start_time
        ? new Date().getTime() - new Date(freshSession.start_time).getTime()
        : null;
      await freshSession.addActivity('session_completed', `All processing completed${durationMs ? ` in ${formatDuration(durationMs)}` : ''}`, {
        level: 'success',
        context: {
          totalPasses: freshSession.state?.pass_count || 0,
          moviesProcessed: freshSession.state?.movies_imported || freshSession.state?.movies_found || 0,
          moviesMotion: freshSession.state?.movies_motion || 0,
          moviesCTF: freshSession.state?.movies_ctf || 0,
          particlesExtracted: freshSession.state?.particles_extracted || 0,
          moviesRejected: freshSession.state?.movies_rejected || 0,
          durationMs: durationMs
        }
      });
    }

    this.activeSessions.delete(sessionId);

    // Stop watcher
    const watcher = getLiveWatcher();
    await watcher.stop(sessionId);

    logger.info(`[LiveOrchestrator] Session completed | session: ${freshSession?.session_name || sessionId}`);
  }

  /**
   * Broadcast live session update via WebSocket
   */
  _broadcast(projectId, sessionId, event, data, level = 'info') {
    try {
      const { getWebSocketServer } = require('./websocket');
      const wsServer = getWebSocketServer();
      wsServer.broadcast(`project:${projectId}`, {
        type: 'live_session_update',
        sessionId: sessionId,
        event,
        level,
        data: mapKeys(data),
        timestamp: new Date().toISOString()
      });
    } catch (err) {
      // WebSocket broadcast failure is non-fatal
      logger.debug(`[LiveOrchestrator] WebSocket broadcast failed: ${err.message}`);
    }
  }

  /**
   * Read only the last N bytes of a file to avoid OOM on large log files.
   * @param {string} filePath
   * @param {number} maxBytes - Maximum bytes to read from end of file
   * @returns {string}
   */
  _readFileTail(filePath, maxBytes = 8192) {
    const stat = fs.statSync(filePath);
    if (stat.size <= maxBytes) {
      return fs.readFileSync(filePath, 'utf8');
    }
    // Read only the tail
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(maxBytes);
    fs.readSync(fd, buffer, 0, maxBytes, stat.size - maxBytes);
    fs.closeSync(fd);
    // Skip partial first line (we likely landed mid-line)
    const text = buffer.toString('utf8');
    const firstNewline = text.indexOf('\n');
    return firstNewline >= 0 ? text.slice(firstNewline + 1) : text;
  }

  /**
   * Get enabled stage names for a session (for logging context)
   */
  _getEnabledStageNames(session) {
    return PIPELINE_STAGES
      .filter(s => this._isStageEnabled(session, s.key))
      .map(s => s.type);
  }

  /**
   * Graceful shutdown
   */
  async shutdown() {
    const watcher = getLiveWatcher();
    await watcher.stopAll();
    this.activeSessions.clear();
    logger.info('[LiveOrchestrator] Shut down');
  }

  /**
   * Handle config updates mid-run.
   * Called by the controller after updating the DB. Checks if any newly-enabled
   * stages (Class2D, AutoSelect, InitialModel) should trigger immediately because
   * their upstream data already exists.
   * @param {string} sessionId
   * @param {string[]} changedKeys - camelCase keys that were updated
   */
  /**
   * Recover missed downstream cascades after server restart.
   * Checks if Class2D completed but Select was never triggered,
   * or Select completed but InitialModel was never triggered.
   */
  async _recoverDownstreamCascades(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || session.status !== 'running') return;

    // Class2D completed but Select never triggered?
    if (session.auto_select_config?.enabled) {
      const class2dIds = session.jobs?.class2d_ids || [];
      const selectIds = session.jobs?.select_ids || [];
      if (class2dIds.length > 0 && selectIds.length === 0) {
        const latestId = class2dIds[class2dIds.length - 1];
        const latestJob = await Job.findOne({ id: latestId }).lean();
        if (latestJob?.status === JOB_STATUS.SUCCESS) {
          logger.info(`[LiveOrchestrator] Recovery: Class2D ${latestJob.job_name} completed but Select never triggered — submitting now | session: ${session.session_name}`);
          await this._submitAutoSelect(sessionId, latestId);
        }
      }
    }

    // Select completed but InitialModel never triggered?
    if (session.inimodel_config?.enabled) {
      const selectIds = session.jobs?.select_ids || [];
      const inimodelIds = session.jobs?.inimodel_ids || [];
      if (selectIds.length > 0 && inimodelIds.length === 0) {
        const latestId = selectIds[selectIds.length - 1];
        const latestJob = await Job.findOne({ id: latestId }).lean();
        if (latestJob?.status === JOB_STATUS.SUCCESS) {
          logger.info(`[LiveOrchestrator] Recovery: Select ${latestJob.job_name} completed but InitialModel never triggered — submitting now | session: ${session.session_name}`);
          await this._submitInitialModel(sessionId, latestId);
        }
      }
    }
  }

  async onConfigUpdated(sessionId, changedKeys) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || session.status !== 'running') return;

    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState || !sessionState.running) return;

    logger.info(`[LiveOrchestrator] Config updated mid-run: ${changedKeys.join(', ')} | session: ${session.session_name}`);

    // Class2D just enabled → check if particles already exceed threshold
    if (changedKeys.includes('class2dConfig') && session.class2d_config?.enabled) {
      const triggered = await this._check2DClassification(sessionId);
      if (triggered) {
        logger.info(`[LiveOrchestrator] Class2D triggered after mid-run enable | session: ${session.session_name}`);
      }
    }

    // AutoSelect just enabled → check if any Class2D jobs already completed
    if (changedKeys.includes('autoSelectConfig') && session.auto_select_config?.enabled) {
      const class2dIds = session.jobs?.class2d_ids || [];
      if (class2dIds.length > 0) {
        const latestId = class2dIds[class2dIds.length - 1];
        const latestJob = await Job.findOne({ id: latestId }).lean();
        if (latestJob?.status === JOB_STATUS.SUCCESS) {
          await this._submitAutoSelect(sessionId, latestId);
          logger.info(`[LiveOrchestrator] AutoSelect triggered after mid-run enable | session: ${session.session_name}`);
        }
      }
    }

    // InitialModel just enabled → check if any Select jobs already completed
    if (changedKeys.includes('inimodelConfig') && session.inimodel_config?.enabled) {
      const selectIds = session.jobs?.select_ids || [];
      if (selectIds.length > 0) {
        const latestId = selectIds[selectIds.length - 1];
        const latestJob = await Job.findOne({ id: latestId }).lean();
        if (latestJob?.status === JOB_STATUS.SUCCESS) {
          await this._submitInitialModel(sessionId, latestId);
          logger.info(`[LiveOrchestrator] InitialModel triggered after mid-run enable | session: ${session.session_name}`);
        }
      }
    }
  }
}

// Singleton
let instance = null;

const getLiveOrchestrator = () => {
  if (!instance) {
    instance = new LiveOrchestrator();
  }
  return instance;
};

module.exports = { LiveOrchestrator, getLiveOrchestrator };
