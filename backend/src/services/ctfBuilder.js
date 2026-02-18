/**
 * CTF Estimation Job Builder
 *
 * Builds RELION CTF estimation commands.
 * Matches Python ctf_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const BaseJobBuilder = require('./baseBuilder');
const { isPathSafe } = require('../utils/security');
const {
  getMpiProcs,
  getGpuIds,
  getInputStarFile,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class CTFBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'CtfFind';
  }

  /**
   * GPU is only supported when using Gctf (not CTFFIND4/5).
   * CTFFIND4/5 is CPU-only.
   */
  get supportsGpu() {
    return getBoolParam(this.data, ['useGctf', 'use_gctf'], false);
  }

  validate() {
    const inputStar = getInputStarFile(this.data);
    if (!inputStar) {
      logger.warn('[CTF] Validation: Failed | inputStarFile is required');
      return { valid: false, error: 'Input STAR file is required' };
    }

    const result = this.validateFileExists(inputStar, 'Input STAR file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[CTF] Validation: Passed | inputStarFile: ${inputStar}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const relOutputDir = this.makeRelative(outputDir);

    logger.info(`[CTF] Command: Building | job_name: ${jobName}`);

    // Get input STAR file
    const inputStar = getInputStarFile(data);
    const relInput = this.makeRelative(this.resolveInputPath(inputStar));

    // Check if MPI should be used (more than 1 process)
    const mpiProcs = getMpiProcs(data);

    // GPU is only used with Gctf, not CTFFIND
    const gpuEnabled = getBoolParam(data, ['useGctf', 'use_gctf'], false);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_run_ctffind', mpiProcs, gpuEnabled);

    // Add required parameters
    cmd.push('--i', relInput);
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--dAst', String(getIntParam(data, ['astigmatism', 'dAst'], 100)));

    // CTFFIND or Gctf executable
    if (gpuEnabled) {
      cmd.push('--use_gctf');
      const gctfExe = getParam(data, ['gctfExecutable', 'gctf_exe'], settings.GCTF_EXE || '/usr/local/bin/gctf');
      if (!isPathSafe(gctfExe)) {
        throw new Error(`Invalid Gctf executable path: contains unsafe characters`);
      }
      cmd.push('--gctf_exe', gctfExe);
    } else {
      const ctffindExe = getParam(data, ['ctfFindExecutable', 'ctffindExecutable', 'ctffind_exe'], settings.CTFFIND_EXE || '/usr/local/bin/ctffind');
      if (!isPathSafe(ctffindExe)) {
        throw new Error(`Invalid CTFFIND executable path: contains unsafe characters`);
      }
      cmd.push('--ctffind_exe', ctffindExe);

      // Only add --is_ctffind4 for CTFFIND4 (CTFFIND5 uses different output format)
      const isCTFFIND5 = /ctffind[-_]?5/i.test(ctffindExe);
      if (!isCTFFIND5) {
        cmd.push('--is_ctffind4');
      }
    }

    // CTF window size
    const ctfWin = getIntParam(data, ['ctfWindowSize'], -1);
    cmd.push('--ctfWin', String(ctfWin));

    // Box size for CTF estimation
    const boxSize = getIntParam(data, ['fftBoxSize'], 512);
    cmd.push('--Box', String(boxSize));

    // Resolution range
    const resMin = getFloatParam(data, ['minResolution'], 30);
    const resMax = getFloatParam(data, ['maxResolution'], 5);
    cmd.push('--ResMin', String(resMin));
    cmd.push('--ResMax', String(resMax));

    // Defocus search range
    let defocusMin = getFloatParam(data, ['minDefocus'], 5000);
    let defocusMax = getFloatParam(data, ['maxDefocus'], 50000);
    const defocusStep = getFloatParam(data, ['defocusStepSize'], 500);

    // Ensure min < max (swap if user got them backwards)
    if (defocusMin > defocusMax) {
      logger.warn(`[CTF] Defocus range inverted: min=${defocusMin} > max=${defocusMax}, swapping`);
      [defocusMin, defocusMax] = [defocusMax, defocusMin];
    }

    cmd.push('--dFMin', String(defocusMin));
    cmd.push('--dFMax', String(defocusMax));
    cmd.push('--FStep', String(defocusStep));

    // Pipeline control
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Optional flags

    // Use power spectra from MotionCorr
    if (getBoolParam(data, ['usePowerSpectraFromMotionCorr'], false)) {
      cmd.push('--use_given_ps');
    }

    // Use micrograph without dose-weighting
    if (getBoolParam(data, ['useMicrographWithoutDoseWeighting'], false)) {
      cmd.push('--use_noDW');
    }

    // Fast search (when NOT using exhaustive search)
    if (!getBoolParam(data, ['useExhaustiveSearch'], true)) {
      cmd.push('--fast_search');
    }

    // Phase shift estimation (for phase plate)
    if (getBoolParam(data, ['estimatePhaseShifts'], false)) {
      cmd.push('--do_phaseshift');
      const phaseMin = getFloatParam(data, ['phaseShiftMin'], 0);
      const phaseMax = getFloatParam(data, ['phaseShiftMax'], 180);
      const phaseStep = getFloatParam(data, ['phaseShiftStep'], 10);
      cmd.push('--phase_min', String(phaseMin));
      cmd.push('--phase_max', String(phaseMax));
      cmd.push('--phase_step', String(phaseStep));
    }

    // GPU for Gctf
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // Enable PNG thumbnail generation (all micrographs)
    cmd.push('--do_thumbnails', 'true');
    cmd.push('--thumbnail_size', '512');
    cmd.push('--thumbnail_count', '-1');

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[CTF] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[CTF] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = CTFBuilder;
