/**
 * Local Resolution Job Builder
 *
 * Builds RELION relion_postprocess --locres commands for local resolution estimation.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getAngpix,
  getFloatParam,
  getParam
} = require('../utils/paramHelper');

class LocalResolutionBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'LocalRes';
  }

  // Local resolution estimation is CPU-only
  get supportsGpu() {
    return false;
  }

  validate() {
    const halfMap = getParam(this.data, ['halfMap'], null);
    let result = this.validateFileExists(halfMap, 'Half map');
    if (!result.valid) {
      return result;
    }

    const solventMask = getParam(this.data, ['solventMask'], null);
    if (!solventMask) {
      return { valid: false, error: 'Solvent mask is required' };
    }

    logger.info(`[LocalResolution] Validation passed | input: ${halfMap}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const halfMap = getParam(data, ['halfMap'], null);
    const solventMask = getParam(data, ['solventMask'], null);
    const pixelSize = getAngpix(data, 1);

    const cmd = [
      'relion_postprocess',
      '--locres',
      '--i', this.makeRelative(this.resolveInputPath(halfMap)),
      '--mask', this.makeRelative(this.resolveInputPath(solventMask)),
      '--angpix', String(pixelSize),
      '--adhoc_bfac', String(getFloatParam(data, ['bFactor'], -100)),
      '--o', path.join(relOutputDir, 'relion'),
      '--pipeline_control', relOutputDir + path.sep
    ];

    // MTF file
    const mtfFile = getParam(data, ['mtfDetector'], null);
    if (mtfFile) {
      cmd.push('--mtf', this.makeRelative(this.resolveInputPath(mtfFile)));
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[LocalResolution] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = LocalResolutionBuilder;
