/**
 * Job Model - Cryo-EM/RELION Pipeline
 *
 * Represents a processing job in the RELION cryo-EM pipeline.
 *
 * PIPELINE OVERVIEW:
 *
 * Import -> MotionCorr -> CtfFind -> AutoPick -> Extract
 *   |                                               |
 *   | pixel_size (original)           pixel_size changes (if rescaling)
 *   v                                               v
 * Class2D -> InitialModel -> AutoRefine -> PostProcess
 *
 * KEY FIELDS BY STAGE:
 * - Import:      pixel_size (original), micrograph_count, import_type
 * - MotionCorr:  pixel_size (x binning), micrograph_count
 * - CtfFind:     pixel_size (inherited), micrograph_count
 * - AutoPick:    pixel_size (inherited), particle_count
 * - Extract:     pixel_size (x rescale), particle_count, box_size
 * - Class2D/3D:  pixel_size (inherited), class_count, iteration_count
 * - AutoRefine:  pixel_size (inherited), iteration_count, resolution
 * - PostProcess: pixel_size (inherited), resolution (final)
 */

const mongoose = require('mongoose');
const { JOB_STATUS, STAGES } = require('../config/constants');
const logger = require('../utils/logger');

// Build job type enum from STAGES constant (single source of truth)
const JOB_TYPES = Object.values(STAGES).map(stage => stage.name);

