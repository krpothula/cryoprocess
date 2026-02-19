/**
 * LiveSession Model
 *
 * Represents an automated live processing session that chains RELION jobs
 * (Import -> MotionCorr -> CTF -> AutoPick -> Extract -> Class2D)
 * and re-runs the pipeline as new movies arrive.
 */

const mongoose = require('mongoose');

/**
 * Derive a log severity level from event name.
 * Used as fallback when caller doesn't specify a level.
 */
function deriveLevel(event) {
  if (!event) return 'info';
  if (event.includes('error')) return 'error';
  if (event.includes('complete') || event.includes('success') || event === 'session_completed') return 'success';
  if (event.includes('warning') || event.includes('skipped') || event === 'session_paused' || event === 'session_stopped') return 'warning';
  return 'info';
}

const activityLogEntrySchema = new mongoose.Schema({
  timestamp: { type: Date, default: Date.now },
  event: { type: String, required: true },
  message: { type: String, default: '' },
  // Severity level for filtering and display
  level: {
    type: String,
    enum: ['info', 'success', 'warning', 'error'],
    default: 'info'
  },
  // Pipeline stage this entry relates to (e.g., 'Import', 'MotionCorr')
  stage: { type: String, default: null },
  // Job name (e.g., 'Job003')
  job_name: { type: String, default: null },
  // Pipeline pass number for grouping
  pass_number: { type: Number, default: null },
  // Structured context data (shape varies by event type)
  context: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, { _id: false });

const passHistoryEntrySchema = new mongoose.Schema({
  pass_number: { type: Number, required: true },
  completed_at: { type: Date, default: Date.now },
  movies_imported: { type: Number, default: 0 },
  movies_motion: { type: Number, default: 0 },
  movies_ctf: { type: Number, default: 0 },
  movies_picked: { type: Number, default: 0 },
  particles_extracted: { type: Number, default: 0 },
  class2d_count: { type: Number, default: 0 },
}, { _id: false });

const liveSessionSchema = new mongoose.Schema({
  // Identifiers
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: Number,
    required: true
  },
  session_name: {
    type: String,
    required: true
  },

  // Status
  status: {
    type: String,
    enum: ['pending', 'running', 'paused', 'stopped', 'completed'],
    default: 'pending',
    index: true
  },

  // Input configuration
  input_mode: {
    type: String,
    enum: ['watch', 'existing'],
    default: 'watch'
  },
  watch_directory: {
    type: String,
    required: true
  },
  file_pattern: {
    type: String,
    default: '*.tiff'
  },

  // Optics parameters (for Import job)
  optics: {
    pixel_size: { type: Number, required: true },
    voltage: { type: Number, required: true },
    cs: { type: Number, required: true },
    amplitude_contrast: { type: Number, required: true },
    optics_group_name: { type: String, default: 'opticsGroup1' }
  },

  // Motion correction parameters
  motion_config: {
    enabled: { type: Boolean, default: true },
    bin_factor: { type: Number, default: 1 },
    dose_per_frame: { type: Number, default: 1.0 },
    patch_x: { type: Number, default: 5 },
    patch_y: { type: Number, default: 5 },
    use_gpu: { type: Boolean, default: false },
    gpu_ids: { type: String, default: '0' }
  },

  // CTF estimation parameters
  ctf_config: {
    enabled: { type: Boolean, default: true },
    defocus_min: { type: Number, default: 5000 },
    defocus_max: { type: Number, default: 50000 },
    defocus_step: { type: Number, default: 500 }
  },

  // Particle picking parameters
  picking_config: {
    enabled: { type: Boolean, default: true },
    method: { type: String, enum: ['LoG', 'template'], default: 'LoG' },
    min_diameter: { type: Number, default: 100 },
    max_diameter: { type: Number, default: 200 },
    threshold: { type: Number, default: 0.0 }
  },

  // Particle extraction parameters
  extraction_config: {
    enabled: { type: Boolean, default: true },
    box_size: { type: Number, default: 256 },
    rescale: { type: Boolean, default: false },
    rescaled_size: { type: Number, default: 128 }
  },

  // 2D classification parameters (batch processing)
  class2d_config: {
    enabled: { type: Boolean, default: false },
    num_classes: { type: Number, default: 50 },
    particle_threshold: { type: Number, default: 5000 },
    batch_interval_ms: { type: Number, default: 3600000 }, // 1 hour
    particle_diameter: { type: Number, default: 200 },
    iterations: { type: Number, default: 200 },
    use_vdam: { type: Boolean, default: true },
    vdam_mini_batches: { type: Number, default: 200 }
  },

  // Minimum movies before triggering first pipeline pass
  movie_threshold: {
    type: Number,
    default: 0   // 0 = no threshold, start immediately
  },

  // Quality filtering thresholds
  thresholds: {
    ctf_resolution_max: { type: Number, default: 5.0 },
    total_motion_max: { type: Number, default: 30.0 }
  },

  // SLURM / execution settings
  slurm_config: {
    queue: { type: String, default: null },
    threads: { type: Number, default: 4 },
    mpi_procs: { type: Number, default: 1 },
    gpu_count: { type: Number, default: 1 }
  },

  // Processing state (counters updated in real-time)
  state: {
    movies_found: { type: Number, default: 0 },
    movies_imported: { type: Number, default: 0 },
    movies_motion: { type: Number, default: 0 },
    movies_ctf: { type: Number, default: 0 },
    movies_picked: { type: Number, default: 0 },
    particles_extracted: { type: Number, default: 0 },
    movies_rejected: { type: Number, default: 0 },
    current_stage: { type: String, default: null },
    last_pipeline_pass: { type: Date, default: null },
    pass_count: { type: Number, default: 0 },
    // How many movies the current pipeline pass is processing
    // (snapshot of movies_found at pass start - used for running/queue display)
    movies_at_pass_start: { type: Number, default: 0 },
    // Set when session pauses mid-pipeline - tells resume which stage to retry
    resume_from: { type: String, default: null },
    // Tracks when last Class2D batch was triggered (for interval gating)
    last_batch_2d: { type: Date, default: null }
  },

  // Job IDs created by this session (for pipeline tree integration)
  jobs: {
    import_id: { type: String, default: null },
    motion_id: { type: String, default: null },
    ctf_id: { type: String, default: null },
    pick_id: { type: String, default: null },
    extract_id: { type: String, default: null },
    class2d_ids: { type: [String], default: [] }
  },

  // Activity log (capped at last 1000 entries)
  activity_log: {
    type: [activityLogEntrySchema],
    default: []
  },

  // Pass history — snapshot of cumulative counts at the end of each pipeline pass
  pass_history: {
    type: [passHistoryEntrySchema],
    default: []
  },

  // Timing
  start_time: { type: Date, default: null },
  end_time: { type: Date, default: null },
  created_at: { type: Date, default: Date.now },
  updated_at: { type: Date, default: Date.now }
}, {
  collection: 'live_sessions',
  timestamps: false
});

