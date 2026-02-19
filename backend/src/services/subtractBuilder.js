/**
 * Particle Subtraction Job Builder
 *
 * Builds RELION relion_particle_subtract commands for signal subtraction.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class SubtractBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Subtract';
  }

  // Particle subtraction is CPU-only
  get supportsGpu() {
    return false;
  }

  // relion_particle_subtract is NOT an MPI command
  get supportsMpi() {
    return false;
  }

  validate() {
    const optimiserStar = getParam(this.data, ['optimiserStar'], null);
    if (!optimiserStar) {
      return { valid: false, error: 'Optimiser STAR file is required' };
    }

    const maskOfSignal = getParam(this.data, ['maskOfSignal'], null);
    if (!maskOfSignal) {
      return { valid: false, error: 'Mask of signal to be subtracted is required' };
    }

    logger.info(`[Subtract] Validation passed | input: ${optimiserStar}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const optimiserStar = getParam(data, ['optimiserStar'], null);
    const maskOfSignal = getParam(data, ['maskOfSignal'], null);

    const cmd = [
      'relion_particle_subtract',
      '--i', this.makeRelative(this.resolveInputPath(optimiserStar)),
      '--mask', this.makeRelative(this.resolveInputPath(maskOfSignal)),
      '--o', relOutputDir,
      '--new_box', String(getIntParam(data, ['newBoxSize'], -1))
    ];

    // Optional flags
    if (getBoolParam(data, ['outputInFloat16'], false)) {
      cmd.push('--float16');
    }

    if (getBoolParam(data, ['differentParticles'], false)) {
      const inputParticleStar = getParam(data, ['inputParticlesStar'], null);
      if (inputParticleStar) {
        cmd.push('--data', this.makeRelative(this.resolveInputPath(inputParticleStar)));
      }
    }

    if (getBoolParam(data, ['subtractedImages'], false)) {
      cmd.push('--recenter_on_mask');
    }

    if (getBoolParam(data, ['centerCoordinates'], false)) {
      cmd.push('--center_x', String(getFloatParam(data, ['coordinateX'], 0)));
      cmd.push('--center_y', String(getFloatParam(data, ['coordinateY'], 0)));
      cmd.push('--center_z', String(getFloatParam(data, ['coordinateZ'], 0)));
    }

    if (getBoolParam(data, ['revertToOriginal'], false)) {
      const revertFile = getParam(data, ['revertParticles'], '');
      if (revertFile) {
        cmd.push('--revert', this.makeRelative(this.resolveInputPath(revertFile)));
      }
    }

    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Subtract] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = SubtractBuilder;