const jobSchema = new mongoose.Schema({
  // ============================================================================
  // IDENTIFIERS
  // ============================================================================

  /** Unique job ID (MongoDB ObjectId as string) */
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },

  /** Project this job belongs to */
  project_id: {
    type: String,
    required: true,
    index: true
  },

  /** User who created the job */
  user_id: {
    type: Number,
    required: true,
    index: true
  },

  /** Human-readable job name (Job001, Job002, etc.) */
  job_name: {
    type: String,
    required: true,
    index: true
  },

  /** RELION job type - matches STAGES in constants.js */
  job_type: {
    type: String,
    required: true,
    enum: JOB_TYPES
  },

  // ============================================================================
  // STATUS & EXECUTION
  // ============================================================================

  /** Current job status */
  status: {
    type: String,
    default: JOB_STATUS.PENDING,
    enum: Object.values(JOB_STATUS),
    index: true
  },

  /** Execution method: how the command is launched
   *  - 'direct' : spawned directly on the host (no queue manager)
   *  - 'slurm'  : submitted via sbatch to SLURM scheduler
   */
  execution_method: {
    type: String,
    default: 'slurm',
    enum: ['direct', 'slurm']
  },

  /** System type: where the job runs
   *  - 'local'  : same machine as the web server
   *  - 'remote' : remote cluster reached via SSH
   */
  system_type: {
    type: String,
    default: 'local',
    enum: ['local', 'remote']
  },

  /** SLURM job ID (when submitted to cluster) */
  slurm_job_id: {
    type: String,
    default: null
  },

  /** Local process ID (when execution_method is 'direct') */
  local_pid: {
    type: Number,
    default: null
  },

  /** Full RELION command that was/will be executed */
  command: {
    type: String,
    default: ''
  },

  /** Error message if job failed */
  error_message: {
    type: String,
    default: null
  },

  // ============================================================================
  // PIPELINE CONNECTIONS (Job Tree)
  // ============================================================================

  /**
   * Parent job IDs for pipeline tree traversal.
   * Used to build job hierarchy and trace data flow.
   * Example: Extract job has input_job_ids = [ctf_job_id, autopick_job_id]
   */
  input_job_ids: {
    type: [String],
    default: []
  },

  /** Output directory path (e.g., /project/MotionCorr/Job002/) */
  output_file_path: {
    type: String,
    default: ''
  },

  /**
   * Subdirectory within output_file_path where per-micrograph output files live.
   * RELION mirrors the input path structure, so downstream jobs (CTF, AutoPick, Extract)
   * nest outputs at e.g. MotionCorr/Job003/Movies/ instead of a flat Movies/ subdir.
   * Computed at submission time from the input STAR file.
   * Used by progressHelper for fast flat readdir instead of recursive search.
   */
  progress_subdir: {
    type: String,
    default: null
  },

  // ============================================================================
  // PIPELINE STATS (Uniform per-job statistics)
  // Every job carries all fields. null = not applicable, 0 = no data yet.
  // Populated by pipelineMetadata.js when job completes; inherited from upstream at creation.
  // ============================================================================

  /**
   * Uniform pipeline statistics that every job carries.
   * All stats cards on dashboards read ONLY from this object.
   *
   * PIPELINE-FLOW FIELDS (computed at completion, inherited from upstream):
   *   pixel_size        - Pixel size in Å (changes at Import, MotionCorr, Extract)
   *   micrograph_count  - Number of micrographs (set by Import/Motion/CTF)
   *   particle_count    - Number of particles (set by Extract, inherited downstream)
   *   box_size          - Box size in pixels (set by Extract, inherited downstream)
   *   resolution        - Resolution in Å (set by AutoRefine, PostProcess)
   *   bfactor           - B-factor (set by PostProcess, LocalRes)
   *   class_count       - Number of classes (set by Class2D/3D/InitialModel)
   *   iteration_count   - Iterations completed (LIVE-UPDATED during execution)
   *   movie_count       - Number of movies (set by Import, JoinStar)
   *
   * PARAMETER-DERIVED FIELDS (set at submission time from job parameters):
   *   total_iterations  - Total iterations requested (Class2D/3D/InitialModel/DynaMight)
   *   voltage           - Microscope voltage kV (Import)
   *   cs                - Spherical aberration (Import)
   *   import_type       - 'movies' | 'micrographs' (Import)
   *   symmetry          - Point group e.g. 'C1', 'D2' (Class3D/InitialModel/AutoRefine)
   *   mask_diameter     - Mask diameter in Å (Class2D/3D/InitialModel)
   *   bin_factor        - Binning factor, default 1 (MotionCorr)
   *   pick_method       - 'LoG' | 'Topaz' | 'Template' (AutoPick)
   *   rescaled_size     - Rescaled box size in px (Extract)
   *
   * CTF REFINEMENT FIELDS (set at completion):
   *   defocus_mean, astigmatism_mean, beam_tilt_x, beam_tilt_y
   *   ctf_fitting, beam_tilt_enabled, aniso_mag
   */
  pipeline_stats: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      // Pipeline-flow fields
      pixel_size: null,
      micrograph_count: 0,
      particle_count: 0,
      box_size: null,
      resolution: null,
      bfactor: null,
      class_count: 0,
      iteration_count: 0,
      movie_count: 0,
      // Parameter-derived fields (set at submission)
      total_iterations: 0,
      voltage: null,
      cs: null,
      import_type: null,
      symmetry: null,
      mask_diameter: null,
      bin_factor: 1,
      pick_method: null,
      rescaled_size: null,
      // CTF refinement fields
      defocus_mean: null,
      astigmatism_mean: null,
      beam_tilt_x: null,
      beam_tilt_y: null,
      ctf_fitting: null,
      beam_tilt_enabled: null,
      aniso_mag: null
    })
  },

  // ============================================================================
  // TIMING
  // ============================================================================

  /** When the job started running */
  start_time: {
    type: Date,
    default: null
  },

  /** When the job completed (success/failed/cancelled) */
  end_time: {
    type: Date,
    default: null
  },

  /** When the job was created */
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  },

  /** Last update timestamp */
  updated_at: {
    type: Date,
    default: Date.now
  },

  // ============================================================================
  // JOB PARAMETERS (RELION Command Parameters)
  // Job-type specific. Stored as submitted by user.
  // ============================================================================

  /**
   * RELION job parameters as submitted.
   * Structure varies by job_type. Common fields:
   *
   * Import:
   *   - angpix: Original pixel size
   *   - kV: Voltage
   *   - Cs: Spherical aberration
   *   - Q0: Amplitude contrast
   *   - import_type: 'movies' | 'micrographs'
   *
   * MotionCorr:
   *   - binningFactor: Binning factor (affects pixel_size)
   *   - dosePerFrame: Dose per frame
   *   - patchX, patchY: Patch size
   *
   * Extract:
   *   - boxSize: Extraction box size in pixels
   *   - rescale: 'Yes' | 'No'
   *   - rescaledSize: Rescaled box size (affects pixel_size)
   *
   * Class2D/3D:
   *   - numberOfClasses: Number of classes (K)
   *   - numberOfIterations: Max iterations
   *   - maskDiameter: Mask diameter in Å
   *
   * AutoRefine:
   *   - initialLowpassFilter: Initial lowpass (Å)
   *   - symmetry: Point group symmetry (C1, D2, etc.)
   */
  parameters: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },

  // ============================================================================
  // CACHING
  // ============================================================================

  /**
   * Output files generated by this job.
   * Can be strings (filenames) or objects with metadata.
   * Used for tracking exports and generated outputs.
   */
  output_files: {
    type: [mongoose.Schema.Types.Mixed],
    default: []
  },

  /** Whether to send email notification when job reaches terminal state */
  notify_email: {
    type: Boolean,
    default: false
  },

  /**
   * Cached STAR file data for dashboard display.
   * Avoids re-parsing large STAR files on every request.
   * Structure: { parsed_at, data: {...} }
   */
  star_cache: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }

}, {
  collection: 'jobs',
  timestamps: false,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// ============================================================================
// INDEXES
// ============================================================================

// Compound indexes for common queries
jobSchema.index({ project_id: 1, job_name: 1 }, { unique: true });
jobSchema.index({ project_id: 1, job_type: 1 });
jobSchema.index({ project_id: 1, status: 1 });
jobSchema.index({ project_id: 1, job_type: 1, status: 1 });

// Pipeline stats: find best resolution jobs
jobSchema.index({ project_id: 1, 'pipeline_stats.resolution': 1 });

// Pipeline traversal: find children of a job
jobSchema.index({ input_job_ids: 1 });

// ============================================================================
// MIDDLEWARE
// ============================================================================

jobSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// ============================================================================
// STATIC METHODS
// ============================================================================

/** Generate a new unique job ID */
jobSchema.statics.generateId = function() {
  return new mongoose.Types.ObjectId().toString();
};

/**
 * Get next job name for a project (Job001, Job002, etc.)
 * Uses atomic findOneAndUpdate to avoid race conditions on concurrent submissions.
 * @param {string} projectId - Project ID
 * @returns {Promise<string>} Next job name
 */
jobSchema.statics.getNextJobName = async function(projectId) {
  const maxRetries = 5;
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    const lastJob = await this.findOne({ project_id: projectId })
      .sort({ job_name: -1 })
      .select('job_name')
      .lean();

    let nextName = 'Job001';
    if (lastJob && lastJob.job_name) {
      const match = lastJob.job_name.match(/Job(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10) + 1;
        nextName = `Job${num.toString().padStart(3, '0')}`;
      }
    }

    // Check if this name already exists (race condition guard)
    const exists = await this.findOne({ project_id: projectId, job_name: nextName }).lean();
    if (!exists) {
      return nextName;
    }

    // Name collision - another concurrent request took it, retry
    logger.warn(`[Job] Job name collision: ${nextName} already exists in project ${projectId}, retrying (attempt ${attempt + 1}/${maxRetries})`);
  }

  // Fallback: use count-based name to guarantee uniqueness
  const count = await this.countDocuments({ project_id: projectId });
  return `Job${(count + 1).toString().padStart(3, '0')}`;
};

