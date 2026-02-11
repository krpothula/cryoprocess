/**
 * Multi-Body Refinement Job Builder
 *
 * Builds RELION relion_refine commands for multi-body analysis.
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
      return { valid: false, error: 'Refinement STAR file is required' };
    }

    logger.info(`[MultiBody] Validation passed | input: ${refinementStar}`);
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

    cmd.push('--i', this.makeRelative(this.resolveInputPath(refinementStar)));
    cmd.push('--o', path.join(relOutputDir, 'run'));
    cmd.push('--auto_refine');
    cmd.push('--split_random_halves');
    cmd.push('--healpix_order', '2');
    cmd.push('--offset_range', String(getFloatParam(data, ['offsetSearchRange', 'offset_search_range'], 5)));
    cmd.push('--offset_step', String(getFloatParam(data, ['offsetStep', 'offset_step'], 0.75)));
    cmd.push('--auto_local_healpix_order', '4');
    cmd.push('--flatten_solvent');
    cmd.push('--norm');
    cmd.push('--scale');
    cmd.push('--oversampling', '1');
    cmd.push('--pool', String(pooled));
    cmd.push('--pad', '2');
    cmd.push('--low_resol_join_halves', '40');
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir);

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
    if (!getBoolParam(data, ['combineIterations', 'combine_iterations'], true)) {
      cmd.push('--dont_combine_weights_via_disc');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[MultiBody] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = MultibodyBuilder;
