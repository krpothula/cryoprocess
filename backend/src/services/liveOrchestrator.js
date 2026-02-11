/**
 * Live Session Pipeline Orchestrator
 *
 * Chains RELION jobs automatically for live processing sessions.
 * Listens to:
 *  - File watcher events (new movies detected)
 *  - SLURM monitor events (job completions)
 *  - Triggers next pipeline stage when previous completes
 *
 * Pipeline: Import -> MotionCorr -> CTF -> AutoPick -> Extract -> Class2D
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

// Import builders directly to avoid circular dependency with job registry
const ImportJobBuilder = require('./importBuilder');
const MotionCorrectionBuilder = require('./motionBuilder');
const CTFBuilder = require('./ctfBuilder');
const AutoPickBuilder = require('./autopickBuilder');
const ExtractBuilder = require('./extractBuilder');
const Class2DBuilder = require('./class2dBuilder');

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
    this.activeSessions = new Map();  // sessionId -> { running: bool, pendingRerun: bool }
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

    // Create symlink from project directory to watch directory
    // RELION requires import paths to be relative to the project directory
    const projectPath = getProjectPath(project);
    const symlinkName = 'movies_data';
    const symlinkPath = path.join(projectPath, symlinkName);

    if (!fs.existsSync(symlinkPath)) {
      try {
        fs.symlinkSync(session.watch_directory, symlinkPath, 'dir');
        logger.info(`[LiveOrchestrator] Created symlink: ${symlinkPath} -> ${session.watch_directory}`);
      } catch (err) {
        logger.error(`[LiveOrchestrator] Failed to create symlink: ${err.message}`);
        throw new Error(`Cannot create symlink to watch directory: ${err.message}`);
      }
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

    this.activeSessions.set(sessionId, { running: true, pendingRerun: false, busy: false });

    // Add activity
    await session.addActivity('session_started', `Live session "${session.session_name}" started`, {
      level: 'success',
      context: {
        input_mode: session.input_mode,
        watch_directory: session.watch_directory,
        file_pattern: session.file_pattern,
        pixel_size: session.optics?.pixel_size,
        enabled_stages: this._getEnabledStageNames(session)
      }
    });

    // Start file watcher
    const watcher = getLiveWatcher();
    watcher.start(sessionId, session.watch_directory, session.file_pattern, session.input_mode);

    // Broadcast via WebSocket
    this._broadcast(session.project_id, sessionId, 'session_started', {
      session_name: session.session_name
    }, 'success');
  }

  /**
   * Run a full pipeline pass
   * Called when new files are detected or when session starts.
   * @param {string} sessionId
   */
  async _runPipelinePass(sessionId) {
    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState || !sessionState.running) return;

    // Prevent concurrent pipeline passes
    if (sessionState.busy) {
      sessionState.pendingRerun = true;
      logger.info(`[LiveOrchestrator] Session ${sessionId} busy, queuing re-run`);
      return;
    }

    sessionState.busy = true;
    sessionState.pendingRerun = false;

    try {
      const session = await LiveSession.findOne({ id: sessionId });
      if (!session || session.status !== 'running') {
        sessionState.busy = false;
        return;
      }

      const project = await Project.findOne({ id: session.project_id });
      if (!project) {
        sessionState.busy = false;
        return;
      }

      const passNum = (session.state.pass_count || 0) + 1;
      const moviesAtStart = session.state?.movies_found || 0;
      logger.info(`[LiveOrchestrator] Pipeline pass #${passNum} | movies_at_start: ${moviesAtStart} | session: ${session.session_name}`);

      await LiveSession.findOneAndUpdate(
        { id: sessionId },
        {
          'state.pass_count': passNum,
          'state.last_pipeline_pass': new Date(),
          'state.movies_at_pass_start': moviesAtStart
        }
      );

      await session.addActivity('pipeline_pass', `Pipeline pass #${passNum} started`, {
        level: 'info',
        pass_number: passNum,
        context: {
          pass_number: passNum,
          stages_to_run: this._getEnabledStageNames(session),
          movies_found: session.state?.movies_found || 0
        }
      });

      // Start with Import
      try {
        await this._submitStage(sessionId, 'import');
      } catch (err) {
        logger.error(`[LiveOrchestrator] Pipeline pass failed at Import: ${err.message}`);
        await session.addActivity('error', `Import failed: ${err.message}`, {
          level: 'error',
          stage: 'Import',
          pass_number: passNum,
          context: { error_message: err.message }
        });
        await this._handleStageError(sessionId, 'import', err);
      }
    } catch (unexpectedErr) {
      // CRITICAL: Always reset busy flag on unexpected errors to prevent deadlock
      logger.error(`[LiveOrchestrator] Unexpected error in pipeline pass: ${unexpectedErr.message}`);
      sessionState.busy = false;
    }
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
    const session = await LiveSession.findOne({ id: sessionId });
    if (!session || session.status !== 'running') return;

    const project = await Project.findOne({ id: session.project_id });
    if (!project) return;

    const stage = PIPELINE_STAGES.find(s => s.key === stageKey);
    if (!stage) return;

    // Check if this stage is enabled
    if (!this._isStageEnabled(session, stageKey)) {
      logger.info(`[LiveOrchestrator] Stage ${stageKey} disabled, skipping to next`);
      await this._advanceToNextStage(sessionId, stageKey);
      return;
    }

    const projectPath = getProjectPath(project);

    // Build job parameters for this stage
    const jobParams = await this._buildJobParams(session, stageKey);

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
        context: { validation_error: validError }
      });
      this._releaseBusy(sessionId);
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
        this._releaseBusy(sessionId);
        return;
      }

      // Ensure output directory still exists (could have been cleaned up)
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
        logger.warn(`[LiveOrchestrator] Recreated missing output dir for re-run: ${outputDir}`);
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
        execution_mode: 'slurm',
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

    // Build SLURM params
    const slurmParams = this._buildSlurmParams(session, stageKey, builder);

    // Submit to SLURM
    const result = await submitJobDirect({
      cmd,
      jobId,
      jobName,
      stageName: stage.type,
      projectPath,
      outputDir,
      executionMode: 'slurm',
      slurmParams,
      postCommand: builder.postCommand
    });

    if (result.success) {
      const commandPreview = commandStr.length > 120
        ? commandStr.substring(0, 120) + '...'
        : commandStr;

      await session.addActivity('stage_submitted',
        `${stage.type} ${jobName} submitted ${passLabel} (SLURM: ${result.slurm_job_id})`, {
        level: 'info',
        stage: stage.type,
        job_name: jobName,
        pass_number: session.state?.pass_count,
        context: {
          slurm_job_id: result.slurm_job_id,
          is_rerun: isRerun,
          command_preview: commandPreview,
          slurm_params: {
            partition: slurmParams.queuename,
            mpi_procs: slurmParams.runningmpi,
            threads: slurmParams.threads,
            gpus: slurmParams.gres
          }
        }
      });
      this._broadcast(session.project_id, sessionId, 'stage_submitted', {
        stage: stage.type, job_name: jobName, slurm_job_id: result.slurm_job_id
      });
    } else {
      logger.error(`[LiveOrchestrator] ${stage.type} submission failed: ${result.error}`);
      await session.addActivity('error', `${stage.type} submission failed: ${result.error}`, {
        level: 'error',
        stage: stage.type,
        job_name: jobName,
        context: { error_message: result.error, is_rerun: isRerun }
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
        { 'jobs.class2d_ids': jobId }
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
      job_name: job.job_name,
      pass_number: session.state?.pass_count,
      context: {
        slurm_job_id: job.slurm_job_id,
        duration_ms: durationMs,
        micrograph_count: job.pipeline_stats?.micrograph_count || job.micrograph_count || null,
        particle_count: job.pipeline_stats?.particle_count || job.particle_count || null
      }
    });
    this._broadcast(session.project_id, sessionId, 'stage_complete', {
      stage: job.job_type, job_name: job.job_name, state: session.state
    }, 'success');

    // Class2D is not in PIPELINE_STAGES - handle its completion separately
    if (stageKey === 'class2d') {
      logger.info(`[LiveOrchestrator] Class2D completed: ${job.job_name} | session: ${session.session_name}`);
      if (session.input_mode === 'existing') {
        // Don't mark completed if the main pipeline is still running
        const sessionState = this.activeSessions.get(sessionId);
        if (sessionState?.busy) {
          logger.info(`[LiveOrchestrator] Class2D done but pipeline still busy, deferring completion`);
          return;
        }
        // Check if any other Class2D jobs are still running
        const otherClass2dIds = (session.jobs?.class2d_ids || []).filter(id => id !== job.id);
        if (otherClass2dIds.length > 0) {
          const runningClass2d = await Job.countDocuments({
            id: { $in: otherClass2dIds },
            status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] }
          });
          if (runningClass2d > 0) {
            logger.info(`[LiveOrchestrator] Class2D done but ${runningClass2d} other Class2D jobs still running`);
            return;
          }
        }
        await this._markSessionCompleted(sessionId, session);
      }
      return;
    }

    // If session is paused, record where we left off but don't advance
    if (session.status === 'paused') {
      const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === stageKey);
      const nextStage = stageIdx + 1 < PIPELINE_STAGES.length ? PIPELINE_STAGES[stageIdx + 1].key : null;
      await LiveSession.findOneAndUpdate(
        { id: sessionId },
        { 'state.current_stage': `paused_after_${stageKey}`, 'state.resume_from': nextStage }
      );
      logger.info(`[LiveOrchestrator] Session paused - stage ${stageKey} done, will resume from ${nextStage || 'complete'}`);
      const sessionState = this.activeSessions.get(sessionId);
      if (sessionState) sessionState.busy = false;
      return;
    }

    // Advance to next stage
    await this._advanceToNextStage(sessionId, stageKey);
  }

  /**
   * Advance to the next pipeline stage
   * @param {string} sessionId
   * @param {string} completedStageKey
   */
  async _advanceToNextStage(sessionId, completedStageKey) {
    const stageIdx = PIPELINE_STAGES.findIndex(s => s.key === completedStageKey);
    const nextIdx = stageIdx + 1;

    if (nextIdx < PIPELINE_STAGES.length) {
      // Submit next stage
      const nextStage = PIPELINE_STAGES[nextIdx];
      try {
        await this._submitStage(sessionId, nextStage.key);
      } catch (err) {
        logger.error(`[LiveOrchestrator] ${nextStage.type} failed: ${err.message}`);
        const session = await LiveSession.findOne({ id: sessionId });
        if (session) {
          await session.addActivity('error', `${nextStage.type} failed: ${err.message}`, {
            level: 'error',
            stage: nextStage.type,
            context: { error_message: err.message }
          });
        }
        await this._handleStageError(sessionId, nextStage.key, err);
      }
    } else {
      // Pipeline pass complete
      await this._onPipelinePassComplete(sessionId);
    }
  }

  /**
   * Called when a full pipeline pass completes
   * @param {string} sessionId
   */
  async _onPipelinePassComplete(sessionId) {
    const sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) return;

    sessionState.busy = false;

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    logger.info(`[LiveOrchestrator] Pipeline pass complete | session: ${session.session_name}`);
    await session.addActivity('pipeline_complete', `Pipeline pass #${session.state?.pass_count || '?'} completed`, {
      level: 'success',
      pass_number: session.state?.pass_count,
      context: {
        pass_number: session.state?.pass_count,
        state_snapshot: {
          movies_found: session.state?.movies_found,
          movies_imported: session.state?.movies_imported,
          movies_motion: session.state?.movies_motion,
          movies_ctf: session.state?.movies_ctf,
          movies_picked: session.state?.movies_picked,
          particles_extracted: session.state?.particles_extracted
        }
      }
    });

    // Record pass snapshot for per-pass display
    const passSnapshot = {
      pass_number: session.state?.pass_count || 1,
      completed_at: new Date(),
      movies_imported: session.state?.movies_imported || 0,
      movies_motion: session.state?.movies_motion || 0,
      movies_ctf: session.state?.movies_ctf || 0,
      movies_picked: session.state?.movies_picked || 0,
      particles_extracted: session.state?.particles_extracted || 0,
      class2d_count: session.jobs?.class2d_ids?.length || 0,
    };
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      { $push: { pass_history: passSnapshot } }
    );

    this._broadcast(session.project_id, sessionId, 'pipeline_complete', {
      state: session.state
    }, 'success');

    // Check if 2D classification should be triggered
    let class2dSubmitted = false;
    if (session.class2d_config.enabled) {
      class2dSubmitted = await this._check2DClassification(sessionId);
    }

    // Fetch fresh session state for all subsequent checks
    const freshSession = await LiveSession.findOne({ id: sessionId }).lean();
    const found = freshSession?.state?.movies_found || 0;
    const imported = freshSession?.state?.movies_imported || 0;
    const motionDone = freshSession?.state?.movies_motion || 0;

    // Check for pending rerun (new files arrived during this pass)
    // Only re-run if there are actually MORE files than what was imported
    // (prevents wasted passes when watcher batches the same files into 2 events)
    if (sessionState.pendingRerun && sessionState.running) {
      sessionState.pendingRerun = false;
      if (found > imported) {
        logger.info(`[LiveOrchestrator] Pending rerun: ${found - imported} new files to process (found=${found}, imported=${imported})`);
        await this._runPipelinePass(sessionId);
        return;
      }
      logger.info(`[LiveOrchestrator] Pending rerun skipped: no new files (found=${found}, imported=${imported})`);
    }

    // Check for count mismatch: Import processed more movies than downstream stages
    // This happens when RELION only partially processes the input in one pass
    // (e.g., Import has 219 movies but MotionCorr only processed 41)
    if (imported > 0 && motionDone < imported && sessionState.running) {
      logger.info(`[LiveOrchestrator] Count mismatch: imported=${imported} motion=${motionDone} - triggering re-run`);
      await session.addActivity('pipeline_rerun', `Re-running pipeline: ${imported - motionDone} movies still need processing`, {
        level: 'info',
        context: { movies_imported: imported, movies_motion: motionDone, gap: imported - motionDone }
      });
      await this._runPipelinePass(sessionId);
      return;
    }

    // For 'existing' input mode, mark as completed when all stages have caught up
    // But wait for Class2D to finish if one was just submitted or is still running
    if (session.input_mode === 'existing' && !class2dSubmitted) {
      const class2dIds = freshSession?.jobs?.class2d_ids || [];
      let hasRunningClass2d = false;
      if (class2dIds.length > 0) {
        const runningCount = await Job.countDocuments({
          id: { $in: class2dIds },
          status: { $in: [JOB_STATUS.PENDING, JOB_STATUS.RUNNING] }
        });
        hasRunningClass2d = runningCount > 0;
      }
      if (!hasRunningClass2d) {
        await this._markSessionCompleted(sessionId, session);
      } else {
        logger.info(`[LiveOrchestrator] Pipeline done but Class2D still running, deferring completion`);
      }
    }
  }

  /**
   * Handle new files detected by watcher
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
        file_count: count,
        total_found: totalFound,
        sample_files: files.slice(0, 3).map(f => path.basename(f))
      }
    });

    this._broadcast(session.project_id, sessionId, 'new_files_detected', { count, total: totalFound });

    // Trigger pipeline pass
    await this._runPipelinePass(sessionId);
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
      context: { directory, file_pattern: session.file_pattern }
    });

    // Mark as completed - nothing to process
    await this._markSessionCompleted(sessionId, session);
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
      sessionState.busy = false;
    }

    const session = await LiveSession.findOne({ id: sessionId });
    if (!session) return;

    // ---- Deep error context gathering ----
    const stage = PIPELINE_STAGES.find(s => s.key === stageKey);
    const stageName = stage?.type || stageKey;
    const jobId = session.jobs?.[stage?.jobField];
    const errorContext = { error_message: error.message, stage_key: stageKey };

    if (jobId) {
      const job = await Job.findOne({ id: jobId }).lean();
      if (job) {
        errorContext.job_name = job.job_name;
        errorContext.slurm_job_id = job.slurm_job_id;
        errorContext.error_message = job.error_message || error.message;

        // Get SLURM details (exit code, state) - best effort
        if (job.slurm_job_id) {
          try {
            const { getMonitor } = require('./slurmMonitor');
            const details = await getMonitor().getJobDetails(job.slurm_job_id);
            if (details) {
              errorContext.slurm_state = details.state;
              errorContext.exit_code = details.exitCode;
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
              errorContext.stderr_preview = lines.slice(-20).join('\n');
              errorContext.log_file_path = errFile;
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
                errorContext.relion_errors = errorLines.join('\n');
              }
            }
          } catch (e) { /* non-fatal */ }
        }

        // Duration
        if (job.start_time) {
          errorContext.duration_ms = (job.end_time ? new Date(job.end_time) : new Date()).getTime()
            - new Date(job.start_time).getTime();
        }
      }
    }

    // Build descriptive human-readable message
    const jobLabel = errorContext.job_name ? ` (${errorContext.job_name})` : '';
    const slurmLabel = errorContext.slurm_job_id ? ` [SLURM: ${errorContext.slurm_job_id}]` : '';
    const exitLabel = errorContext.exit_code && errorContext.exit_code !== '0:0' ? ` exit=${errorContext.exit_code}` : '';
    const stateLabel = errorContext.slurm_state ? ` state=${errorContext.slurm_state}` : '';
    const message = `${stageName}${jobLabel} failed${slurmLabel}${stateLabel}${exitLabel}: ${errorContext.error_message}`;

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
      job_name: errorContext.job_name || null,
      pass_number: session.state?.pass_count,
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
        context: { current_stage: session.state?.current_stage }
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

    let sessionState = this.activeSessions.get(sessionId);
    if (!sessionState) {
      sessionState = { running: true, pendingRerun: false, busy: false };
      this.activeSessions.set(sessionId, sessionState);
    } else {
      sessionState.running = true;
      sessionState.busy = false;
    }

    // Restart watcher if not already running (only for watch mode)
    if (session.input_mode === 'watch') {
      const watcher = getLiveWatcher();
      if (!watcher.isWatching(sessionId)) {
        watcher.start(sessionId, session.watch_directory, session.file_pattern, session.input_mode);
      }
    }

    const resumeFrom = session.state?.resume_from;
    await session.addActivity('session_resumed', `Session resumed by user${resumeFrom ? ` (resuming from ${resumeFrom})` : ''}`, {
      level: 'info',
      context: {
        resume_from: resumeFrom || null,
        input_mode: session.input_mode,
        state_snapshot: {
          movies_found: session.state?.movies_found || 0,
          movies_motion: session.state?.movies_motion || 0,
          movies_ctf: session.state?.movies_ctf || 0,
          pass_count: session.state?.pass_count || 0
        }
      }
    });
    this._broadcast(session.project_id, sessionId, 'session_resumed', {}, 'info');

    // Check if there's a specific stage to resume from (set when paused mid-pipeline)
    if (resumeFrom) {
      logger.info(`[LiveOrchestrator] Resuming from stage: ${resumeFrom} | session: ${session.session_name}`);
      try {
        await this._submitStage(sessionId, resumeFrom);
        // Clear resume_from AFTER successful submission to avoid losing the
        // resume point if the server crashes between clear and submit
        await LiveSession.findOneAndUpdate(
          { id: sessionId },
          { 'state.resume_from': null }
        );
      } catch (err) {
        logger.error(`[LiveOrchestrator] Resume stage ${resumeFrom} failed: ${err.message}`);
        await this._handleStageError(sessionId, resumeFrom, err);
      }
    } else {
      // No specific resume point - run a fresh pipeline pass
      await this._runPipelinePass(sessionId);
    }

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
        ...(session.jobs.class2d_ids || [])
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
          const symlinkPath = path.join(projectPath, 'movies_data');
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
        ...(session.jobs?.class2d_ids || [])
      ].filter(Boolean);
      if (jobIds.length > 0) {
        const cancelledDocs = await Job.find({
          id: { $in: jobIds },
          status: JOB_STATUS.CANCELLED
        }).select('job_name slurm_job_id job_type').lean();
        cancelledDocs.forEach(j => cancelledJobs.push({
          job_name: j.job_name, slurm_job_id: j.slurm_job_id, job_type: j.job_type
        }));
      }

      await session.addActivity('session_stopped', 'Session stopped by user', {
        level: 'warning',
        context: {
          cancelled_jobs: cancelledJobs.length > 0 ? cancelledJobs : null,
          cancelled_count: cancelledJobs.length,
          state_snapshot: {
            movies_found: session.state?.movies_found || 0,
            movies_motion: session.state?.movies_motion || 0,
            movies_ctf: session.state?.movies_ctf || 0,
            particles_extracted: session.state?.particles_extracted || 0,
            pass_count: session.state?.pass_count || 0
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
      default: return true;
    }
  }

  /**
   * Build job parameters for a pipeline stage from session config.
   * Parameter names must exactly match what each builder expects.
   * @returns {Promise<Object>} Job parameters
   */
  async _buildJobParams(session, stageKey) {
    const optics = session.optics;
    const threads = session.slurm_config?.threads || 4;
    const mpiProcs = this._getMpiProcs(session, stageKey);

    // Common params for all stages - submitToQueue tells builders to use MPI command format
    const common = { project_id: session.project_id, submitToQueue: 'Yes' };

    switch (stageKey) {
      case 'import':
        return {
          ...common,
          // Use relative symlink path (RELION requires relative import paths)
          input_files: `movies_data/${session.file_pattern}`,
          multiframemovies: true,
          angpix: optics.pixel_size,
          kV: optics.voltage,
          Cs: optics.cs,
          Q0: optics.amplitude_contrast,
          optics_group_name: optics.optics_group_name || 'opticsGroup1'
        };

      case 'motion': {
        const mc = session.motion_config;
        const importJobName = await this._getJobName(session, 'import_id');
        // GPU mode: use MotionCor2 if use_gpu is set, otherwise RELION's own (CPU)
        const useGpu = mc.use_gpu === true;
        const params = {
          ...common,
          inputMovies: importJobName ? `Import/${importJobName}/movies.star` : null,
          binningFactor: mc.bin_factor || 1,
          dosePerFrame: mc.dose_per_frame || 1.0,
          patchesX: mc.patch_x || 5,
          patchesY: mc.patch_y || 5,
          threads,
          numberOfMpiProcs: mpiProcs
        };
        if (useGpu) {
          // MotionCor2 mode with GPU
          params.useRelionImplementation = false;
          params.useGPU = mc.gpu_ids || '0';
        } else {
          // RELION's own CPU-based implementation
          params.useRelionImplementation = 'Yes';
        }
        return params;
      }

      case 'ctf': {
        const ctf = session.ctf_config;
        const motionJobName = await this._getJobName(session, 'motion_id');
        return {
          ...common,
          // ctfBuilder uses getInputStarFile() which checks: inputStarFile, input_star_file
          inputStarFile: motionJobName ? `MotionCorr/${motionJobName}/corrected_micrographs.star` : null,
          defocusMin: ctf.defocus_min || 5000,
          defocusMax: ctf.defocus_max || 50000,
          defocusStep: ctf.defocus_step || 500,
          threads,
          numberOfMpiProcs: mpiProcs
        };
      }

      case 'pick': {
        const pick = session.picking_config;
        const ctfJobName = await this._getJobName(session, 'ctf_id');
        const isLoG = (pick.method || 'LoG') === 'LoG';
        return {
          ...common,
          // autopickBuilder.validate() checks: inputMicrographs, input_star_file, inputStarFile
          inputMicrographs: ctfJobName ? `CtfFind/${ctfJobName}/micrographs_ctf.star` : null,
          // LoG picking: builder checks getBoolParam('laplacianGaussian')
          laplacianGaussian: isLoG,
          templateMatching: !isLoG,
          // LoG parameters: builder uses minDiameter, maxDiameter, defaultThreshold
          minDiameter: pick.min_diameter || 100,
          maxDiameter: pick.max_diameter || 200,
          defaultThreshold: pick.threshold || 0.0,
          threads,
          numberOfMpiProcs: mpiProcs
        };
      }

      case 'extract': {
        const ext = session.extraction_config;
        const ctfJobName = await this._getJobName(session, 'ctf_id');
        const pickJobName = await this._getJobName(session, 'pick_id');
        return {
          ...common,
          // extractBuilder.validate() checks: micrograph_star_file, micrographStarFile
          micrographStarFile: ctfJobName ? `CtfFind/${ctfJobName}/micrographs_ctf.star` : null,
          // extractBuilder checks: inputCoordinates, coords_star_file, coordsStarFile
          inputCoordinates: pickJobName ? `AutoPick/${pickJobName}/autopick.star` : null,
          particleBoxSize: ext.box_size || 256,
          rescaleParticles: ext.rescale || false,
          rescaledSize: ext.rescaled_size || 128,
          normalizeParticles: true,
          invertContrast: true,
          threads,
          numberOfMpiProcs: mpiProcs
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
      runningmpi: mpiProcs,
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
    return null;
  }

  /**
   * Update processing counters after stage completion
   */
  async _updateCounters(sessionId, stageKey, job) {
    const update = {};

    const ps = job.pipeline_stats || {};
    switch (stageKey) {
      case 'import':
        // Track import count separately - movies_found is owned by the watcher
        update['state.movies_imported'] = ps.micrograph_count || job.micrograph_count || 0;
        break;
      case 'motion':
        update['state.movies_motion'] = ps.micrograph_count || job.micrograph_count || 0;
        break;
      case 'ctf':
        update['state.movies_ctf'] = ps.micrograph_count || job.micrograph_count || 0;
        break;
      case 'pick':
        update['state.movies_picked'] = ps.micrograph_count || job.micrograph_count || 0;
        break;
      case 'extract':
        update['state.particles_extracted'] = ps.particle_count || job.particle_count || 0;
        break;
    }

    if (Object.keys(update).length > 0) {
      await LiveSession.findOneAndUpdate({ id: sessionId }, update);
    }
  }

  /**
   * Check if 2D classification should be triggered
   */
  async _check2DClassification(sessionId) {
    const session = await LiveSession.findOne({ id: sessionId }).lean();
    if (!session || !session.class2d_config.enabled) return false;

    const threshold = session.class2d_config.particle_threshold || 5000;
    const interval = session.class2d_config.batch_interval_ms || 3600000;
    const particles = session.state.particles_extracted || 0;
    const lastRun = session.state.last_batch_2d;

    const enoughParticles = particles >= threshold;
    const enoughTime = !lastRun || (Date.now() - new Date(lastRun).getTime() > interval);

    if (enoughParticles && enoughTime) {
      logger.info(`[LiveOrchestrator] Triggering 2D classification | particles: ${particles} | session: ${session.session_name}`);
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
      project_id: session.project_id,
      submitToQueue: 'Yes',
      inputStarFile: `Extract/${extractJob.job_name}/particles.star`,
      numberOfClasses: cfg.num_classes || 50,
      maskDiameter: cfg.particle_diameter || session.picking_config.max_diameter || 200,
      numberEMIterations: cfg.iterations || defaultIter,
      useVDAM: useVDAM ? 'Yes' : 'No',
      vdamMiniBatches: cfg.vdam_mini_batches || 200,
      threads: session.slurm_config?.threads || 4,
      numberOfMpiProcs: class2dMpi,
      // GPU acceleration for 2D classification
      gpuAcceleration: 'Yes',
      useGPU: gpuIds
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
      execution_mode: 'slurm',
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

    // Add to session's class2d jobs array and record trigger time
    await LiveSession.findOneAndUpdate(
      { id: sessionId },
      {
        $push: { 'jobs.class2d_ids': jobId },
        'state.last_batch_2d': new Date()
      }
    );

    const slurmParams = {
      queuename: session.slurm_config?.queue || null,
      queueSubmitCommand: 'sbatch',
      runningmpi: class2dMpi,
      threads: session.slurm_config?.threads || 4,
      gres: session.slurm_config?.gpu_count || 1  // Always request GPU for Class2D
    };

    await submitJobDirect({
      cmd, jobId, jobName,
      stageName: 'Class2D',
      projectPath,
      outputDir,
      executionMode: 'slurm',
      slurmParams
    });

    await session.addActivity('class2d_triggered', `2D Classification ${jobName} submitted (${session.state.particles_extracted} particles)`, {
      level: 'info',
      stage: 'Class2D',
      job_name: jobName,
      pass_number: session.state?.pass_count || null,
      context: {
        particle_count: session.state.particles_extracted,
        num_classes: session.class2d_config?.num_classes || 50,
        batch_interval_ms: session.class2d_config?.batch_interval_ms || 3600000
      }
    });
    this._broadcast(session.project_id, sessionId, 'class2d_triggered', {
      job_name: jobName, particles: session.state.particles_extracted
    }, 'info');

    return true;
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
          total_passes: freshSession.state?.pass_count || 0,
          movies_processed: freshSession.state?.movies_imported || freshSession.state?.movies_found || 0,
          movies_motion: freshSession.state?.movies_motion || 0,
          movies_ctf: freshSession.state?.movies_ctf || 0,
          particles_extracted: freshSession.state?.particles_extracted || 0,
          movies_rejected: freshSession.state?.movies_rejected || 0,
          duration_ms: durationMs
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
   * Release the busy lock for a session
   */
  _releaseBusy(sessionId) {
    const state = this.activeSessions.get(sessionId);
    if (state) {
      state.busy = false;
      // Check for pending rerun
      if (state.pendingRerun && state.running) {
        this._runPipelinePass(sessionId);
      }
    }
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
        session_id: sessionId,
        event,
        level,
        data,
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
