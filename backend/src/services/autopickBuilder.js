/**
 * Auto-Pick Job Builder
 *
 * Builds RELION AutoPick commands.
 * Matches Python autopick_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const { isPathSafe } = require('../utils/security');
const {
  getGpuIds,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam,
  getMpiProcs
} = require('../utils/paramHelper');

class AutoPickBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'AutoPick';
  }

  /**
   * GPU is only supported for template matching (not LoG picking).
   * LoG picking is CPU-only in RELION.
   * Topaz uses its own GPU handling.
   */
  get supportsGpu() {
    const useLaplacian = getBoolParam(this.data, ['laplacianGaussian'], false);
    const useTemplate = getBoolParam(this.data, ['templateMatching'], false);
    // GPU only supported for template matching, not LoG
    return useTemplate && !useLaplacian;
  }

  validate() {
    // Accept multiple frontend field names for input
    const inputMics = getParam(this.data, ['inputMicrographs'], null);
    if (!inputMics) {
      logger.warn('[AutoPick] Validation: Failed | inputMicrographs is required');
      return { valid: false, error: 'Input micrographs file is required' };
    }

    const result = this.validateFileExists(inputMics, 'Input micrographs file');
    if (!result.valid) {
      return result;
    }

    logger.info(`[AutoPick] Validation: Passed | inputMicrographs: ${inputMics}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const relOutputDir = this.makeRelative(outputDir);

    logger.info(`[AutoPick] Command: Building | job_name: ${jobName}`);

    // Get input micrographs
    const inputMics = getParam(data, ['inputMicrographs'], null);
    const relInput = this.makeRelative(this.resolveInputPath(inputMics));

    // MPI support - relion_autopick_mpi exists for parallel picking
    const mpiProcs = getMpiProcs(data);
    const useGpu = getBoolParam(data, ['useAcceleration'], false) && !getBoolParam(data, ['laplacianGaussian'], false);
    const mpiCmd = this.buildMpiCommand('relion_autopick', mpiProcs, useGpu);

    // Build base command
    const cmd = [
      ...mpiCmd,
      '--i', relInput,
      '--odir', relOutputDir + path.sep,
      '--pickname', 'autopick',
      '--shrink', String(getIntParam(data, ['shrinkFactor'], 0)),
      '--pipeline_control', relOutputDir + path.sep,
    ];

    // Track if using LoG for GPU decision below
    const useLaplacian = getBoolParam(data, ['laplacianGaussian'], false);

    // Laplacian of Gaussian picking
    if (useLaplacian) {
      cmd.push('--LoG');
      cmd.push('--LoG_diam_min', String(getFloatParam(data, ['minDiameter'], 200)));
      cmd.push('--LoG_diam_max', String(getFloatParam(data, ['maxDiameter'], 250)));
      cmd.push('--LoG_adjust_threshold', String(getFloatParam(data, ['defaultThreshold'], 0)));
      cmd.push('--LoG_upper_threshold', String(getFloatParam(data, ['upperThreshold'], 999)));
    }

    // White particles on dark background for LoG
    if (getBoolParam(data, ['areParticlesWhite'], false)) {
      cmd.push('--LoG_invert');
    }

    // Topaz picking options
    if (getBoolParam(data, ['useTopaz'], false)) {
      // Topaz picking (using trained model)
      if (getBoolParam(data, ['performTopazPicking'], false)) {
        const trainedModel = getParam(data, ['trainedTopazparticles'], null);
        if (trainedModel) {
          cmd.push('--topaz_extract', '--topaz_model', trainedModel);
        } else {
          // Use default Topaz model
          cmd.push('--topaz_extract');
        }

        // Particle diameter for Topaz
        const particleDiam = getFloatParam(data, ['particleDiameter'], -1);
        if (particleDiam > 0) {
          cmd.push('--topaz_particle_diameter', String(particleDiam));
        }
      }

      // Topaz training
      if (getBoolParam(data, ['performTopazTraining'], false)) {
        cmd.push('--topaz_train');

        // Training coordinates or particles
        const particlesStar = getParam(data, ['particlesStar'], null);
        if (getBoolParam(data, ['trainParticles'], false) || particlesStar) {
          if (particlesStar) {
            cmd.push('--topaz_train_parts', particlesStar);
          }
        } else {
          const inputCoords = getParam(data, ['inputPickCoordinates'], null);
          if (inputCoords) {
            cmd.push('--topaz_train_picks', inputCoords);
          }
        }

        // Number of particles per micrograph for training
        const nrParticles = getIntParam(data, ['nrParticles'], -1);
        if (nrParticles > 0) {
          cmd.push('--topaz_nr_particles', String(nrParticles));
        }
      }

      // Topaz executable (if custom)
      const topazExec = getParam(data, ['topazExecutable'], null);
      if (topazExec) {
        if (!isPathSafe(topazExec)) {
          throw new Error('Invalid Topaz executable path: contains unsafe characters');
        }
        cmd.push('--topaz_exe', topazExec);
      }

      // Additional Topaz arguments
      const topazArgs = getParam(data, ['topazArguments'], null);
      if (topazArgs) {
        cmd.push('--extra_topaz_args', topazArgs);
      }
    }

    // Template matching options
    if (getBoolParam(data, ['templateMatching'], false)) {
      // 2D and 3D references are mutually exclusive - 2D takes priority
      const twoDRefs = getParam(data, ['twoDReferences'], null);
      const threeDRef = getParam(data, ['threeDReference'], null);

      if (twoDRefs && threeDRef) {
        logger.warn('[AutoPick] Both 2D and 3D references specified - using 2D references (they are mutually exclusive)');
      }

      if (twoDRefs) {
        const relRef = this.makeRelative(this.resolveInputPath(twoDRefs));
        cmd.push('--ref', relRef);
      } else if (threeDRef) {
        const relRef3d = this.makeRelative(this.resolveInputPath(threeDRef));
        cmd.push('--ref', relRef3d);

        // Symmetry for 3D reference
        const sym = getParam(data, ['Symmetry', 'symmetry'], null);
        if (sym && sym.trim()) {
          cmd.push('--sym', sym.trim());
        }
      }

      // Reference pixel size and angular sampling
      cmd.push('--angpix_ref', String(getFloatParam(data, ['pixelRefe'], -1)));
      cmd.push('--ang', String(getFloatParam(data, ['angular'], 5)));

      // Lowpass and highpass filters for references
      cmd.push('--lowpass', String(getFloatParam(data, ['lowpassFilterReference'], 20)));
      const highpass = getFloatParam(data, ['HighpassFilterReference', 'highpassFilterReference'], -1);
      if (highpass > 0) {
        cmd.push('--highpass', String(highpass));
      }

      // Invert contrast for template matching
      if (getBoolParam(data, ['contrast'], false)) {
        cmd.push('--invert');
      }

      // CTF correction
      if (getBoolParam(data, ['corrected'], false)) {
        cmd.push('--ctf');

        // Ignore CTF until first peak
        if (getBoolParam(data, ['peak'], false)) {
          cmd.push('--ctf_intact_first_peak');
        }
      }
    }

    // Autopicking parameters
    cmd.push('--threshold', String(getFloatParam(data, ['pickingThreshold'], 0.05)));
    cmd.push('--min_distance', String(getFloatParam(data, ['interParticle'], 100)));
    cmd.push('--max_stddev_noise', String(getFloatParam(data, ['maxStddev'], 1)));
    cmd.push('--min_avg_noise', String(getFloatParam(data, ['minavg'], -999)));

    // FOM maps
    if (getBoolParam(data, ['writeFOMMaps'], false)) {
      cmd.push('--write_fom_maps');
    }

    if (getBoolParam(data, ['readFOMMaps'], false)) {
      cmd.push('--read_fom_maps');
    }

    // GPU acceleration - only for template matching (LoG doesn't support GPU)
    if (getBoolParam(data, ['useAcceleration'], false) && !useLaplacian) {
      const gpuIds = getGpuIds(data);
      cmd.push('--gpu', gpuIds);
    }

    // Helix options
    if (getBoolParam(data, ['pick2DHelicalSeg'], false)) {
      cmd.push('--helix');
      cmd.push('--helical_tube_outer_diameter', String(getFloatParam(data, ['tubeDiameter'], 200)));

      const minLength = getFloatParam(data, ['minLength'], -1);
      if (minLength > 0) {
        cmd.push('--helical_tube_length_min', String(minLength));
      }
    }

    // Enable PNG thumbnail generation (all micrographs)
    cmd.push('--do_thumbnails', 'true');
    cmd.push('--thumbnail_size', '512');
    cmd.push('--thumbnail_count', '-1');

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[AutoPick] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[AutoPick] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = AutoPickBuilder;
