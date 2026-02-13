/**
 * Application Constants
 *
 * Centralized constants to eliminate magic strings/numbers throughout the codebase.
 */

// Job status values
const JOB_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',  // Job completed successfully
  FAILED: 'failed',
  CANCELLED: 'cancelled'
};

// Terminal statuses (job is done, no more updates)
const TERMINAL_STATUSES = [
  JOB_STATUS.SUCCESS,
  JOB_STATUS.FAILED,
  JOB_STATUS.CANCELLED
];

// Active statuses (job is still running)
const ACTIVE_STATUSES = [
  JOB_STATUS.PENDING,
  JOB_STATUS.RUNNING
];

// Import types
const IMPORT_TYPE = {
  MOVIES: 'movies',
  MICROGRAPHS: 'micrographs',
  OTHER: 'other'
};

// Stage definitions - single source of truth for job types
const STAGES = {
  import: {
    name: 'Import',
    aliases: ['import'],
    hasValidator: true
  },
  link_movies: {
    name: 'LinkMovies',
    aliases: ['link_movies', 'linkmovies']
  },
  motion_correction: {
    name: 'MotionCorr',
    aliases: ['motion_correction', 'motioncorr']
  },
  ctf_estimation: {
    name: 'CtfFind',
    aliases: ['ctf_estimation', 'ctf']
  },
  auto_picking: {
    name: 'AutoPick',
    aliases: ['auto_picking', 'autopick']
  },
  particle_extraction: {
    name: 'Extract',
    aliases: ['particle_extraction', 'extract']
  },
  class_2d: {
    name: 'Class2D',
    aliases: ['class_2d', 'class2d', 'classification_2d']
  },
  class_3d: {
    name: 'Class3D',
    aliases: ['class_3d', 'class3d', 'classification_3d']
  },
  initial_model: {
    name: 'InitialModel',
    aliases: ['initial_model', 'initialmodel']
  },
  auto_refine: {
    name: 'AutoRefine',
    aliases: ['auto_refine', 'autorefine', 'refine3d']
  },
  postprocess: {
    name: 'PostProcess',
    aliases: ['postprocess', 'post_process']
  },
  polish: {
    name: 'Polish',
    aliases: ['polish', 'bayesian_polishing']
  },
  ctf_refine: {
    name: 'CtfRefine',
    aliases: ['ctf_refine', 'ctfrefine']
  },
  mask_create: {
    name: 'MaskCreate',
    aliases: ['mask_create', 'maskcreate']
  },
  local_resolution: {
    name: 'LocalRes',
    aliases: ['local_resolution', 'localres']
  },
  subtract: {
    name: 'Subtract',
    aliases: ['subtract', 'particle_subtraction']
  },
  join_star: {
    name: 'JoinStar',
    aliases: ['join_star', 'joinstar']
  },
  subset: {
    name: 'Subset',
    aliases: ['subset', 'subset_selection']
  },
  multibody: {
    name: 'Multibody',
    aliases: ['multibody', 'multi_body']
  },
  dynamight: {
    name: 'Dynamight',
    aliases: ['dynamight']
  },
  model_angelo: {
    name: 'ModelAngelo',
    aliases: ['model_angelo', 'modelangelo']
  },
  manual_pick: {
    name: 'ManualPick',
    aliases: ['manual_pick', 'manualpick']
  },
  manual_class_selection: {
    name: 'ManualSelect',
    aliases: ['manual_class_selection', 'manualselect']
  },
  smartscope_process: {
    name: 'SmartScopeProcess',
    aliases: ['smartscope_process', 'smartscope']
  }
};

// Build lookup maps from STAGES
const STAGE_NAMES = {};
const STAGE_ALIASES = {};

for (const [key, stage] of Object.entries(STAGES)) {
  for (const alias of stage.aliases) {
    STAGE_NAMES[alias] = stage.name;
    STAGE_ALIASES[alias] = key;
  }
}

/**
 * Get canonical stage key from any alias
 * @param {string} jobType - Job type or alias
 * @returns {string|null} - Canonical stage key or null
 */
function getCanonicalStage(jobType) {
  return STAGE_ALIASES[jobType] || null;
}

/**
 * Get stage display name from any alias
 * @param {string} jobType - Job type or alias
 * @returns {string|null} - Stage display name or null
 */
function getStageName(jobType) {
  return STAGE_NAMES[jobType] || null;
}

