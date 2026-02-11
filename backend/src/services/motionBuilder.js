/**
 * Motion Correction Job Builder
 *
 * Builds RELION MotionCorr commands.
 * Matches Python motion_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const { isPathSafe } = require('../utils/security');
const {
  getMpiProcs,
  getThreads,
  getGpuIds,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class MotionCorrectionBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'MotionCorr';
  }

  /**
   * GPU is only supported when using MotionCor2 (not RELION's own implementation).
   * RELION's own motion correction is CPU-only.
   */
  get supportsGpu() {
    // GPU is used when NOT using RELION's own implementation
    return !getBoolParam(this.data, ['useRelionImplementation', 'use_own'], true);
  }

  validate() {
    // Require input STAR file (accept multiple field names from frontend)
    const inputMovies = getParam(this.data, ['inputMovies', 'input_star_file', 'inputStarFile'], null);
    if (!inputMovies) {
      logger.warn('[Motion] Validation: Failed | inputMovies is required');
      return { valid: false, error: 'Input movies STAR file is required' };
    }

    const result = this.validateFileExists(inputMovies, 'Input movies STAR file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[Motion] Validation: Passed | inputMovies: ${inputMovies}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const relOutputDir = this.makeRelative(outputDir);

    logger.info(`[Motion] Command: Building | job_name: ${jobName}`);

    // Get input movies STAR file
    const inputMovies = getParam(data, ['inputMovies', 'input_star_file', 'inputStarFile'], null);
    const relInput = this.makeRelative(this.resolveInputPath(inputMovies));

    // Determine EER grouping value
    const eerGrouping = getIntParam(data, ['eerFractionation', 'eerGrouping', 'groupFrames'], 32);

    // Check if MPI should be used (more than 1 process)
    const mpiProcs = getMpiProcs(data);

    // GPU is only used with MotionCor2, not RELION's own implementation
    const gpuEnabled = !getBoolParam(data, ['useRelionImplementation', 'use_own'], true);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_run_motioncorr', mpiProcs, gpuEnabled);

    // Add required parameters
    cmd.push('--i', relInput);
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--first_frame_sum', String(getIntParam(data, ['firstFrame', 'first_frame_sum'], 1)));
    cmd.push('--last_frame_sum', String(getIntParam(data, ['lastFrame', 'last_frame_sum'], -1)));
    cmd.push('--bin_factor', String(getIntParam(data, ['binningFactor', 'bin_factor'], 1)));
    cmd.push('--bfactor', String(getIntParam(data, ['bfactor'], 150)));
    cmd.push('--dose_per_frame', String(getFloatParam(data, ['dosePerFrame', 'dose_per_frame'], 1.0)));
    cmd.push('--preexposure', String(getFloatParam(data, ['preExposure', 'pre_exposure'], 0.0)));
    cmd.push('--patch_x', String(getIntParam(data, ['patchesX', 'patch_x'], 1)));
    cmd.push('--patch_y', String(getIntParam(data, ['patchesY', 'patch_y'], 1)));
    cmd.push('--eer_grouping', String(eerGrouping));
    cmd.push('--pipeline_control', path.resolve(outputDir) + path.sep);

    // Add gain reference if provided
    const gainRef = getParam(data, ['gainReferenceImage', 'gainReference', 'gain_reference'], null);
    if (gainRef && gainRef.trim()) {
      cmd.push('--gainref', gainRef);

      // Gain rotation
      let gainRotation = getParam(data, ['gainRotation', 'gain_rot'], 'No rotation (0)');
      const rotationMap = {
        'No rotation (0)': '0',
        '90 degrees (1)': '1',
        '180 degrees (2)': '2',
        '270 degrees (3)': '3',
      };
      // Handle both string descriptions and numeric values
      let rotationVal = '0';
      if (typeof gainRotation === 'string') {
        if (rotationMap[gainRotation]) {
          rotationVal = rotationMap[gainRotation];
        } else if (gainRotation.includes('90')) {
          rotationVal = '1';
        } else if (gainRotation.includes('180')) {
          rotationVal = '2';
        } else if (gainRotation.includes('270')) {
          rotationVal = '3';
        }
      } else {
        rotationVal = String(gainRotation);
      }
      if (rotationVal !== '0') {
        cmd.push('--gain_rot', rotationVal);
      }

      // Gain flip
      let gainFlip = getParam(data, ['gainFlip', 'gain_flip'], 'No flipping (0)');
      const flipMap = {
        'No flipping (0)': '0',
        'Flip upside down (1)': '1',
        'Flip left to right (2)': '2',
      };
      let flipVal = '0';
      if (typeof gainFlip === 'string') {
        if (flipMap[gainFlip]) {
          flipVal = flipMap[gainFlip];
        } else if (gainFlip.includes('upside') || gainFlip.includes('horizontal')) {
          flipVal = '1';
        } else if (gainFlip.includes('left') || gainFlip.includes('vertical')) {
          flipVal = '2';
        }
      } else {
        flipVal = String(gainFlip);
      }
      if (flipVal !== '0') {
        cmd.push('--gain_flip', flipVal);
      }
    }

    // Add defect file if provided
    const defectFile = getParam(data, ['defectFile', 'defect_file'], null);
    if (defectFile && defectFile.trim()) {
      cmd.push('--defect_file', defectFile);
    }

    // Optional flags
    if (getBoolParam(data, ['float16Output', 'float16'], false)) {
      cmd.push('--float16');
    }

    if (getBoolParam(data, ['doseWeighting', 'dose_weighting'], false)) {
      cmd.push('--dose_weighting');
    }

    if (getBoolParam(data, ['nonDoseWeighted', 'save_noDW'], false)) {
      cmd.push('--save_noDW');
    }

    if (getBoolParam(data, ['savePowerSpectra', 'save_ps'], false)) {
      cmd.push('--grouping_for_ps', String(getIntParam(data, ['sumPowerSpectra', 'grouping_for_ps'], 4)));
    }

    // Add threads parameter
    const threads = getThreads(data);
    if (threads > 1) {
      cmd.push('--j', String(threads));
    }

    // Implementation choice (RELION's own vs MotionCor2)
    if (!gpuEnabled) {
      cmd.push('--use_own');
    } else {
      // MotionCor2 mode
      cmd.push('--use_motioncor2');

      // Add MotionCor2 executable path from environment or data
      const motioncor2Exe = getParam(data, ['motioncor2Executable', 'motioncor2_exe'], process.env.MOTIONCOR2_EXE);
      if (motioncor2Exe && motioncor2Exe.trim()) {
        if (!isPathSafe(motioncor2Exe.trim())) {
          throw new Error('Invalid MotionCor2 executable path: contains unsafe characters');
        }
        cmd.push('--motioncor2_exe', motioncor2Exe.trim());
      } else {
        logger.warn('[Motion] MOTIONCOR2_EXE not configured');
      }

      // Add GPU specification if provided
      const gpuIds = getGpuIds(data);
      if (gpuIds && gpuIds.trim()) {
        cmd.push('--gpu', gpuIds);
      }

      // Add other MotionCor2 arguments if provided
      const otherArgs = getParam(data, ['othermotion', 'other_motioncor2_args'], null);
      if (otherArgs && otherArgs.trim()) {
        // Split and add each argument
        for (const arg of otherArgs.trim().split(/\s+/)) {
          cmd.push(arg);
        }
      }
    }

    // Enable PNG thumbnail generation (all micrographs)
    cmd.push('--do_thumbnails', 'true');
    cmd.push('--thumbnail_size', '512');
    cmd.push('--thumbnail_count', '-1');

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Motion] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Motion] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = MotionCorrectionBuilder;
