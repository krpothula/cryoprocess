/**
 * DynaMight Flexibility Job Builder
 *
 * Builds DynaMight commands for flexibility analysis.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getParam
} = require('../utils/paramHelper');

class DynamightBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Dynamight';
  }

  // DynaMight uses GPU for flexibility analysis
  get supportsGpu() {
    return true;
  }

  validate() {
    const inputFile = getParam(this.data, ['micrographs', 'input_file', 'inputFile'], null);
    if (!inputFile) {
      return { valid: false, error: 'Input micrographs/particles file is required' };
    }

    logger.info(`[Dynamight] Validation passed | input: ${inputFile}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const inputFile = getParam(data, ['micrographs', 'input_file', 'inputFile'], null);

    // Get MPI and thread settings using paramHelper
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);

    // Determine if GPU is used
    const gpuEnabled = isGpuEnabled(data);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    cmd.push('--i', this.makeRelative(this.resolveInputPath(inputFile)));
    cmd.push('--o', path.join(relOutputDir, 'run'));
    cmd.push('--auto_refine');
    cmd.push('--split_random_halves');
    cmd.push('--healpix_order', '2');
    cmd.push('--auto_local_healpix_order', '4');
    cmd.push('--flatten_solvent');
    cmd.push('--norm');
    cmd.push('--scale');
    cmd.push('--oversampling', '1');
    cmd.push('--pad', '2');
    cmd.push('--low_resol_join_halves', '40');
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // GPU acceleration
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Dynamight] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = DynamightBuilder;
