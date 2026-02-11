/**
 * Auto-Refine Job Builder
 *
 * Builds RELION auto-refinement commands.
 * Matches Python autorefine_builder.py functionality.
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
  getPooledParticles,
  getSymmetry,
  getReference,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class AutoRefineBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'AutoRefine';
  }

  validate() {
    const inputStar = getInputStarFile(this.data);
    const referenceMap = getReference(this.data);

    if (!inputStar) {
      logger.warn('[AutoRefine] Validation: Failed | inputStarFile is required');
      return { valid: false, error: 'Input star file is required' };
    }

    if (!referenceMap) {
      logger.warn('[AutoRefine] Validation: Failed | referenceMap is required');
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

    logger.info(`[AutoRefine] Validation: Passed | inputStarFile: ${inputStar}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;

    logger.info(`[AutoRefine] Command: Building | job_name: ${jobName}`);

    // Get MPI, thread, and GPU settings using paramHelper
    let mpiProcs = getMpiProcs(data);
    const threads = getThreads(data);
    const pooled = getPooledParticles(data, 3);
    const gpuEnabled = isGpuEnabled(data);

    // IMPORTANT: AutoRefine with --split_random_halves requires at least 3 MPI processes
    // (1 leader + 2 workers for each half-set). Force minimum of 3 if using MPI.
    if (mpiProcs > 1 && mpiProcs < 3) {
      logger.warn(`[AutoRefine] MPI procs ${mpiProcs} < 3, forcing to 3 for split_random_halves`);
      mpiProcs = 3;
    }

    logger.debug(`[AutoRefine] Parameters: mpi=${mpiProcs}, threads=${threads}, gpu=${gpuEnabled}`);

    // Compute relative output directory for RELION
    const relOutputDir = this.makeRelative(outputDir);

    // Build command with MPI if requested (using configurable launcher)
    const cmd = this.buildMpiCommand('relion_refine', mpiProcs, gpuEnabled);

    // Get parameters using paramHelper
    const lowPass = getFloatParam(data, ['initialLowPassFilter', 'lowPassFilter', 'ini_high'], 60);
    const symmetry = getSymmetry(data);

    // Map angular sampling to healpix_order
    const angularSampling = getParam(data, ['initialAngularSampling'], '7.5 degrees');
    const healpixMap = {
      '30 degrees': 0, '15 degrees': 1, '7.5 degrees': 2,
      '3.7 degrees': 3, '1.8 degrees': 4, '0.9 degrees': 5,
      '0.5 degrees': 6, '0.2 degrees': 7, '0.1 degrees': 8,
    };
    const healpixOrder = healpixMap[angularSampling] !== undefined ? healpixMap[angularSampling] : 2;

    // Input and output
    const inputStar = getInputStarFile(data);
    const referenceMap = getReference(data);

    cmd.push('--i', inputStar);
    cmd.push('--o', relOutputDir + path.sep);
    cmd.push('--auto_refine');
    cmd.push('--split_random_halves');
    cmd.push('--ref', referenceMap);
    cmd.push('--ini_high', String(lowPass));
    cmd.push('--sym', symmetry);
    cmd.push('--particle_diameter', String(getMaskDiameter(data, 200)));
    cmd.push('--healpix_order', String(healpixOrder));
    cmd.push('--auto_local_healpix_order', '4');
    cmd.push('--flatten_solvent');
    cmd.push('--norm');
    cmd.push('--scale');
    cmd.push('--oversampling', '1');
    cmd.push('--pool', String(pooled));
    cmd.push('--pad', '2');
    cmd.push('--low_resol_join_halves', '40');
    cmd.push('--j', String(threads));
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Resize reference
    if (!getBoolParam(data, ['resizeReference'], true)) {
      cmd.push('--trust_ref_size');
    }

    // Reference mask if provided
    const refMask = getParam(data, ['referenceMask', 'solvent_mask'], null);
    if (refMask) {
      cmd.push('--solvent_mask', refMask);
    }

    // Auto-sampling parameters
    const offsetRange = getIntParam(data, ['initialOffsetRange', 'offSetRange', 'offset_range'], 5);
    const offsetStep = getIntParam(data, ['initialOffsetStep', 'offSetStep', 'offset_step'], 1);
    cmd.push('--offset_range', String(offsetRange));
    cmd.push('--offset_step', String(offsetStep));

    // Use finer angular sampling faster
    if (getBoolParam(data, ['finerAngularSampling'], false)) {
      cmd.push('--auto_ignore_angles');
      cmd.push('--auto_resol_angles');
    }

    // Relax symmetry
    const relaxSym = getParam(data, ['RelaxSymmetry', 'relaxSymmetry'], null);
    if (relaxSym) {
      cmd.push('--relax_sym', relaxSym);
    }

    // Optional flags
    if (!getBoolParam(data, ['referenceMapAbsolute', 'absoluteGreyscale'], false)) {
      cmd.push('--firstiter_cc');
    }

    if (getBoolParam(data, ['ctfCorrection'], true)) {
      cmd.push('--ctf');
    }

    // Ignore CTFs
    if (getBoolParam(data, ['igonreCtf', 'ignoreCTFs', 'ctf_intact_first_peak'], false)) {
      cmd.push('--ctf_intact_first_peak');
    }

    // Mask particles
    if (getBoolParam(data, ['maskIndividualparticles', 'maskParticlesWithZeros'], true)) {
      cmd.push('--zero_mask');
    }

    if (getBoolParam(data, ['useBlushRegularisation'], false)) {
      cmd.push('--blush');
    }

    // Solvent-flattened FSCs
    if (getBoolParam(data, ['useSolventFlattenedFscs', 'solvent_correct_fsc'], false)) {
      cmd.push('--solvent_correct_fsc');
    }

    // I/O options
    if (!getBoolParam(data, ['Useparalleldisc', 'useParallelIO'], true)) {
      cmd.push('--no_parallel_disc_io');
    }
    if (!getBoolParam(data, ['combineIterations'], false)) {
      cmd.push('--dont_combine_weights_via_disc');
    }

    // GPU acceleration
    if (gpuEnabled) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
      logger.info(`[AutoRefine] GPU enabled: --gpu ${gpuIds}`);
    }

    // Helix parameters
    if (getBoolParam(data, ['helicalReconstruction', 'helix'], false)) {
      cmd.push('--helix');

      const tubeInner = getFloatParam(data, ['tubeDiameter1', 'innerDiameter'], -1);
      const tubeOuter = getFloatParam(data, ['tubeDiameter2', 'outerDiameter'], -1);
      if (tubeInner > 0) {
        cmd.push('--helical_inner_diameter', String(tubeInner));
      }
      cmd.push('--helical_outer_diameter', String(tubeOuter));

      const nrAsu = getIntParam(data, ['numberOfUniqueAsymmetrical', 'uniqueAsymmetricalUnits'], 1);
      cmd.push('--helical_nr_asu', String(nrAsu));

      const initialTwist = getFloatParam(data, ['initialTwist'], 0);
      const rise = getFloatParam(data, ['rise', 'initialRise'], 0);
      cmd.push('--helical_twist_initial', String(initialTwist));
      cmd.push('--helical_rise_initial', String(rise));

      const centralZ = getFloatParam(data, ['centralZlength'], 30);
      cmd.push('--helical_z_percentage', String(centralZ / 100.0));

      // Angular search range
      const sigmaTilt = getFloatParam(data, ['angularTilt'], 15);
      const sigmaPsi = getFloatParam(data, ['angularPsi'], 10);
      const sigmaRot = getFloatParam(data, ['angularRot'], -1);
      if (sigmaTilt > 0) {
        cmd.push('--sigma_tilt', String(sigmaTilt));
      }
      if (sigmaPsi > 0) {
        cmd.push('--sigma_psi', String(sigmaPsi / 3.0));
      }
      if (sigmaRot > 0) {
        cmd.push('--sigma_rot', String(sigmaRot / 3.0 / 5.0));
      }

      const localAvg = getFloatParam(data, ['rangeFactorOfLocal', 'localAveraging'], -1);
      if (localAvg > 0) {
        cmd.push('--helical_sigma_distance', String(localAvg / 3.0));
      }

      if (getBoolParam(data, ['keepTiltPriorFixed', 'tiltPrior'], true)) {
        cmd.push('--helical_keep_tilt_prior_fixed');
      }

      if (getBoolParam(data, ['helicalSymmetry'], true)) {
        if (getBoolParam(data, ['localSearches', 'localSearchSymmetry'], false)) {
          cmd.push('--helical_symmetry_search');

          const twistMin = getFloatParam(data, ['twistSearch1', 'twistMin'], 0);
          const twistMax = getFloatParam(data, ['twistSearch2', 'twistMax'], 0);
          const twistStep = getFloatParam(data, ['twistSearch3', 'twistStep'], 0);
          cmd.push('--helical_twist_min', String(twistMin));
          cmd.push('--helical_twist_max', String(twistMax));
          if (twistStep > 0) {
            cmd.push('--helical_twist_inistep', String(twistStep));
          }

          const riseMin = getFloatParam(data, ['riseSearchMin', 'riseMin'], 0);
          const riseMax = getFloatParam(data, ['riseSearchMax', 'riseMax'], 0);
          const riseStep = getFloatParam(data, ['riseSearchStep', 'riseStep'], 0);
          cmd.push('--helical_rise_min', String(riseMin));
          cmd.push('--helical_rise_max', String(riseMax));
          if (riseStep > 0) {
            cmd.push('--helical_rise_inistep', String(riseStep));
          }
        }
      }
    }

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[AutoRefine] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[AutoRefine] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = AutoRefineBuilder;
