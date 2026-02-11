/**
 * CTF Refinement Job Builder
 *
 * Builds RELION relion_ctf_refine commands for per-particle CTF refinement.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class CTFRefineBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'CTFRefine';
  }

  // CTF refinement is CPU-only (no GPU support)
  get supportsGpu() {
    return false;
  }

  validate() {
    const inputParticles = getParam(this.data, ['particlesStar', 'inputParticles'], null);
    let result = this.validateFileExists(inputParticles, 'Input particles STAR file');
    if (!result.valid) {
      return result;
    }

    const postprocessStar = getParam(this.data, ['postProcessStar', 'postprocessStar'], null);
    if (!postprocessStar) {
      return { valid: false, error: 'Post-process STAR file is required for FSC-weighting' };
    }

    logger.info(`[CTFRefine] Validation passed | input: ${inputParticles}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    // Get MPI and thread settings using paramHelper
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);

    // CTF refinement is CPU-only (no GPU support)
    const gpuEnabled = false;

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_ctf_refine', mpiProcs, gpuEnabled);

    // Input files
    const inputParticles = getParam(data, ['particlesStar', 'inputParticles'], null);
    const postprocessStar = getParam(data, ['postProcessStar', 'postprocessStar'], null);

    cmd.push('--i', this.makeRelative(this.resolveInputPath(inputParticles)));
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--f', this.makeRelative(this.resolveInputPath(postprocessStar)));
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Minimum resolution for fits
    const minResolution = getFloatParam(data, ['minResolutionFits', 'minResDefocus'], 30);

    // Anisotropic magnification
    if (getBoolParam(data, ['estimateMagnification', 'doAnisoMag'], false)) {
      cmd.push('--fit_aniso');
      cmd.push('--kmin_mag', String(minResolution));
    }

    // CTF parameter fitting
    if (getBoolParam(data, ['ctfParameter', 'doDefocusRefine'], false)) {
      cmd.push('--fit_defocus');
      cmd.push('--kmin_defocus', String(minResolution));

      // Build fit mode string
      const modeChar = (value) => {
        if (value === 'Per-micrograph') return 'm';
        if (value === 'Per-particle') return 'p';
        return 'f';
      };

      const fitDefocus = getParam(data, ['fitDefocus'], 'No');
      const fitAstig = getParam(data, ['fitAstigmatism'], 'No');
      const fitBfactor = getParam(data, ['fitBFactor'], 'No');
      const fitPhase = getParam(data, ['fitPhaseShift', 'phaseShift'], 'No');

      const fitMode =
        modeChar(fitDefocus) +
        modeChar(fitDefocus) +
        modeChar(fitAstig) +
        modeChar(fitBfactor) +
        modeChar(fitPhase);

      cmd.push('--fit_mode', fitMode);
    }

    // Beam tilt estimation
    if (getBoolParam(data, ['estimateBeamtilt', 'doBeamTilt'], false)) {
      cmd.push('--fit_beamtilt');
      cmd.push('--kmin_tilt', String(minResolution));

      // Trefoil aberration
      if (getBoolParam(data, ['estimateTreFoil', 'treFoil', 'doTrefoil'], false)) {
        cmd.push('--odd_aberr_max_n', '3');
      }
    }

    // 4th order aberrations
    if (getBoolParam(data, ['aberrations', 'do4thOrder'], false)) {
      cmd.push('--fit_aberr');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[CTFRefine] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = CTFRefineBuilder;