// Indexes
liveSessionSchema.index({ project_id: 1, status: 1 });
liveSessionSchema.index({ project_id: 1, created_at: -1 });

// Pre-save middleware
liveSessionSchema.pre('save', function(next) {
  this.updated_at = new Date();
  // Cap activity log at 1000 entries
  if (this.activity_log && this.activity_log.length > 1000) {
    this.activity_log = this.activity_log.slice(-1000);
  }
  next();
});

// Static: generate unique ID
liveSessionSchema.statics.generateId = function() {
  return new mongoose.Types.ObjectId().toString();
};

// Static: get next session name for a project
liveSessionSchema.statics.getNextSessionName = async function(projectId) {
  const lastSession = await this.findOne({ project_id: projectId })
    .sort({ created_at: -1 })
    .select('session_name')
    .lean();

  if (!lastSession || !lastSession.session_name) {
    return 'Live001';
  }

  const match = lastSession.session_name.match(/Live(\d+)/);
  if (match) {
    const num = parseInt(match[1], 10) + 1;
    return `Live${num.toString().padStart(3, '0')}`;
  }

  return 'Live001';
};

// Instance: add activity log entry (atomic)
// opts: { level, stage, job_name, pass_number, context }
liveSessionSchema.methods.addActivity = async function(event, message, opts = {}) {
  const entry = {
    timestamp: new Date(),
    event,
    message,
    level: opts.level || deriveLevel(event),
    stage: opts.stage || null,
    job_name: opts.job_name || null,
    pass_number: opts.pass_number || null,
    context: opts.context || null
  };

  return LiveSession.findOneAndUpdate(
    { id: this.id },
    {
      $push: {
        activity_log: {
          $each: [entry],
          $slice: -1000
        }
      },
      updated_at: new Date()
    },
    { new: true }
  );
};

const LiveSession = mongoose.model('LiveSession', liveSessionSchema);

module.exports = LiveSession;
