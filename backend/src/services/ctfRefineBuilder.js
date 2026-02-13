/**
 * CTF Refinement Job Builder
 *
 * Builds RELION relion_ctf_refine commands for per-particle CTF refinement.
 */

const path = require('path');
const fs = require('fs');
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
    this.stageName = 'CtfRefine';
  }

  // CTF refinement is CPU-only (no GPU support)
  get supportsGpu() {
    return false;
  }

  validate() {
    const inputParticles = getParam(this.data, ['particlesStar'], null);
    let result = this.validateFileExists(inputParticles, 'Input particles STAR file');
    if (!result.valid) {
      return result;
    }

    const postprocessStar = getParam(this.data, ['postProcessStar'], null);
    if (!postprocessStar) {
      return { valid: false, error: 'Post-process STAR file is required for FSC-weighting' };
    }

    result = this.validateFileExists(postprocessStar, 'Post-process STAR file');
    if (!result.valid) {
      return result;
    }

    // RELION ctf_refine requires PostProcess to have been run with a solvent mask.
    // Without a mask, the postprocess.star lacks _rlnMaskName and _rlnFourierShellCorrelationCorrected,
    // causing a cryptic "could not get filenames for unfiltered half maps" error.
    const resolvedPostprocess = this.resolveInputPath(postprocessStar);
    try {
      const content = fs.readFileSync(resolvedPostprocess, 'utf-8');
      if (!content.includes('_rlnMaskName')) {
        return {
          valid: false,
          error: 'The PostProcess job was run without a solvent mask. CTF Refinement requires a masked PostProcess run — please re-run PostProcess with a solvent mask first.'
        };
      }
    } catch (e) {
      logger.warn(`[CTFRefine] Could not read postprocess star for mask check: ${e.message}`);
    }

    // Ensure at least one refinement mode is enabled — otherwise the job does nothing
    const hasAniso = getBoolParam(this.data, ['estimateMagnification'], false);
    const hasDefocus = getBoolParam(this.data, ['ctfParameter'], false);
    const hasBeamtilt = getBoolParam(this.data, ['estimateBeamtilt'], false);
    const hasAberr = getBoolParam(this.data, ['aberrations'], false);
    if (!hasAniso && !hasDefocus && !hasBeamtilt && !hasAberr) {
      return { valid: false, error: 'At least one refinement mode must be enabled (magnification, defocus, beam tilt, or aberrations)' };
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
    const inputParticles = getParam(data, ['particlesStar'], null);
    const postprocessStar = getParam(data, ['postProcessStar'], null);

    cmd.push('--i', this.makeRelative(this.resolveInputPath(inputParticles)));
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--f', this.makeRelative(this.resolveInputPath(postprocessStar)));
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Minimum resolution for fits
    const minResolution = getFloatParam(data, ['minResolutionFits'], 30);

    // Anisotropic magnification
    if (getBoolParam(data, ['estimateMagnification'], false)) {
      cmd.push('--fit_aniso');
      cmd.push('--kmin_mag', String(minResolution));
    }

    // CTF parameter fitting
    if (getBoolParam(data, ['ctfParameter'], false)) {
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
      const fitPhase = getParam(data, ['fitPhaseShift'], 'No');

      // RELION fit_mode format: {phase}{defocus}{astig}f{bfactor} (5 chars, pos 4 always 'f')
      const fitMode =
        modeChar(fitPhase) +
        modeChar(fitDefocus) +
        modeChar(fitAstig) +
        'f' +
        modeChar(fitBfactor);

      cmd.push('--fit_mode', fitMode);
    }

    // Beam tilt estimation
    if (getBoolParam(data, ['estimateBeamtilt'], false)) {
      cmd.push('--fit_beamtilt');
      cmd.push('--kmin_tilt', String(minResolution));

      // Trefoil aberration
      if (getBoolParam(data, ['estimateTreFoil'], false)) {
        cmd.push('--odd_aberr_max_n', '3');
      }
    }

    // 4th order aberrations
    if (getBoolParam(data, ['aberrations'], false)) {
      cmd.push('--fit_aberr');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[CTFRefine] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = CTFRefineBuilder;
