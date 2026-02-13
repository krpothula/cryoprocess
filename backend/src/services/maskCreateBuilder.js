/**
 * Mask Creation Job Builder
 *
 * Builds RELION relion_mask_create commands for generating solvent masks.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getAngpix,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class MaskCreateBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'MaskCreate';
  }

  // Mask creation is CPU-only
  get supportsGpu() {
    return false;
  }

  // relion_mask_create is NOT an MPI command
  get supportsMpi() {
    return false;
  }

  validate() {
    const inputMap = getParam(this.data, ['inputMap'], null);
    const result = this.validateFileExists(inputMap, 'Input map');
    if (!result.valid) {
      return result;
    }

    logger.info(`[MaskCreate] Validation passed | input: ${inputMap}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const inputMap = getParam(data, ['inputMap'], null);

    const cmd = [
      'relion_mask_create',
      '--i', this.makeRelative(this.resolveInputPath(inputMap)),
      '--o', path.join(relOutputDir, 'mask.mrc'),
      '--ini_threshold', String(getFloatParam(data, ['initialThreshold'], 0.004)),
      '--extend_inimask', String(getFloatParam(data, ['extendBinaryMask'], 3)),
      '--width_soft_edge', String(getFloatParam(data, ['softEdgeWidth'], 6))
    ];

    // Pixel size (only if not -1)
    const angpix = getAngpix(data, -1);
    if (angpix > 0) {
      cmd.push('--angpix', String(angpix));
    }

    // Lowpass filter
    const lowpass = getFloatParam(data, ['lowpassFilter'], 15);
    if (lowpass > 0) {
      cmd.push('--lowpass', String(lowpass));
    }

    // Invert mask
    if (getBoolParam(data, ['invertMask'], false)) {
      cmd.push('--invert');
    }

    // Fill with spheres (for helical)
    if (getBoolParam(data, ['fillWithSpheres'], false)) {
      cmd.push('--fill');
      cmd.push('--sphere_radius', String(getFloatParam(data, ['sphereRadius'], 10)));
    }

    // Pipeline control
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[MaskCreate] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = MaskCreateBuilder;
