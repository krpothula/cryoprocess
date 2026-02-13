/**
 * Bayesian Polishing Job Builder
 *
 * Builds RELION relion_motion_refine commands for per-particle motion correction.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class PolishBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Polish';
  }

  // Bayesian polishing is CPU-only (no GPU support)
  get supportsGpu() {
    return false;
  }

  validate() {
    const inputParticles = getParam(this.data, ['particlesFile'], null);
    let result = this.validateFileExists(inputParticles, 'Input particles STAR file');
    if (!result.valid) {
      return result;
    }

    const inputMovies = getParam(this.data, ['micrographsFile'], null);
    result = this.validateFileExists(inputMovies, 'Input movies STAR file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[Polish] Validation passed | input: ${inputParticles}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    // Get MPI and thread settings using paramHelper
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);

    // Bayesian polishing is CPU-only (no GPU support)
    const gpuEnabled = false;

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_motion_refine', mpiProcs, gpuEnabled);

    // Core arguments
    const inputParticles = getParam(data, ['particlesFile'], null);
    cmd.push('--i', this.makeRelative(this.resolveInputPath(inputParticles)));
    cmd.push('--o', relOutputDir + path.sep);

    // Corrected micrographs
    const inputMovies = getParam(data, ['micrographsFile'], null);
    if (inputMovies) {
      cmd.push('--corr_mic', this.makeRelative(this.resolveInputPath(inputMovies)));
    }

    // PostProcess FSC file
    const postprocessStar = getParam(data, ['postProcessStarFile'], null);
    if (postprocessStar) {
      cmd.push('--f', this.makeRelative(this.resolveInputPath(postprocessStar)));
    }

    // Frame range
    cmd.push('--first_frame', String(getIntParam(data, ['firstMovieFrame'], 1)));
    cmd.push('--last_frame', String(getIntParam(data, ['lastMovieFrame'], -1)));

    // Extraction/rescaling options
    const extractSize = getIntParam(data, ['extractionSize'], -1);
    if (extractSize > 0) {
      cmd.push('--window', String(extractSize));
    }
    const rescaleSize = getIntParam(data, ['rescaledSize'], -1);
    if (rescaleSize > 0) {
      cmd.push('--scale', String(rescaleSize));
    }

    // Float16 output (default false — consistent with other builders; float16 reduces precision)
    if (getBoolParam(data, ['float16'], false)) {
      cmd.push('--float16');
    }

    // Motion sigma parameters
    if (getBoolParam(data, ['trainOptimalBfactors'], false)) {
      cmd.push('--params3');
      const fractionFourier = getFloatParam(data, ['fractionFourierPixels'], 0.5);
      cmd.push('--align_frac', String(fractionFourier));
      cmd.push('--eval_frac', String(fractionFourier));
      const minParticles = getIntParam(data, ['useParticles'], 10000);
      if (minParticles > 0) {
        cmd.push('--min_p', String(minParticles));
      }
    } else {
      cmd.push('--s_vel', String(getFloatParam(data, ['sigmaVelocity'], 0.2)));
      cmd.push('--s_div', String(getFloatParam(data, ['sigmaDivergence'], 5000)));
      cmd.push('--s_acc', String(getFloatParam(data, ['sigmaAcceleration'], 2)));

      // Combine frames for polished particles (only in polish mode, not training)
      if (getBoolParam(data, ['performBfactorWeighting'], true)) {
        cmd.push('--combine_frames');
        cmd.push('--bfac_minfreq', String(getFloatParam(data, ['minResolutionBfac'], 20)));
        const maxRes = getFloatParam(data, ['maxResolutionBfac'], -1);
        if (maxRes > 0) {
          cmd.push('--bfac_maxfreq', String(maxRes));
        }
      }
    }

    // Threads
    cmd.push('--j', String(threads));

    // Pipeline control
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Polish] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = PolishBuilder;
