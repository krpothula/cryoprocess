/**
 * Import Job Validation Schema
 *
 * Joi schema for validating import job parameters.
 */

const Joi = require('joi');

// Yes/No to boolean converter
const yesNoBool = Joi.alternatives().try(
  Joi.boolean(),
  Joi.string().valid('Yes', 'No', 'yes', 'no').custom((value) => {
    return value.toLowerCase() === 'yes';
  })
).default(false);

/**
 * Import job validation schema
 */
const importJobSchema = Joi.object({
  // Required
  projectId: Joi.string().required().messages({
    'any.required': 'Project ID is required'
  }),

  // Input job IDs (for pipeline connections)
  inputJobIds: Joi.array().items(Joi.string()).default([]),

  // Execution method: how the command is launched
  executionMethod: Joi.string().valid('direct', 'slurm').default('slurm'),

  // System type: where the job runs
  systemType: Joi.string().valid('local', 'remote').default('local'),

  // For raw movies/micrographs import
  inputFiles: Joi.string().allow('').default(''),

  // Movie options
  rawMovies: yesNoBool,
  multiFrameMovies: yesNoBool,

  // MTF of the detector (STAR file path)
  mtf: Joi.string().allow('').default(''),

  // Microscope settings (RELION params — keep original casing)
  angpix: Joi.number().positive().default(1.4),
  kV: Joi.number().integer().positive().default(300),
  spherical: Joi.number().default(2.7),
  amplitudeContrast: Joi.number().min(0).max(1).default(0.1),
  beamtiltX: Joi.number().default(0.0),
  beamtiltY: Joi.number().default(0.0),

  // Compute settings
  coresPerNode: Joi.number().integer().min(1).default(1),

  // Other node types import
  nodeType: Joi.string().valid('Yes', 'No').default('No'),
  otherNodeType: Joi.string().allow('').default(''),
  otherInputFile: Joi.string().allow('').default(''),

  // Optics
  renameOpticsGroup: Joi.string().allow('').default(''),
  opticsGroupName: Joi.string().allow('').default('opticsGroup1'),

  // Queue submission
  submitToQueue: Joi.alternatives().try(
    Joi.boolean(),
    Joi.string().valid('Yes', 'No')
  ).default('No'),
  queueName: Joi.string().allow('').default(''),
  queueSubmitCommand: Joi.string().allow('').default('sbatch'),
  additionalArguments: Joi.string().allow('').default(''),
  argument: Joi.string().allow('').default(''),
  arguments: Joi.string().allow('').default(''),

  // MPI/threading
  mpiProcs: Joi.number().integer().min(1).default(1),
  numberOfMpiProcs: Joi.number().integer().min(1).default(1),
  numberOfThreads: Joi.number().integer().min(1).default(1),
  gres: Joi.number().integer().min(0).default(0),
  clusterName: Joi.string().allow('').default(''),
  slurmArguments: Joi.string().allow('').default('')
}).custom((value, helpers) => {
  // Custom validation based on import mode
  if (value.nodeType === 'Yes') {
    if (!value.otherInputFile) {
      return helpers.error('any.custom', {
        message: 'Input file is required for other node types'
      });
    }
    if (!value.otherNodeType) {
      return helpers.error('any.custom', {
        message: 'Node type must be selected'
      });
    }
  } else {
    if (!value.inputFiles) {
      return helpers.error('any.custom', {
        message: 'Input files path is required for movies/micrographs import'
      });
    }
  }

  return value;
});

/**
 * Supported node types for import
 */
const NODE_TYPES = {
  '2D references': 'refs2d',
  'Particle coordinates': 'coords',
  '3D reference': 'ref3d',
  '3D mask': 'mask',
  'Unfiltered half-map': 'halfmap'
};

/**
 * Validate import job parameters
 * @param {Object} data - Request body data
 * @returns {{value: Object|null, error: Object|null}}
 */
const validateImportJob = (data) => {
  const result = importJobSchema.validate(data, {
    abortEarly: false,
    allowUnknown: true,
    stripUnknown: false
  });

  if (result.error) {
    return {
      value: null,
      error: {
        message: 'Validation failed',
        details: result.error.details.map(d => ({
          field: d.path.join('.'),
          message: d.message
        }))
      }
    };
  }

  return { value: result.value, error: null };
};

module.exports = {
  importJobSchema,
  validateImportJob,
  NODE_TYPES
};
