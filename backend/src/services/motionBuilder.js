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
const { getMrcInfo } = require('../utils/mrcParser');
const { getFirstMoviePathSync } = require('../utils/starParser');
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
    return !getBoolParam(this.data, ['useRelionImplementation'], true);
  }

  validate() {
    const inputMovies = getParam(this.data, ['inputMovies'], null);
    if (!inputMovies) {
      logger.warn('[Motion] Validation: Failed | inputMovies is required');
      return { valid: false, error: 'Input movies STAR file is required' };
    }

    const result = this.validateFileExists(inputMovies, 'Input movies STAR file');
    if (!result.valid) {
      return result;
    }

    // Validate bin_factor against movie dimensions
    const binFactor = getIntParam(this.data, ['binningFactor'], 1);
    if (binFactor > 1) {
      const binResult = this.validateBinningDimensions(inputMovies, binFactor);
      if (!binResult.valid) {
        return binResult;
      }
    }

    logger.info(`[Motion] Validation: Passed | inputMovies: ${inputMovies}`);
    return { valid: true, error: null };
  }

  /**
   * Validate that movie dimensions are compatible with the requested bin factor.
   * RELION requires dimensions after binning to be even.
   */
  validateBinningDimensions(inputMovies, binFactor) {
    try {
      const starPath = this.resolveInputPath(inputMovies);
      const movieRelPath = getFirstMoviePathSync(starPath);
      if (!movieRelPath) {
        logger.warn('[Motion] Could not read movie path from STAR file, skipping bin validation');
        return { valid: true, error: null };
      }

      // Resolve movie path relative to project
      const moviePath = path.isAbsolute(movieRelPath)
        ? movieRelPath
        : path.join(this.projectPath, movieRelPath);

      const info = getMrcInfo(moviePath);
      if (!info) {
        logger.warn(`[Motion] Could not read MRC header for ${moviePath}, skipping bin validation`);
        return { valid: true, error: null };
      }

      const binnedX = info.width / binFactor;
      const binnedY = info.height / binFactor;

      if (binnedX % 2 !== 0 || binnedY % 2 !== 0) {
        const msg = `Movie dimensions ${info.width}×${info.height} with bin_factor ${binFactor} ` +
          `produce ${binnedX}×${binnedY} — RELION requires even dimensions after binning. ` +
          `Use bin_factor 1 instead.`;
        logger.warn(`[Motion] Validation: Failed | ${msg}`);
        return { valid: false, error: msg };
      }

      logger.info(`[Motion] Bin validation: OK | ${info.width}×${info.height} / ${binFactor} = ${binnedX}×${binnedY}`);
      return { valid: true, error: null };
    } catch (err) {
      logger.warn(`[Motion] Bin validation skipped: ${err.message}`);
      return { valid: true, error: null };
    }
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const relOutputDir = this.makeRelative(outputDir);

    logger.info(`[Motion] Command: Building | job_name: ${jobName}`);

    // Get input movies STAR file
    const inputMovies = getParam(data, ['inputMovies'], null);
    const relInput = this.makeRelative(this.resolveInputPath(inputMovies));

    // Determine EER grouping value
    const eerGrouping = getIntParam(data, ['eerFractionation'], 32);

    // Check if MPI should be used (more than 1 process)
    const mpiProcs = getMpiProcs(data);

    // GPU is only used with MotionCor2, not RELION's own implementation
    const gpuEnabled = !getBoolParam(data, ['useRelionImplementation'], true);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_run_motioncorr', mpiProcs, gpuEnabled);

    // Add required parameters
    cmd.push('--i', relInput);
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--first_frame_sum', String(getIntParam(data, ['firstFrame'], 1)));
    cmd.push('--last_frame_sum', String(getIntParam(data, ['lastFrame'], -1)));
    cmd.push('--bin_factor', String(getIntParam(data, ['binningFactor'], 1)));
    cmd.push('--bfactor', String(getIntParam(data, ['bfactor'], 150)));
    cmd.push('--dose_per_frame', String(getFloatParam(data, ['dosePerFrame'], 1.0)));
    cmd.push('--preexposure', String(getFloatParam(data, ['preExposure'], 0.0)));
    cmd.push('--patch_x', String(getIntParam(data, ['patchesX'], 1)));
    cmd.push('--patch_y', String(getIntParam(data, ['patchesY'], 1)));
    cmd.push('--eer_grouping', String(eerGrouping));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Add gain reference if provided
    const gainRef = getParam(data, ['gainReferenceImage'], null);
    if (gainRef && gainRef.trim()) {
      cmd.push('--gainref', this.makeRelative(this.resolveInputPath(gainRef.trim())));

      // Gain rotation
      let gainRotation = getParam(data, ['gainRotation'], 'No rotation (0)');
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
      let gainFlip = getParam(data, ['gainFlip'], 'No flipping (0)');
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
    const defectFile = getParam(data, ['defectFile'], null);
    if (defectFile && defectFile.trim()) {
      cmd.push('--defect_file', this.makeRelative(this.resolveInputPath(defectFile.trim())));
    }

    // Optional flags — float16 and power spectra are only supported with RELION's own implementation
    // MotionCor2 cannot write float16 or save power spectra (RELION enforces this in motioncorr_runner.cpp)
    const useFloat16 = !gpuEnabled && getBoolParam(data, ['float16Output'], false);
    if (useFloat16) {
      cmd.push('--float16');
    }

    const doseWeighting = getBoolParam(data, ['doseWeighting'], false);
    if (doseWeighting) {
      cmd.push('--dose_weighting');
    }

    // --save_noDW only meaningful when dose weighting is enabled
    if (doseWeighting && getBoolParam(data, ['nonDoseWeighted'], false)) {
      cmd.push('--save_noDW');
    }

    // Power spectra: required when float16 is enabled, not available with MotionCor2
    if (!gpuEnabled && (getBoolParam(data, ['savePowerSpectra'], false) || useFloat16)) {
      cmd.push('--grouping_for_ps', String(getIntParam(data, ['sumPowerSpectra', 'powerSpectraEvery'], 4)));
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

      // Add MotionCor2 executable path from environment
      const motioncor2Exe = process.env.MOTIONCOR2_EXE;
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

      // Add other MotionCor2 arguments if provided (with sanitization)
      const otherArgs = getParam(data, ['otherMotion'], null);
      if (otherArgs && String(otherArgs).trim()) {
        const raw = String(otherArgs).trim();
        // Block shell injection patterns (same as addAdditionalArguments)
        const dangerous = /[;|&`$()<>{}!\\\n\r]/;
        if (dangerous.test(raw)) {
          logger.warn(`[Motion] Blocked dangerous characters in MotionCor2 arguments: ${raw.substring(0, 80)}`);
        } else {
          const args = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
          for (const arg of args) {
            const clean = arg.replace(/"/g, '');
            if (clean.startsWith('-') && !/^--?[\w][\w-]*$/.test(clean)) {
              logger.warn(`[Motion] Skipping invalid MotionCor2 flag: ${clean}`);
              continue;
            }
            cmd.push(clean);
          }
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
