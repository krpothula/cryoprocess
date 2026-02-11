/**
 * Job Registry
 *
 * Single source of truth for job type definitions.
 * Replaces the three duplicate registries (JOB_BUILDERS, JOB_VALIDATORS, STAGE_NAMES).
 */

// Builder imports
const ImportJobBuilder = require('../services/importBuilder');
const MotionCorrectionBuilder = require('../services/motionBuilder');
const CTFBuilder = require('../services/ctfBuilder');
const AutoPickBuilder = require('../services/autopickBuilder');
const ExtractBuilder = require('../services/extractBuilder');
const Class2DBuilder = require('../services/class2dBuilder');
const Class3DBuilder = require('../services/class3dBuilder');
const InitialModelBuilder = require('../services/initialModelBuilder');
const AutoRefineBuilder = require('../services/autoRefineBuilder');
const PostProcessBuilder = require('../services/postProcessBuilder');
const LinkMoviesBuilder = require('../services/linkMoviesBuilder');
const PolishBuilder = require('../services/polishBuilder');
const CTFRefineBuilder = require('../services/ctfRefineBuilder');
const MaskCreateBuilder = require('../services/maskCreateBuilder');
const LocalResolutionBuilder = require('../services/localResBuilder');
const SubtractBuilder = require('../services/subtractBuilder');
const JoinStarBuilder = require('../services/joinStarBuilder');
const SubsetBuilder = require('../services/subsetBuilder');
const MultibodyBuilder = require('../services/multibodyBuilder');
const DynamightBuilder = require('../services/dynamightBuilder');
const ModelAngeloBuilder = require('../services/modelAngeloBuilder');
const ManualPickBuilder = require('../services/manualPickBuilder');
const ManualSelectBuilder = require('../services/manualSelectBuilder');

// Validator imports
const { validateImportJob } = require('../validators/importSchema');

// Generic validator for jobs without specific schema
const genericValidator = (data) => ({ value: data, error: null });

/**
 * Job type definitions
 * Each entry defines: builder, validator, stageName, and aliases
 */
const JOB_DEFINITIONS = {
  import: {
    builder: ImportJobBuilder,
    validator: validateImportJob,
    stageName: 'Import',
    aliases: ['import'],
    computeTier: 'mpi'
  },
  link_movies: {
    builder: LinkMoviesBuilder,
    validator: genericValidator,
    stageName: 'LinkMovies',
    aliases: ['link_movies', 'linkmovies'],
    computeTier: 'local'
  },
  motion_correction: {
    builder: MotionCorrectionBuilder,
    validator: genericValidator,
    stageName: 'MotionCorr',
    aliases: ['motion_correction', 'motioncorr'],
    computeTier: 'mpi'
  },
  ctf_estimation: {
    builder: CTFBuilder,
    validator: genericValidator,
    stageName: 'CtfFind',
    aliases: ['ctf_estimation', 'ctf'],
    computeTier: 'mpi'
  },
  auto_picking: {
    builder: AutoPickBuilder,
    validator: genericValidator,
    stageName: 'AutoPick',
    aliases: ['auto_picking', 'autopick'],
    computeTier: 'mpi'
  },
  particle_extraction: {
    builder: ExtractBuilder,
    validator: genericValidator,
    stageName: 'Extract',
    aliases: ['particle_extraction', 'extract'],
    computeTier: 'mpi'
  },
  class_2d: {
    builder: Class2DBuilder,
    validator: genericValidator,
    stageName: 'Class2D',
    aliases: ['class_2d', 'class2d', 'classification_2d'],
    computeTier: 'gpu'
  },
  class_3d: {
    builder: Class3DBuilder,
    validator: genericValidator,
    stageName: 'Class3D',
    aliases: ['class_3d', 'class3d', 'classification_3d'],
    computeTier: 'gpu'
  },
  initial_model: {
    builder: InitialModelBuilder,
    validator: genericValidator,
    stageName: 'InitialModel',
    aliases: ['initial_model', 'initialmodel'],
    computeTier: 'gpu'
  },
  auto_refine: {
    builder: AutoRefineBuilder,
    validator: genericValidator,
    stageName: 'AutoRefine',
    aliases: ['auto_refine', 'autorefine', 'refine3d'],
    computeTier: 'gpu'
  },
  postprocess: {
    builder: PostProcessBuilder,
    validator: genericValidator,
    stageName: 'PostProcess',
    aliases: ['postprocess', 'post_process'],
    computeTier: 'local'
  },
  polish: {
    builder: PolishBuilder,
    validator: genericValidator,
    stageName: 'Polish',
    aliases: ['polish', 'bayesian_polishing'],
    computeTier: 'mpi'
  },
  ctf_refine: {
    builder: CTFRefineBuilder,
    validator: genericValidator,
    stageName: 'CtfRefine',
    aliases: ['ctf_refine', 'ctfrefine'],
    computeTier: 'mpi'
  },
  mask_create: {
    builder: MaskCreateBuilder,
    validator: genericValidator,
    stageName: 'MaskCreate',
    aliases: ['mask_create', 'maskcreate'],
    computeTier: 'local'
  },
  local_resolution: {
    builder: LocalResolutionBuilder,
    validator: genericValidator,
    stageName: 'LocalRes',
    aliases: ['local_resolution', 'localres'],
    computeTier: 'local'
  },
  subtract: {
    builder: SubtractBuilder,
    validator: genericValidator,
    stageName: 'Subtract',
    aliases: ['subtract', 'particle_subtraction'],
    computeTier: 'local'
  },
  join_star: {
    builder: JoinStarBuilder,
    validator: genericValidator,
    stageName: 'JoinStar',
    aliases: ['join_star', 'joinstar'],
    computeTier: 'local'
  },
  subset: {
    builder: SubsetBuilder,
    validator: genericValidator,
    stageName: 'Subset',
    aliases: ['subset', 'subset_selection'],
    computeTier: 'local'
  },
  multibody: {
    builder: MultibodyBuilder,
    validator: genericValidator,
    stageName: 'Multibody',
    aliases: ['multibody', 'multi_body'],
    computeTier: 'gpu'
  },
  dynamight: {
    builder: DynamightBuilder,
    validator: genericValidator,
    stageName: 'Dynamight',
    aliases: ['dynamight'],
    computeTier: 'gpu'
  },
  model_angelo: {
    builder: ModelAngeloBuilder,
    validator: genericValidator,
    stageName: 'ModelAngelo',
    aliases: ['model_angelo', 'modelangelo'],
    computeTier: 'gpu'
  },
  manual_pick: {
    builder: ManualPickBuilder,
    validator: genericValidator,
    stageName: 'ManualPick',
    aliases: ['manual_pick', 'manualpick'],
    computeTier: 'local'
  },
  manual_class_selection: {
    builder: ManualSelectBuilder,
    validator: genericValidator,
    stageName: 'ManualSelect',
    aliases: ['manual_class_selection', 'manualselect'],
    computeTier: 'local'
  }
};

