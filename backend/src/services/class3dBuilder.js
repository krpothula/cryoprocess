/**
 * 3D Classification Job Builder
 *
 * Builds RELION 3D classification commands.
 * Matches Python class3d_builder.py functionality.
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
  getContinueFrom,
  getMaskDiameter,
  getNumberOfClasses,
  getIterations,
  getPooledParticles,
  getSymmetry,
  getReference,
  getScratchDir,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class Class3DBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Class3D';
  }

  validate() {
    // Continue mode: only need the optimiser file
    const continueFile = getContinueFrom(this.data);
    if (continueFile) {
      logger.info(`[Class3D] Validation: Passed (continue mode) | continueFrom: ${continueFile}`);
      return { valid: true, error: null };
    }

    const inputStar = getInputStarFile(this.data);
    const referenceMap = getReference(this.data);

    if (!inputStar) {
      logger.warn('[Class3D] Validation: Failed | inputStarFile is required');
      return { valid: false, error: 'Input star file is required' };
    }

    if (!referenceMap) {
      logger.warn('[Class3D] Validation: Failed | referenceMap is required');
      return { valid: false, error: 'Reference map is required' };
    }

    let result = this.validateFileExists(inputStar, 'Input STAR file');
    if (!result.valid) {
      return result;
    }

    result = this.validateFileExists(referenceMap, 'Reference map');
    if (!result.valid) {
      return result;
    }

    logger.info(`[Class3D] Validation: Passed | inputStarFile: ${inputStar}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;

    logger.info(`[Class3D] Command: Building | job_name: ${jobName}`);

    // Get MPI, thread, and GPU settings using paramHelper
    const mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);
    const pooled = getPooledParticles(data, 3);
    const gpuEnabled = isGpuEnabled(data);

    logger.debug(`[Class3D] Parameters: mpi=${mpiProcs}, threads=${threads}, gpu=${gpuEnabled}`);

    // Compute relative output directory for RELION
    const relOutputDir = this.makeRelative(outputDir);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    // Continue from previous run: RELION reads all parameters from the optimiser file
    const continueFile = getContinueFrom(data);
    if (continueFile) {
      cmd.push('--continue', this.makeRelative(this.resolveInputPath(continueFile)));
      cmd.push('--o', relOutputDir + path.sep);
      cmd.push('--j', String(threads));
      cmd.push('--pool', String(pooled));
      cmd.push('--pipeline_control', relOutputDir + path.sep);
      if (!getBoolParam(data, ['useParallelIO', 'Useparalleldisc'], true)) {
        cmd.push('--no_parallel_disc_io');
      }
      if (!getBoolParam(data, ['combineIterations'], false)) {
        cmd.push('--dont_combine_weights_via_disc');
      }
      if (gpuEnabled) {
        cmd.push('--gpu', getGpuIds(data));
      }
      this.addAdditionalArguments(cmd);
      logger.info(`[Class3D] Command: Built (continue mode) | ${cmd.join(' ')}`);
      return cmd;
    }

    // Get parameters using paramHelper
    const lowPass = getFloatParam(data, ['initialLowPassFilter'], 60);
    const symmetry = getSymmetry(data);
    const regularisation = getFloatParam(data, ['regularisationParameter'], 2);
    const iterations = getIterations(data, 25);
    const offsetRange = getIntParam(data, ['initialOffsetRange'], 5);
    const offsetStep = getIntParam(data, ['initialOffsetStep'], 1);

    // Input and output
    const inputStar = getInputStarFile(data);
    const relInput = this.makeRelative(this.resolveInputPath(inputStar));
    const referenceMap = getReference(data);

    const relRef = this.makeRelative(this.resolveInputPath(referenceMap));

    cmd.push('--i', relInput);
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--ref', relRef);

    // Resize reference option
    if (!getBoolParam(data, ['resizeReference'], true)) {
      cmd.push('--trust_ref_size');
    }

    cmd.push('--ini_high', String(lowPass));
    cmd.push('--sym', symmetry);
    cmd.push('--K', String(getNumberOfClasses(data, 1)));
    cmd.push('--tau2_fudge', String(regularisation));
    cmd.push('--particle_diameter', String(getMaskDiameter(data, 200)));
    cmd.push('--iter', String(iterations));
    cmd.push('--flatten_solvent');
    cmd.push('--norm');
    cmd.push('--scale');
    cmd.push('--oversampling', '1');
    cmd.push('--pad', '2');
    cmd.push('--pool', String(pooled));
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Reference mask if provided
    const refMask = getParam(data, ['referenceMask'], null);
    if (refMask) {
      cmd.push('--solvent_mask', this.makeRelative(this.resolveInputPath(refMask)));
    }

    // Optional flags
    if (!getBoolParam(data, ['referenceMapAbsolute'], false)) {
      cmd.push('--firstiter_cc');
    }

    if (getBoolParam(data, ['ctfCorrection'], true)) {
      cmd.push('--ctf');
    }

    // Ignore CTFs
    if (getBoolParam(data, ['ignoreCTFs', 'ignoreCtf'], false)) {
      cmd.push('--ctf_intact_first_peak');
    }

    // Fast subsets (useEM)
    if (getBoolParam(data, ['fastSubsets'], false)) {
      cmd.push('--fast_subsets');
    }

    // Blush regularisation requires GPU — only add if GPU is enabled
    if (getBoolParam(data, ['useBlushRegularisation'], false) && gpuEnabled) {
      cmd.push('--blush');
    }

    // Mask particles
    if (getBoolParam(data, ['maskIndividualParticles', 'maskIndividualparticles'], true)) {
      cmd.push('--zero_mask');
    }

    // Image alignment options
    if (getBoolParam(data, ['localSearchFromAutoSampling', 'LocalSearchfromAutoSampling'], true)) {
      cmd.push('--offset_range', String(offsetRange));
      cmd.push('--offset_step', String(offsetStep));
    } else {
      cmd.push('--skip_align');
    }

    // I/O options
    if (!getBoolParam(data, ['useParallelIO', 'Useparalleldisc'], true)) {
      cmd.push('--no_parallel_disc_io');
    }
    if (!getBoolParam(data, ['combineIterations'], false)) {
      cmd.push('--dont_combine_weights_via_disc');
    }

    // GPU acceleration
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
      logger.info(`[Class3D] GPU enabled: --gpu ${gpuIds}`);
    }

    // Helix parameters
    if (getBoolParam(data, ['helicalReconstruction'], false)) {
      cmd.push('--helix');

      const tubeInner = getFloatParam(data, ['tubeDiameter1'], -1);
      const tubeOuter = getFloatParam(data, ['tubeDiameter2'], -1);
      if (tubeInner > 0) {
        cmd.push('--helical_inner_diameter', String(tubeInner));
      }
      cmd.push('--helical_outer_diameter', String(tubeOuter));

      const nrAsu = getIntParam(data, ['numberOfUniqueAsymmetrical'], 1);
      cmd.push('--helical_nr_asu', String(nrAsu));

      const initialTwist = getFloatParam(data, ['initialTwist'], 0);
      const rise = getFloatParam(data, ['rise'], 0);
      cmd.push('--helical_twist_initial', String(initialTwist));
      cmd.push('--helical_rise_initial', String(rise));

      const centralZ = getFloatParam(data, ['centralZlength'], 30);
      cmd.push('--helical_z_percentage', String(centralZ / 100.0));

      if (getBoolParam(data, ['keepTiltPriorFixed'], true)) {
        cmd.push('--helical_keep_tilt_prior_fixed');
      }

      if (getBoolParam(data, ['helicalSymmetry'], true)) {
        if (getBoolParam(data, ['localSearches'], false)) {
          cmd.push('--helical_symmetry_search');

          const twistMin = getFloatParam(data, ['twistSearch1'], 0);
          const twistMax = getFloatParam(data, ['twistSearch2'], 0);
          const twistStep = getFloatParam(data, ['twistSearch3'], 0);
          cmd.push('--helical_twist_min', String(twistMin));
          cmd.push('--helical_twist_max', String(twistMax));
          if (twistStep > 0) {
            cmd.push('--helical_twist_inistep', String(twistStep));
          }

          const riseMin = getFloatParam(data, ['riseSearchMin'], 0);
          const riseMax = getFloatParam(data, ['riseSearchMax'], 0);
          const riseStep = getFloatParam(data, ['riseSearchStep'], 0);
          cmd.push('--helical_rise_min', String(riseMin));
          cmd.push('--helical_rise_max', String(riseMax));
          if (riseStep > 0) {
            cmd.push('--helical_rise_inistep', String(riseStep));
          }
        }
      }
    }

    // Auto-sampling parameters
    const angularSampling = getParam(data, ['initialAngularSampling'], '7.5 degrees');
    const healpixMap = {
      '30 degrees': 0, '15 degrees': 1, '7.5 degrees': 2,
      '3.7 degrees': 3, '1.8 degrees': 4, '0.9 degrees': 5,
      '0.5 degrees': 6, '0.2 degrees': 7, '0.1 degrees': 8
    };
    const healpixOrder = healpixMap[angularSampling] !== undefined ? healpixMap[angularSampling] : 2;
    cmd.push('--healpix_order', String(healpixOrder));

    // Relax symmetry
    const relaxSym = getParam(data, ['relaxSymmetry', 'RelaxSymmetry'], null);
    if (relaxSym) {
      cmd.push('--relax_sym', relaxSym);
    }

    // Local angular searches
    if (getBoolParam(data, ['localAngularSearches'], false)) {
      const localRange = getFloatParam(data, ['localAngularSearchRange'], 5);
      cmd.push('--sigma_ang', String(localRange / 3.0));
    }

    // Allow coarser sampling
    if (getBoolParam(data, ['coarserSampling'], false)) {
      cmd.push('--allow_coarser_sampling');
    }

    // Limit resolution E-step
    const limitRes = getFloatParam(data, ['limitResolution', 'limitResolutionEStep'], -1);
    if (limitRes > 0) {
      cmd.push('--strict_highres_exp', String(limitRes));
    }

    // Pre-read images into RAM
    if (getBoolParam(data, ['preReadAllParticles'], false)) {
      cmd.push('--preread_images');
    }

    // Scratch directory
    const scratchDir = getScratchDir(data);
    if (scratchDir) {
      cmd.push('--scratch_dir', scratchDir);
    }

    // Skip gridding (padding)
    if (getBoolParam(data, ['skipPadding'], false)) {
      cmd.push('--skip_gridding');
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Class3D] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Class3D] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = Class3DBuilder;