/**
 * Find all jobs in a project's pipeline tree
 * @param {string} projectId - Project ID
 * @returns {Promise<Array>} Jobs sorted by creation order
 */
jobSchema.statics.getPipelineTree = async function(projectId) {
  return this.find({ project_id: projectId })
    .sort({ created_at: 1 })
    .select('id job_name job_type status input_job_ids pipeline_stats')
    .lean();
};

/**
 * Find child jobs (jobs that use this job as input)
 * @param {string} jobId - Parent job ID
 * @returns {Promise<Array>} Child jobs
 */
jobSchema.statics.findChildren = async function(jobId) {
  return this.find({ input_job_ids: jobId })
    .sort({ created_at: 1 })
    .lean();
};

// ============================================================================
// VIRTUALS
// ============================================================================

/** Job duration in seconds (if completed) */
jobSchema.virtual('duration').get(function() {
  if (this.start_time && this.end_time) {
    return Math.round((this.end_time - this.start_time) / 1000);
  }
  return null;
});

/** Whether job is in a terminal state */
jobSchema.virtual('isTerminal').get(function() {
  return [JOB_STATUS.SUCCESS, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(this.status);
});

/** Whether job is currently running */
jobSchema.virtual('isRunning').get(function() {
  return this.status === JOB_STATUS.RUNNING;
});

/** Whether job completed successfully */
jobSchema.virtual('isSuccess').get(function() {
  return this.status === JOB_STATUS.SUCCESS;
});

// ============================================================================
// INSTANCE METHODS
// ============================================================================

/**
 * Update job status with proper timestamps
 * @param {string} status - New status
 * @param {string|null} errorMessage - Error message (for failed status)
 * @returns {Promise<Job>} Updated job
 */
jobSchema.methods.setStatus = function(status, errorMessage = null) {
  this.status = status;
  this.updated_at = new Date();

  if (status === JOB_STATUS.RUNNING && !this.start_time) {
    this.start_time = new Date();
  } else if ([JOB_STATUS.SUCCESS, JOB_STATUS.FAILED, JOB_STATUS.CANCELLED].includes(status)) {
    this.end_time = new Date();
  }

  if (errorMessage) {
    this.error_message = errorMessage;
  }

  return this.save();
};

/**
 * Check if this job type produces particles
 * @returns {boolean}
 */
jobSchema.methods.producesParticles = function() {
  return ['Extract', 'Subset', 'Polish', 'CtfRefine'].includes(this.job_type);
};

/**
 * Check if this job type produces a 3D volume
 * @returns {boolean}
 */
jobSchema.methods.produces3DVolume = function() {
  return ['InitialModel', 'Class3D', 'AutoRefine', 'PostProcess', 'LocalRes', 'MaskCreate', 'Multibody'].includes(this.job_type);
};

/**
 * Check if this job type is iterative
 * @returns {boolean}
 */
jobSchema.methods.isIterative = function() {
  return ['Class2D', 'Class3D', 'InitialModel', 'AutoRefine'].includes(this.job_type);
};

const Job = mongoose.model('Job', jobSchema);

module.exports = Job;
