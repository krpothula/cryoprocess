/**
 * Initial Model Job Builder
 *
 * Builds RELION initial model generation commands.
 * Matches Python initialmodel_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getInputStarFile,
  getMaskDiameter,
  getNumberOfClasses,
  getPooledParticles,
  getSymmetry,
  getScratchDir,
  getIntParam,
  getFloatParam,
  getBoolParam
} = require('../utils/paramHelper');

class InitialModelBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'InitialModel';
  }

  validate() {
    const inputStar = getInputStarFile(this.data);
    if (!inputStar) {
      logger.warn('[InitialModel] Validation: Failed | inputStarFile is required');
      return { valid: false, error: 'Input star file is required' };
    }

    const result = this.validateFileExists(inputStar, 'Input STAR file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[InitialModel] Validation: Passed | inputStarFile: ${inputStar}`);
    return { valid: true, error: null };
  }

  // InitialModel (gradient refinement) does NOT support MPI
  get supportsMpi() {
    return false;
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;

    logger.info(`[InitialModel] Command: Building | job_name: ${jobName}`);

    // Compute relative output directory for RELION
    const relOutputDir = this.makeRelative(outputDir);

    // Get thread and GPU settings using paramHelper
    // NOTE: Gradient refinement (--grad --denovo_3dref) does NOT support MPI
    // RELION error: "Gradient refinement is not supported together with MPI"
    const threads = getThreads(data);
    const pooled = getPooledParticles(data, 3);
    const gpuEnabled = isGpuEnabled(data);

    logger.debug(`[InitialModel] Parameters: threads=${threads}, gpu=${gpuEnabled} (MPI disabled for gradient refinement)`);

    // IMPORTANT: Do NOT use MPI for gradient refinement - always use single process
    const cmd = ['relion_refine'];

    // Get iteration count - frontend sends numberOfVdam
    const iterations = getIntParam(data, ['numberOfVdam'], 200);

    // Get input STAR file
    const inputStar = getInputStarFile(data);
    const relInput = this.makeRelative(this.resolveInputPath(inputStar));

    cmd.push('--o', path.join(relOutputDir, 'run'));
    cmd.push('--iter', String(iterations));
    cmd.push('--grad');
    cmd.push('--denovo_3dref');
    cmd.push('--i', relInput);
    cmd.push('--K', String(getNumberOfClasses(data, 1)));
    cmd.push('--sym', getSymmetry(data));
    cmd.push('--zero_mask');
    cmd.push('--pool', String(pooled));
    cmd.push('--pad', '1');
    cmd.push('--particle_diameter', String(getMaskDiameter(data, 200)));
    cmd.push('--oversampling', '1');
    cmd.push('--healpix_order', '1');
    cmd.push('--offset_range', '6');
    cmd.push('--offset_step', '2');
    cmd.push('--auto_sampling');
    cmd.push('--tau2_fudge', String(getFloatParam(data, ['regularisationParameter'], 2)));
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // CTF options
    if (getBoolParam(data, ['ctfCorrection'], true)) {
      cmd.push('--ctf');
    }

    if (getBoolParam(data, ['ignoreCTFs'], false)) {
      cmd.push('--ctf_intact_first_peak');
    }

    // Optimization options - frontend sends nonNegativeSolvent
    if (getBoolParam(data, ['nonNegativeSolvent'], true)) {
      cmd.push('--flatten_solvent');
    }

    // I/O options
    if (!getBoolParam(data, ['Useparalleldisc'], true)) {
      cmd.push('--no_parallel_disc_io');
    }

    if (getBoolParam(data, ['preReadAllParticles'], false)) {
      cmd.push('--preread_images');
    }

    if (!getBoolParam(data, ['combineIterations'], false)) {
      cmd.push('--dont_combine_weights_via_disc');
    }

    const scratchDir = getScratchDir(data);
    if (scratchDir) {
      cmd.push('--scratch_dir', scratchDir);
    }

    // GPU acceleration
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[InitialModel] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[InitialModel] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = InitialModelBuilder;