// Default values for various parameters
const DEFAULTS = {
  // Pagination
  PAGE_SIZE: 50,
  MAX_PAGE_SIZE: 500,
  MAX_FILES: 5000,

  // File list display limit
  FILE_LIST_DISPLAY_LIMIT: 50,

  // Image processing
  THUMBNAIL_SIZE: 512,
  MAX_FRAMES: 50,
  FRAME_SIZE: 256,

  // CTF defaults
  CTF_BOX_SIZE: 512,
  CTF_MIN_RES: 30,
  CTF_MAX_RES: 5,
  CTF_DEFOCUS_MIN: 5000,
  CTF_DEFOCUS_MAX: 50000,
  CTF_DEFOCUS_STEP: 500,

  // Motion correction defaults
  PATCH_X: 5,
  PATCH_Y: 5,
  B_FACTOR: 150,

  // Processing defaults
  MPI_PROCS: 1,
  THREADS: 1,
  POOL_SIZE: 30
};

// File patterns for stage outputs
const STAGE_OUTPUT_PATTERNS = {
  Import: ['movies.star', 'micrographs.star'],
  MotionCorr: ['corrected_micrographs.star'],
  CtfFind: ['micrographs_ctf.star'],
  AutoPick: ['coords_suffix_autopick.star', 'autopick.star'],
  Extract: ['particles.star'],
  Class2D: ['*_model.star', '*_data.star'],
  Class3D: ['*_model.star', '*_data.star'],
  InitialModel: ['*_model.star', 'initial_model.mrc'],
  AutoRefine: ['*_model.star', '*_data.star', '*_half1_class001_unfil.mrc'],
  PostProcess: ['postprocess.star', 'postprocess.mrc', 'postprocess_masked.mrc'],
  Polish: ['shiny.star', 'shiny_particles.star'],
  CtfRefine: ['particles_ctf_refine.star'],
  MaskCreate: ['mask.mrc'],
  LocalRes: ['relion_locres.mrc', 'relion_locres_filtered.mrc'],
  Subtract: ['particles_subtracted.star'],
  JoinStar: ['join_particles.star'],
  Subset: ['particles.star'],
  Multibody: ['*_model.star'],
  Dynamight: ['*.mrc'],
  ModelAngelo: ['*.cif', '*.pdb'],
  ManualPick: ['coords_suffix_manualpick.star'],
  ManualSelect: ['particles.star']
};

// Stage MRC patterns for 3D visualization
const STAGE_MRC_PATTERNS = {
  InitialModel: ['run_it*_class*.mrc', '_it*_class*.mrc', 'initial_model.mrc'],
  Class3D: ['run_it*_class*.mrc', '_it*_class*.mrc'],
  AutoRefine: ['run_class001.mrc', '_class001.mrc', 'run_half1_class001_unfil.mrc', '_half1_class001_unfil.mrc'],
  PostProcess: ['postprocess.mrc', 'postprocess_masked.mrc'],
  LocalRes: ['relion_locres.mrc', 'relion_locres_filtered.mrc'],
  MaskCreate: ['mask.mrc'],
  Multibody: ['run_class*.mrc'],
  Dynamight: ['*.mrc']
};

// Star file patterns for input selection
const STAGE_STAR_PATTERNS = {
  Import: ['movies.star', 'micrographs.star'],
  MotionCorr: ['corrected_micrographs.star'],
  CtfFind: ['micrographs_ctf.star'],
  AutoPick: ['*autopick.star', 'coords_suffix*.star'],
  Extract: ['particles.star'],
  Class2D: ['run_it*_data.star', '_it*_data.star', 'run_it*_model.star', '_it*_model.star'],
  Class3D: ['run_it*_data.star', '_it*_data.star', 'run_it*_model.star', '_it*_model.star'],
  InitialModel: ['run_it*_data.star', '_it*_data.star', 'run_it*_model.star', '_it*_model.star'],
  AutoRefine: ['run_data.star', '_data.star', 'run_model.star', '_model.star', 'run_it*_data.star', '_it*_data.star'],
  Polish: ['shiny.star', 'shiny_particles.star'],
  CtfRefine: ['particles_ctf_refine.star'],
  Subset: ['particles.star'],
  ManualSelect: ['particles.star'],
  Subtract: ['particles_subtracted.star'],
  JoinStar: ['join_particles.star']
};

