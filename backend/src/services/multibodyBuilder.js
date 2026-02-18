/**
 * Multi-Body Refinement Job Builder
 *
 * Builds RELION relion_refine commands for multi-body refinement.
 * Multi-body refinement is a continuation of a completed auto-refine job,
 * using --continue with the optimiser STAR file and --multibody_masks
 * with a body definition STAR file.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class MultibodyBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'MultiBody';
  }

  validate() {
    const refinementStar = getParam(this.data, ['refinementStarFile'], null);
    if (!refinementStar) {
      return { valid: false, error: 'Refinement optimiser STAR file is required' };
    }

    const bodyMasks = getParam(this.data, ['bodyStarFile'], null);
    if (!bodyMasks) {
      return { valid: false, error: 'Multi-body masks STAR file is required' };
    }

    logger.info(`[MultiBody] Validation passed | input: ${refinementStar}, masks: ${bodyMasks}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    // Get MPI and thread settings using paramHelper
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);
    const pooled = getIntParam(data, ['pooledParticles', 'numberOfPooledParticle'], 3);

    // Determine if GPU is used
    const gpuEnabled = isGpuEnabled(data);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    const refinementStar = getParam(data, ['refinementStarFile'], null);
    const bodyMasks = getParam(data, ['bodyStarFile'], null);

    // Multi-body refinement uses --continue (not --i) with a completed auto-refine optimiser
    cmd.push('--continue', this.makeRelative(this.resolveInputPath(refinementStar)));
    cmd.push('--o', path.join(relOutputDir, 'run'));

    // Multi-body masks STAR file (required for multi-body mode)
    cmd.push('--multibody_masks', this.makeRelative(this.resolveInputPath(bodyMasks)));

    // Reconstruct subtracted bodies (recommended)
    if (getBoolParam(data, ['reconstructSubtracted'], true)) {
      cmd.push('--reconstruct_subtracted_bodies');
    }

    // Solvent-correct FSC (recommended for multi-body)
    if (getBoolParam(data, ['solventCorrectFsc'], true)) {
      cmd.push('--solvent_correct_fsc');
    }

    cmd.push('--healpix_order', String(getIntParam(data, ['healpixOrder'], 4)));
    cmd.push('--offset_range', String(getFloatParam(data, ['offsetSearchRange', 'initialOffsetRange'], 3)));
    cmd.push('--offset_step', String(getFloatParam(data, ['offsetStep', 'initialOffsetStep'], 1.5)));
    cmd.push('--auto_local_healpix_order', '4');
    cmd.push('--oversampling', '1');
    cmd.push('--pool', String(pooled));
    cmd.push('--pad', '2');
    cmd.push('--dont_combine_weights_via_disc');
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Optional flags
    if (getBoolParam(data, ['blushRegularisation'], false)) {
      cmd.push('--blush');
    }

    // GPU acceleration flags
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // I/O options
    if (!getBoolParam(data, ['useParallelIO', 'Useparalleldisc'], true)) {
      cmd.push('--no_parallel_disc_io');
    }

    // Pre-read images into RAM
    if (getBoolParam(data, ['preReadAllParticles'], false)) {
      cmd.push('--preread_images');
    }

    // Scratch directory
    const scratchDir = getParam(data, ['copyParticle'], null);
    if (scratchDir) {
      cmd.push('--scratch_dir', scratchDir);
    }

    // Skip gridding
    if (getBoolParam(data, ['skipPadding'], false)) {
      cmd.push('--skip_gridding');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    // Flexibility analysis (chained after refinement)
    if (getBoolParam(data, ['runFlexibility'], false)) {
      cmd.push('&&');
      cmd.push('relion_flex_analyse');
      cmd.push('--PCA_orient', relOutputDir + path.sep);
      cmd.push('--o', relOutputDir + path.sep);

      const nrMovies = getIntParam(data, ['numberOfEigenvectorMovies'], 3);
      if (nrMovies > 0) {
        cmd.push('--do_movies', String(nrMovies));
      }

      // Eigenvalue-based particle selection
      if (getBoolParam(data, ['selectParticlesEigenValue'], false)) {
        const eigenVal = getIntParam(data, ['eigenValue'], 1);
        cmd.push('--select_eigenvalue', String(eigenVal));

        const minEigen = getFloatParam(data, ['minEigenValue'], -999);
        const maxEigen = getFloatParam(data, ['maxEigenValue'], 999);
        cmd.push('--select_eigenvalue_min', String(minEigen));
        cmd.push('--select_eigenvalue_max', String(maxEigen));
      }

      cmd.push('--pipeline_control', relOutputDir + path.sep);
    }

    logger.info(`[MultiBody] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = MultibodyBuilder;
