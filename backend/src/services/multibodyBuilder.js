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
    const refinementStar = getParam(this.data, ['refinementStarFile', 'refinement_star_file'], null);
    if (!refinementStar) {
      return { valid: false, error: 'Refinement optimiser STAR file is required' };
    }

    const bodyMasks = getParam(this.data, ['multibodyMasks', 'multibody_masks', 'bodyMasks', 'body_masks'], null);
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
    const pooled = getIntParam(data, ['numberOfPooledParticle', 'pooledParticles', 'pooled_particles'], 3);

    // Determine if GPU is used
    const gpuEnabled = isGpuEnabled(data);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    const refinementStar = getParam(data, ['refinementStarFile', 'refinement_star_file'], null);
    const bodyMasks = getParam(data, ['multibodyMasks', 'multibody_masks', 'bodyMasks', 'body_masks'], null);

    // Multi-body refinement uses --continue (not --i) with a completed auto-refine optimiser
    cmd.push('--continue', this.makeRelative(this.resolveInputPath(refinementStar)));
    cmd.push('--o', path.join(relOutputDir, 'run'));

    // Multi-body masks STAR file (required for multi-body mode)
    cmd.push('--multibody_masks', this.makeRelative(this.resolveInputPath(bodyMasks)));

    // Reconstruct subtracted bodies (recommended)
    if (getBoolParam(data, ['reconstructSubtractedBodies', 'reconstruct_subtracted_bodies'], true)) {
      cmd.push('--reconstruct_subtracted_bodies');
    }

    // Solvent-correct FSC (recommended for multi-body)
    if (getBoolParam(data, ['solventCorrectFsc', 'solvent_correct_fsc'], true)) {
      cmd.push('--solvent_correct_fsc');
    }

    cmd.push('--healpix_order', String(getIntParam(data, ['healpixOrder', 'healpix_order'], 4)));
    cmd.push('--offset_range', String(getFloatParam(data, ['offsetSearchRange', 'offset_search_range'], 3)));
    cmd.push('--offset_step', String(getFloatParam(data, ['offsetStep', 'offset_step'], 1.5)));
    cmd.push('--auto_local_healpix_order', '4');
    cmd.push('--oversampling', '1');
    cmd.push('--pool', String(pooled));
    cmd.push('--pad', '2');
    cmd.push('--dont_combine_weights_via_disc');
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Optional flags
    if (getBoolParam(data, ['useBlushRegularisation', 'use_blush_regularisation'], false)) {
      cmd.push('--blush');
    }

    // GPU acceleration flags
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // I/O options
    if (!getBoolParam(data, ['Useparalleldisc', 'useParallelIO', 'use_parallel_io'], true)) {
      cmd.push('--no_parallel_disc_io');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[MultiBody] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = MultibodyBuilder;