// Output file catalog — defines what each job type produces and the semantic role
// Used by catalogOutputFiles() to populate the output_files[] array on job completion
const STAGE_OUTPUT_CATALOG = {
  Import: [
    { role: 'micrographsStar', pattern: 'movies.star', fileType: 'star' },
    { role: 'micrographsStar', pattern: 'micrographs.star', fileType: 'star' },
  ],
  MotionCorr: [
    { role: 'micrographsStar', pattern: 'corrected_micrographs.star', fileType: 'star' },
  ],
  LinkMovies: [
    { role: 'micrographsStar', pattern: 'movies.star', fileType: 'star' },
  ],
  CtfFind: [
    { role: 'micrographsCtfStar', pattern: 'micrographs_ctf.star', fileType: 'star' },
    { role: 'micrographsCtfStar', pattern: 'filtered_micrographs_ctf_*.star', fileType: 'star' },
  ],
  ManualPick: [
    { role: 'coordinatesStar', pattern: 'coords_suffix_manualpick.star', fileType: 'star' },
  ],
  AutoPick: [
    { role: 'coordinatesStar', pattern: 'autopick.star', fileType: 'star' },
    { role: 'coordinatesStar', pattern: 'coords_suffix_autopick.star', fileType: 'star' },
  ],
  Extract: [
    { role: 'particlesStar', pattern: 'particles.star', fileType: 'star' },
  ],
  Class2D: [
    { role: 'particlesStar', pattern: 'run_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'particlesStar', pattern: '_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'modelStar', pattern: 'run_it*_model.star', fileType: 'star', iterationAware: true },
    { role: 'modelStar', pattern: '_it*_model.star', fileType: 'star', iterationAware: true },
  ],
  Class3D: [
    { role: 'particlesStar', pattern: 'run_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'particlesStar', pattern: '_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'modelStar', pattern: 'run_it*_model.star', fileType: 'star', iterationAware: true },
    { role: 'modelStar', pattern: '_it*_model.star', fileType: 'star', iterationAware: true },
    { role: 'referenceMrc', pattern: 'run_it*_class*.mrc', fileType: 'mrc', iterationAware: true },
    { role: 'referenceMrc', pattern: '_it*_class*.mrc', fileType: 'mrc', iterationAware: true },
  ],
  InitialModel: [
    { role: 'particlesStar', pattern: 'run_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'particlesStar', pattern: '_it*_data.star', fileType: 'star', iterationAware: true },
    { role: 'referenceMrc', pattern: 'initial_model.mrc', fileType: 'mrc' },
    { role: 'referenceMrc', pattern: 'run_it*_class*.mrc', fileType: 'mrc', iterationAware: true },
    { role: 'referenceMrc', pattern: '_it*_class*.mrc', fileType: 'mrc', iterationAware: true },
  ],
  AutoRefine: [
    { role: 'particlesStar', pattern: 'run_data.star', fileType: 'star' },
    { role: 'particlesStar', pattern: '_data.star', fileType: 'star' },
    { role: 'modelStar', pattern: 'run_model.star', fileType: 'star' },
    { role: 'modelStar', pattern: 'run_it*_model.star', fileType: 'star', iterationAware: true },
    { role: 'optimiserStar', pattern: 'run_it*_optimiser.star', fileType: 'star', iterationAware: true },
    { role: 'referenceMrc', pattern: 'run_class001.mrc', fileType: 'mrc' },
    { role: 'referenceMrc', pattern: '_class001.mrc', fileType: 'mrc' },
    { role: 'halfMapMrc', pattern: 'run_half1_class001_unfil.mrc', fileType: 'mrc' },
    { role: 'halfMapMrc', pattern: '_half1_class001_unfil.mrc', fileType: 'mrc' },
    { role: 'halfMapMrc', pattern: 'run_half2_class001_unfil.mrc', fileType: 'mrc' },
    { role: 'halfMapMrc', pattern: '_half2_class001_unfil.mrc', fileType: 'mrc' },
  ],
  PostProcess: [
    { role: 'postprocessStar', pattern: 'postprocess.star', fileType: 'star' },
    { role: 'sharpenedMapMrc', pattern: 'postprocess.mrc', fileType: 'mrc' },
    { role: 'maskedMapMrc', pattern: 'postprocess_masked.mrc', fileType: 'mrc' },
  ],
  Polish: [
    { role: 'particlesStar', pattern: 'shiny.star', fileType: 'star' },
  ],
  CtfRefine: [
    { role: 'particlesStar', pattern: 'particles_ctf_refine.star', fileType: 'star' },
  ],
  MaskCreate: [
    { role: 'maskMrc', pattern: 'mask.mrc', fileType: 'mrc' },
  ],
  LocalRes: [
    { role: 'localResMrc', pattern: 'relion_locres.mrc', fileType: 'mrc' },
    { role: 'localResFilteredMrc', pattern: 'relion_locres_filtered.mrc', fileType: 'mrc' },
  ],
  Subset: [
    { role: 'particlesStar', pattern: 'particles.star', fileType: 'star' },
  ],
  ManualSelect: [
    { role: 'particlesStar', pattern: 'particles.star', fileType: 'star' },
  ],
  Subtract: [
    { role: 'particlesStar', pattern: 'particles_subtracted.star', fileType: 'star' },
  ],
  JoinStar: [
    { role: 'particlesStar', pattern: 'join_particles.star', fileType: 'star' },
  ],
  Multibody: [
    { role: 'modelStar', pattern: 'run_model.star', fileType: 'star' },
    { role: 'referenceMrc', pattern: 'run_class*.mrc', fileType: 'mrc' },
  ],
  ModelAngelo: [
    { role: 'atomicModel', pattern: '*.cif', fileType: 'cif' },
    { role: 'atomicModel', pattern: '*.pdb', fileType: 'pdb' },
  ],
  Dynamight: [
    { role: 'referenceMrc', pattern: '*.mrc', fileType: 'mrc' },
  ],
};

// Downstream input mapping — maps parent job outputs to downstream job form fields
// downstream: MainComponent.js display name (what selectedBuilder uses)
// field: form field name in the downstream tab's I/O component
// role: output file role from STAGE_OUTPUT_CATALOG
const DOWNSTREAM_INPUT_MAP = {
  Import: [
    { downstream: 'Motion Correction', field: 'inputMovies', role: 'micrographsStar' },
    // Import "other" node types
    { downstream: 'Auto-Picking', field: 'twoDReferences', role: 'refs2dMrcs' },
    { downstream: 'Particle extraction', field: 'inputCoordinates', role: 'coordinatesStar' },
    { downstream: '3D classification', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: '3D auto-refine', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: 'Post-processing', field: 'halfMap', role: 'halfMapMrc' },
    { downstream: 'Post-processing', field: 'solventMask', role: 'maskMrc' },
    { downstream: 'Mask creation', field: 'inputMap', role: 'referenceMrc' },
    { downstream: 'Local resolution', field: 'halfMap', role: 'halfMapMrc' },
    { downstream: 'Local resolution', field: 'solventMask', role: 'maskMrc' },
  ],
  LinkMovies: [
    { downstream: 'Motion Correction', field: 'inputMovies', role: 'micrographsStar' },
  ],
  MotionCorr: [
    { downstream: 'CTF Estimation', field: 'inputStarFile', role: 'micrographsStar' },
    { downstream: 'Bayesian polishing', field: 'micrographsFile', role: 'micrographsStar' },
    { downstream: 'Subset selection', field: 'microGraphsStar', role: 'micrographsStar' },
  ],
  CtfFind: [
    { downstream: 'Auto-Picking', field: 'inputMicrographs', role: 'micrographsCtfStar' },
    { downstream: 'Particle extraction', field: 'micrographStarFile', role: 'micrographsCtfStar' },
    { downstream: 'Manual Picking', field: 'inputMicrographs', role: 'micrographsCtfStar' },
    { downstream: 'Subset selection', field: 'microGraphsStar', role: 'micrographsCtfStar' },
  ],
  ManualPick: [
    { downstream: 'Particle extraction', field: 'inputCoordinates', role: 'coordinatesStar' },
  ],
  AutoPick: [
    { downstream: 'Particle extraction', field: 'inputCoordinates', role: 'coordinatesStar' },
  ],
  Extract: [
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D initial model', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Particle substraction', field: 'inputParticlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'micrographs', role: 'particlesStar' },
  ],
  Class2D: [
    { downstream: 'Select Classes', field: 'classFromJob', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D initial model', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'micrographs', role: 'particlesStar' },
  ],
  ManualSelect: [
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D initial model', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'micrographs', role: 'particlesStar' },
  ],
  Subset: [
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D initial model', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'micrographs', role: 'particlesStar' },
  ],
  InitialModel: [
    { downstream: '3D classification', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: '3D auto-refine', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: 'Select Classes', field: 'classFromJob', role: 'particlesStar' },
  ],
  Class3D: [
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: 'Mask creation', field: 'inputMap', role: 'referenceMrc' },
    { downstream: 'Select Classes', field: 'classFromJob', role: 'particlesStar' },
    { downstream: '3D classification', field: 'referenceMap', role: 'referenceMrc' },
    { downstream: 'Particle substraction', field: 'inputParticlesStar', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'consensusMap', role: 'referenceMrc' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
  ],
  AutoRefine: [
    { downstream: 'Post-processing', field: 'halfMap', role: 'halfMapMrc' },
    { downstream: 'Mask creation', field: 'inputMap', role: 'referenceMrc' },
    { downstream: 'CTF refinement', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Bayesian polishing', field: 'particlesFile', role: 'particlesStar' },
    { downstream: 'Local resolution', field: 'halfMap', role: 'halfMapMrc' },
    { downstream: 'Particle substraction', field: 'inputParticlesStar', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'consensusMap', role: 'referenceMrc' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
    { downstream: '3D multi-body', field: 'refinementStarFile', role: 'optimiserStar' },
  ],
  MaskCreate: [
    { downstream: 'Post-processing', field: 'solventMask', role: 'maskMrc' },
    { downstream: '3D auto-refine', field: 'referenceMask', role: 'maskMrc' },
    { downstream: 'Local resolution', field: 'solventMask', role: 'maskMrc' },
    { downstream: 'Particle substraction', field: 'maskOfSignal', role: 'maskMrc' },
    { downstream: '3D classification', field: 'referenceMask', role: 'maskMrc' },
  ],
  PostProcess: [
    { downstream: 'CTF refinement', field: 'postProcessStar', role: 'postprocessStar' },
    { downstream: 'Bayesian polishing', field: 'postProcessStarFile', role: 'postprocessStar' },
    { downstream: 'ModelAngelo building', field: 'bFactorSharpenedMap', role: 'sharpenedMapMrc' },
  ],
  CtfRefine: [
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Bayesian polishing', field: 'particlesFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
  ],
  Polish: [
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
  ],
  Subtract: [
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Particle substraction', field: 'revertParticles', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'Join star files', field: 'particlesStarFile1', role: 'particlesStar' },
  ],
  JoinStar: [
    { downstream: '2D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D classification', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D auto-refine', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: '3D initial model', field: 'inputStarFile', role: 'particlesStar' },
    { downstream: 'Subset selection', field: 'particlesStar', role: 'particlesStar' },
    { downstream: 'DynaMight flexibility', field: 'micrographs', role: 'particlesStar' },
  ],
};

// Rate limiting
const RATE_LIMITS = {
  API_WINDOW_MS: 15 * 60 * 1000,       // 15 minutes
  API_MAX_REQUESTS: 1000,
  AUTH_WINDOW_MS: 15 * 60 * 1000,       // 15 minutes
  AUTH_MAX_REQUESTS: 100,
  REGISTER_WINDOW_MS: 60 * 60 * 1000,   // 1 hour
  REGISTER_MAX_REQUESTS: 5,
  SEARCH_WINDOW_MS: 1 * 60 * 1000,      // 1 minute
  SEARCH_MAX_REQUESTS: 30,
};

// Timing constants
const TIMING = {
  SESSION_COOKIE_MAX_AGE: 7 * 24 * 60 * 60 * 1000,  // 7 days
  WS_PING_INTERVAL: 30000,         // 30s
  WS_RECONNECT_DELAY: 5000,        // 5s
  SLURM_POLL_INTERVAL: 10000,      // 10s
  PROGRESS_CACHE_TTL: 3000,         // 3s
  CACHE_CLEANUP_INTERVAL: 60000,    // 1 minute
  NVIDIA_CMD_TIMEOUT: 5000,         // 5s
};

// Size limits
const LIMITS = {
  MAX_FILES: 5000,
  MAX_JOB_LIST: 1000,
  DEFAULT_JOB_LIST: 100,
  ACTIVITY_LOG_MAX: 1000,
  DESCRIPTION_MAX_LENGTH: 5000,
  REQUEST_BODY_MAX: '10mb',
};

// HTTP status codes
const HTTP_STATUS = {
  OK: 200,
  CREATED: 201,
  BAD_REQUEST: 400,
  UNAUTHORIZED: 401,
  FORBIDDEN: 403,
  NOT_FOUND: 404,
  CONFLICT: 409,
  INTERNAL_ERROR: 500,
  NOT_IMPLEMENTED: 501
};

module.exports = {
  JOB_STATUS,
  TERMINAL_STATUSES,
  ACTIVE_STATUSES,
  IMPORT_TYPE,
  STAGES,
  STAGE_NAMES,
  STAGE_ALIASES,
  getCanonicalStage,
  getStageName,
  DEFAULTS,
  STAGE_OUTPUT_PATTERNS,
  STAGE_MRC_PATTERNS,
  STAGE_STAR_PATTERNS,
  STAGE_OUTPUT_CATALOG,
  DOWNSTREAM_INPUT_MAP,
  HTTP_STATUS,
  RATE_LIMITS,
  TIMING,
  LIMITS
};
