/**
 * 2D Classification Job Builder
 *
 * Builds RELION 2D classification commands.
 * Matches Python class2d_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getInputStarFile,
  getContinueFrom,
  getMaskDiameter,
  getNumberOfClasses,
  getIterations,
  getPooledParticles,
  getScratchDir,
  getIntParam,
  getFloatParam,
  getBoolParam
} = require('../utils/paramHelper');

class Class2DBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Class2D';
  }

  validate() {
    const inputStar = getInputStarFile(this.data);
    const continueFrom = getContinueFrom(this.data);

    // If continuing from an optimiser file, validate that instead
    if (continueFrom) {
      const result = this.validateFileExists(continueFrom, 'Continue from file');
      if (!result.valid) {
        return result;
      }
      logger.info(`[Class2D] Validation: Passed | continueFrom: ${continueFrom}`);
      return { valid: true, error: null };
    }

    // Otherwise require input star file
    if (!inputStar) {
      logger.warn('[Class2D] Validation: Failed | inputStarFile is required');
      return { valid: false, error: 'Input star file is required' };
    }

    const result = this.validateFileExists(inputStar, 'Input STAR file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[Class2D] Validation: Passed | inputStarFile: ${inputStar}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const continueFrom = getContinueFrom(data);

    logger.info(`[Class2D] Command: Building | job_name: ${jobName}`);

    // Get parameters using paramHelper (handles all naming variations)
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);
    const pooled = getPooledParticles(data, 3);
    const gpuEnabled = isGpuEnabled(data);

    logger.debug(`[Class2D] Parameters: mpi=${mpiProcs}, threads=${threads}, gpu=${gpuEnabled}`);

    // Compute relative output directory for RELION
    const relOutputDir = this.makeRelative(outputDir);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    // Get parameters using paramHelper for consistent naming
    // When VDAM is enabled, --iter = number of VDAM mini-batches (default 200)
    // When EM, --iter = number of EM iterations (default 25)
    const useVDAM = getBoolParam(data, ['useVDAM'], true);
    const skipAlign = !getBoolParam(data, ['performImageAlignment'], true);
    const iterations = useVDAM
      ? getIntParam(data, ['vdamMiniBatches'], 200)
      : getIterations(data, 25);
    const regularisation = getFloatParam(data, ['regularisationParam'], 2);
    const offsetRange = getIntParam(data, ['offsetSearchRange'], 5);
    const offsetStep = getIntParam(data, ['offsetSearchStep'], 1);

    // If continuing from an optimiser file, use --continue instead of --i
    if (continueFrom) {
      logger.info(`[Class2D] Continuing from optimiser file: ${continueFrom}`);
      cmd.push('--o', relOutputDir + path.sep);
      cmd.push('--continue', continueFrom);
      cmd.push('--dont_combine_weights_via_disc');
      cmd.push('--pool', String(pooled));
      cmd.push('--j', String(threads));
      cmd.push('--pipeline_control', relOutputDir + path.sep);
    } else {
      const inputStar = data.inputStarFile;
      const relInput = this.makeRelative(this.resolveInputPath(inputStar));

      cmd.push('--o', relOutputDir + path.sep);
      cmd.push('--i', relInput);

      // Combine iterations through disc (default: No → add --dont_combine_weights_via_disc)
      if (!getBoolParam(data, ['combineIterations'], false)) {
        cmd.push('--dont_combine_weights_via_disc');
      }

      cmd.push('--pool', String(pooled));
      cmd.push('--pad', '2');

      // CTF correction (default: Yes)
      if (getBoolParam(data, ['ctfCorrection'], true)) {
        cmd.push('--ctf');
      }

      cmd.push('--iter', String(iterations));
      cmd.push('--tau2_fudge', String(regularisation));
      cmd.push('--particle_diameter', String(getMaskDiameter(data, 200)));
      cmd.push('--K', String(getNumberOfClasses(data, 1)));
      cmd.push('--flatten_solvent');

      if (skipAlign) {
        // Skip alignment mode: omit alignment-related flags
        cmd.push('--skip_align');
      } else {
        // Normal mode: include alignment flags
        if (getBoolParam(data, ['maskParticlesWithZeros'], true)) {
          cmd.push('--zero_mask');
        }
        if (getBoolParam(data, ['centerClassAverages'], true)) {
          cmd.push('--center_classes');
        }
        cmd.push('--oversampling', '1');
        cmd.push('--psi_step', String(getFloatParam(data, ['angularSearchRange'], 6)));
        cmd.push('--offset_range', String(offsetRange));
        cmd.push('--offset_step', String(offsetStep));

        // Allow coarser sampling in early iterations
        if (getBoolParam(data, ['allowCoarseSampling'], false)) {
          cmd.push('--allow_coarser_sampling');
        }
      }

      cmd.push('--norm');
      cmd.push('--scale');
      cmd.push('--j', String(threads));
      cmd.push('--pipeline_control', relOutputDir + path.sep);
    }

    // The following options only apply to new jobs, not when continuing
    if (!continueFrom) {
      // CTF options
      if (getBoolParam(data, ['ignoreCTFs'], false)) {
        cmd.push('--ctf_intact_first_peak');
      }

      // VDAM options (enabled by default)
      if (useVDAM) {
        cmd.push('--grad');
        cmd.push('--class_inactivity_threshold', '0.1');
        cmd.push('--grad_write_iter', '10');
      }

      // Limit resolution for E-step
      const limitResEStep = getFloatParam(data, ['limitResolutionEStep'], -1);
      if (limitResEStep > 0) {
        cmd.push('--strict_highres_exp', String(limitResEStep));
      }

      // Helical options
      if (getBoolParam(data, ['classify2DHelical'], false)) {
        cmd.push('--helical_outer_diameter', String(getFloatParam(data, ['tubeDiameter'], 200)));

        if (getBoolParam(data, ['doBimodalAngular'], false)) {
          cmd.push('--bimodal_psi');
        }

        cmd.push('--helical_rise', String(getFloatParam(data, ['helicalRise'], 4.75)));

        if (getBoolParam(data, ['restrictHelicalOffsets'], false)) {
          cmd.push('--helical_offset_step', String(offsetStep));
        }
      }
    }

    // GPU acceleration
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
      logger.info(`[Class2D] GPU enabled: --gpu ${gpuIds}`);
    }

    // Parallel I/O
    if (!getBoolParam(data, ['useParallelIO'], true)) {
      cmd.push('--no_parallel_disc_io');
    }

    if (getBoolParam(data, ['preReadAllParticles'], false)) {
      cmd.push('--preread_images');
    }

    const scratchDir = getScratchDir(data);
    if (scratchDir) {
      cmd.push('--scratch_dir', scratchDir);
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Class2D] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Class2D] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = Class2DBuilder;
