/**
 * Post-Processing Job Builder
 *
 * Builds RELION post-processing commands.
 * Matches Python postprocess_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class PostProcessBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'PostProcess';
  }

  // Post-processing is CPU-only, no MPI support
  get supportsGpu() {
    return false;
  }

  get supportsMpi() {
    return false;
  }

  /**
   * Derive the other half-map path from a half-map.
   * Works whether user selects half1 or half2.
   * Returns [half1_path, half2_path] tuple.
   */
  _deriveOtherHalf(halfMap) {
    // Check for half2 pattern first (user selected half2)
    if (halfMap.includes('_half2_')) {
      const half1 = halfMap.replace('_half2_', '_half1_');
      return [half1, halfMap];
    } else if (halfMap.includes('half2')) {
      const half1 = halfMap.replace('half2', 'half1');
      return [half1, halfMap];
    }
    // Check for half1 pattern (user selected half1)
    else if (halfMap.includes('_half1_')) {
      const half2 = halfMap.replace('_half1_', '_half2_');
      return [halfMap, half2];
    } else if (halfMap.includes('half1')) {
      const half2 = halfMap.replace('half1', 'half2');
      return [halfMap, half2];
    }
    return [null, null];
  }

  validate() {
    // Support both 'halfMap' (single input, auto-derive second) and 'halfMap1'/'halfMap2' (explicit)
    let halfMap1 = getParam(this.data, ['halfMap1'], '');
    let halfMap2 = getParam(this.data, ['halfMap2'], '');
    const inputHalfMap = getParam(this.data, ['halfMap'], '');

    // If only halfMap provided, derive both half1 and half2 from naming convention
    if (inputHalfMap && !halfMap1 && !halfMap2) {
      [halfMap1, halfMap2] = this._deriveOtherHalf(inputHalfMap);
      if (halfMap1 && halfMap2) {
        this.data.halfMap1 = halfMap1;
        this.data.halfMap2 = halfMap2;
        logger.info(`[PostProcess] Derived half-maps: half1=${halfMap1}, half2=${halfMap2}`);
      }
    }

    if (!halfMap1) {
      logger.warn('[PostProcess] Validation: Failed | halfMap1/halfMap is required');
      return { valid: false, error: 'First half-map is required' };
    }

    if (!halfMap2) {
      logger.warn('[PostProcess] Validation: Failed | Could not derive halfMap2 from halfMap1');
      return { valid: false, error: 'Second half-map is required (could not auto-derive from first half-map name)' };
    }

    let result = this.validateFileExists(halfMap1, 'Half-map 1');
    if (!result.valid) {
      return result;
    }

    result = this.validateFileExists(halfMap2, 'Half-map 2');
    if (!result.valid) {
      return result;
    }

    logger.info(`[PostProcess] Validation: Passed | halfMap1: ${halfMap1}, halfMap2: ${halfMap2}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;

    logger.info(`[PostProcess] Command: Building | job_name: ${jobName}`);

    const relOutputDir = this.makeRelative(outputDir);

    // Get half-maps (validation already set them in this.data)
    const halfMap1 = getParam(data, ['halfMap1'], null);
    const halfMap2 = getParam(data, ['halfMap2'], null);

    // Build command — resolve and relativize all input paths for consistency
    const cmd = [
      'relion_postprocess',
      '--i', this.makeRelative(this.resolveInputPath(halfMap1)),
      '--i2', this.makeRelative(this.resolveInputPath(halfMap2)),
      '--o', path.join(relOutputDir, 'postprocess'),
      '--angpix', String(getFloatParam(data, ['calibratedPixelSize'], 1.0)),
    ];

    // Masking options — explicit mask and auto_mask are mutually exclusive
    const solventMask = getParam(data, ['solventMask'], null);
    if (solventMask) {
      cmd.push('--mask', this.makeRelative(this.resolveInputPath(solventMask)));
    } else if (getBoolParam(data, ['autoMask'], false)) {
      cmd.push('--auto_mask');
      cmd.push('--inimask_threshold', String(getFloatParam(data, ['initialMaskThreshold'], 0.02)));
      cmd.push('--extend_inimask', String(getFloatParam(data, ['extendMaskBinaryMap'], 3)));
      cmd.push('--width_mask_edge', String(getFloatParam(data, ['addMaskEdge'], 6)));
    }

    // B-factor sharpening
    // Frontend sends 'bFactor' ("Yes"/"No") for auto-B toggle
    if (getBoolParam(data, ['bFactor'], true)) {
      cmd.push('--auto_bfac');
      cmd.push('--autob_lowres', String(getFloatParam(data, ['lowestResolution'], 10)));
      cmd.push('--autob_highres', String(getFloatParam(data, ['highestResolution'], 0)));
    } else {
      cmd.push('--adhoc_bfac', String(getFloatParam(data, ['providedBFactor'], 0)));
    }

    // MTF correction
    // Frontend sends 'mtfDetector' for MTF file path
    const mtfFile = getParam(data, ['mtfDetector'], null);
    if (mtfFile) {
      cmd.push('--mtf', this.makeRelative(this.resolveInputPath(mtfFile)));
    }

    // Original detector pixel size for MTF correction
    const mtfAngpix = getFloatParam(data, ['originalDetector'], -1);
    if (mtfAngpix > 0) {
      cmd.push('--mtf_angpix', String(mtfAngpix));
    }

    // Low-pass filter
    // Frontend sends 'skipFSC' ("Yes"/"No") for skip FSC toggle
    if (getBoolParam(data, ['skipFSC'], false)) {
      cmd.push('--skip_fsc_weighting');
      cmd.push('--low_pass', String(getFloatParam(data, ['adHoc'], 5)));
    }

    // Local resolution estimation
    if (getBoolParam(data, ['estimateLocalResolution'], false)) {
      cmd.push('--locres');
      cmd.push('--locres_sampling', String(getFloatParam(data, ['localResSampling'], 25)));
      cmd.push('--locres_minres', String(getFloatParam(data, ['localResMinRes'], 50)));
    }

    // Pipeline control
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[PostProcess] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[PostProcess] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = PostProcessBuilder;
