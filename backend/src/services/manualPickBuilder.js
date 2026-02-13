/**
 * Manual Picking Job Builder
 *
 * Builds RELION relion_manualpick commands for interactive particle picking.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class ManualPickBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'ManualPick';
  }

  // Manual picking is CPU-only
  get supportsGpu() {
    return false;
  }

  validate() {
    const inputMicrographs = getParam(this.data, ['inputMicrographs'], null);
    if (!inputMicrographs) {
      return { valid: false, error: 'Input micrographs STAR file is required' };
    }

    logger.info(`[ManualPick] Validation passed | input: ${inputMicrographs}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const inputMicrographs = getParam(data, ['inputMicrographs'], null);

    const cmd = [
      'relion_manualpick',
      '--i', this.makeRelative(this.resolveInputPath(inputMicrographs)),
      '--odir', relOutputDir,
      '--allow_save',
      '--fast_save',
      '--selection', path.join(relOutputDir, 'micrographs_selected.star'),
      '--particle_diameter', String(getFloatParam(data, ['particleDiameter'], 100)),
      '--scale', String(getFloatParam(data, ['scaleForMicrographs'], 0.2)),
      '--sigma_contrast', String(getFloatParam(data, ['sigmaContrast'], 3)),
      '--black', String(getFloatParam(data, ['blackValue'], 0)),
      '--white', String(getFloatParam(data, ['whiteValue'], 0)),
      '--pipeline_control', relOutputDir + path.sep
    ];

    // I/O tab options
    if (getBoolParam(data, ['pickCoordinatesHelices'], false)) {
      cmd.push('--pick_start_end');
    }
    if (getBoolParam(data, ['useAutopickThreshold'], false)) {
      cmd.push('--minimum_pick_fom', String(getFloatParam(data, ['autopickFOM'], 0)));
    }

    // Display tab options
    if (getBoolParam(data, ['useTopaz'], false)) {
      cmd.push('--topaz_denoise');
    }

    // Colors tab
    if (getBoolParam(data, ['blueRedColorParticles'], false)) {
      cmd.push('--color_label', getParam(data, ['metadataLabel'], 'rlnAutopickFigureOfMerit'));
      const starfileWithColor = getParam(data, ['starfileWithColorLabel'], null);
      if (starfileWithColor) {
        cmd.push('--color_star', starfileWithColor);
      }
      cmd.push('--blue', String(getFloatParam(data, ['blueValue'], 0)));
      cmd.push('--red', String(getFloatParam(data, ['redValue'], 2)));
    }

    logger.info(`[ManualPick] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = ManualPickBuilder;