// Build lookup maps from JOB_DEFINITIONS
const JOB_BUILDERS = {};
const JOB_VALIDATORS = {};
const STAGE_NAMES = {};
const ALIAS_TO_CANONICAL = {};

for (const [canonical, def] of Object.entries(JOB_DEFINITIONS)) {
  for (const alias of def.aliases) {
    JOB_BUILDERS[alias] = def.builder;
    JOB_VALIDATORS[alias] = def.validator;
    STAGE_NAMES[alias] = def.stageName;
    ALIAS_TO_CANONICAL[alias] = canonical;
  }
}

/**
 * Get job definition by job type (handles aliases)
 * @param {string} jobType - Job type or alias
 * @returns {Object|null} Job definition or null
 */
function getJobDefinition(jobType) {
  const canonical = ALIAS_TO_CANONICAL[jobType];
  return canonical ? JOB_DEFINITIONS[canonical] : null;
}

/**
 * Get builder class for a job type
 * @param {string} jobType - Job type or alias
 * @returns {Class|null} Builder class or null
 */
function getBuilder(jobType) {
  return JOB_BUILDERS[jobType] || null;
}

/**
 * Get validator function for a job type
 * @param {string} jobType - Job type or alias
 * @returns {Function|null} Validator function or null
 */
function getValidator(jobType) {
  return JOB_VALIDATORS[jobType] || null;
}

/**
 * Get stage name for a job type
 * @param {string} jobType - Job type or alias
 * @returns {string|null} Stage name or null
 */
function getStageName(jobType) {
  return STAGE_NAMES[jobType] || null;
}

/**
 * Check if a job type is valid
 * @param {string} jobType - Job type or alias
 * @returns {boolean}
 */
function isValidJobType(jobType) {
  return !!JOB_BUILDERS[jobType];
}

/**
 * Get all valid job type aliases
 * @returns {string[]}
 */
function getAllJobTypes() {
  return Object.keys(JOB_BUILDERS);
}

/**
 * Get all canonical job types (no aliases)
 * @returns {string[]}
 */
function getCanonicalJobTypes() {
  return Object.keys(JOB_DEFINITIONS);
}

module.exports = {
  JOB_DEFINITIONS,
  JOB_BUILDERS,
  JOB_VALIDATORS,
  STAGE_NAMES,
  ALIAS_TO_CANONICAL,
  getJobDefinition,
  getBuilder,
  getValidator,
  getStageName,
  isValidJobType,
  getAllJobTypes,
  getCanonicalJobTypes,
  genericValidator
};
