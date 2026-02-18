/**
 * Particle Extraction Job Builder
 *
 * Builds RELION particle extraction commands.
 * Matches Python extract_builder.py functionality.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getMpiProcs,
  getThreads,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class ExtractBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Extract';
  }

  // Particle extraction is CPU-only
  get supportsGpu() {
    return false;
  }

  validate() {
    // Need micrographs STAR file
    const micrographStar = getParam(this.data, ['micrographStarFile'], null);
    if (!micrographStar) {
      return { valid: false, error: 'Micrograph STAR file is required' };
    }

    let result = this.validateFileExists(micrographStar, 'Micrograph STAR file');
    if (!result.valid) {
      return result;
    }

    // Check for input coordinates if not re-extracting
    if (!getBoolParam(this.data, ['reExtractRefinedParticles'], false)) {
      const inputCoords = getParam(this.data, ['inputCoordinates'], null);
      if (!inputCoords) {
        return { valid: false, error: 'Input coordinates are required when not re-extracting refined particles' };
      }
    }

    // Validate box sizes
    const boxSize = getIntParam(this.data, ['particleBoxSize'], 128);
    if (boxSize <= 0) {
      return { valid: false, error: `Particle box size must be positive, got ${boxSize}` };
    }
    if (boxSize % 2 !== 0) {
      return { valid: false, error: `Particle box size must be an even number, got ${boxSize}` };
    }

    if (getBoolParam(this.data, ['rescaleParticles'], false)) {
      const rescaledSize = getIntParam(this.data, ['rescaledSize'], 128);
      if (rescaledSize <= 0) {
        return { valid: false, error: `Re-scaled size must be positive, got ${rescaledSize}` };
      }
      if (rescaledSize % 2 !== 0) {
        return { valid: false, error: `Re-scaled size must be an even number, got ${rescaledSize}` };
      }
      if (rescaledSize > boxSize) {
        return { valid: false, error: `Re-scaled size (${rescaledSize}) cannot be larger than box size (${boxSize})` };
      }
    }

    // Validate re-extract has required refined particles file
    if (getBoolParam(this.data, ['reExtractRefinedParticles'], false)) {
      const refinedStar = getParam(this.data, ['refinedParticlesStarFile'], null);
      if (!refinedStar) {
        return { valid: false, error: 'Refined particles STAR file is required when re-extracting refined particles' };
      }
    }

    logger.info(`[Extract] Validation passed`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const data = this.data;
    const relOutputDir = this.makeRelative(outputDir);

    logger.info(`[Extract] Command: Building | job_name: ${jobName}`);

    // Extract parameters using paramHelper
    const extractSize = getIntParam(data, ['particleBoxSize'], 128);
    const rescaleEnabled = getBoolParam(data, ['rescaleParticles'], false);
    const rescaledSize = rescaleEnabled ? getIntParam(data, ['rescaledSize'], 128) : extractSize;

    // Determine effective box size for bg_radius calculation
    const effectiveSize = rescaleEnabled ? rescaledSize : extractSize;

    // Calculate background radius
    let bgRadius = getFloatParam(data, ['diameterBackgroundCircle'], -1);

    if (bgRadius > 0) {
      // Convert diameter to radius
      bgRadius = bgRadius / 2.0;
      // Scale bg_radius proportionally if rescaling
      if (rescaleEnabled && extractSize > 0) {
        const scaleFactor = rescaledSize / extractSize;
        bgRadius = bgRadius * scaleFactor;
      }
    } else {
      // Auto-set to 75% of half effective size if not provided
      bgRadius = 0.75 * (effectiveSize / 2.0);
    }

    // Safety correction - must satisfy 2 * bg_radius < effective_size
    if (2 * bgRadius >= effectiveSize) {
      bgRadius = effectiveSize / 2.5;
      logger.warn(`[Extract] Auto-adjusted bg_radius=${bgRadius.toFixed(2)} to fit box size ${effectiveSize}`);
    }

    // Get micrograph STAR file
    const micrographStar = getParam(data, ['micrographStarFile'], null);
    const relMics = this.makeRelative(this.resolveInputPath(micrographStar));

    // Get MPI processes for parallel extraction
    // Debug: log all potential MPI field values
    logger.info(`[Extract] MPI fields: numberOfMpiProcs=${data.numberOfMpiProcs}, mpiProcs=${data.mpiProcs}, mpi_procs=${data.mpi_procs}, runningmpi=${data.runningmpi}, nr_mpi=${data.nr_mpi}`);
    const mpiProcs = getMpiProcs(data);
    logger.info(`[Extract] MPI procs result: ${mpiProcs}`);

    // Build command with MPI support (relion_preprocess_mpi exists for parallel extraction)
    // Particle extraction is CPU-only (supportsGpu = false)
    const cmd = this.buildMpiCommand('relion_preprocess', mpiProcs, false);

    // Add required parameters
    cmd.push('--i', relMics);
    cmd.push('--part_dir', relOutputDir);
    cmd.push('--part_star', path.join(relOutputDir, 'particles.star'));
    cmd.push('--extract');
    cmd.push('--extract_size', String(extractSize));

    // Handle re-extraction logic
    if (!getBoolParam(data, ['reExtractRefinedParticles'], false)) {
      // Use coordinates from picking job
      // RELION uses --coord_dir (directory) + --coord_suffix (suffix pattern)
      // Coordinate paths follow convention: AutoPick/JobXXX/coords_suffix_autopick.star
      const inputCoords = getParam(data, ['inputCoordinates'], null);
      if (inputCoords) {
        const relCoords = this.makeRelative(this.resolveInputPath(inputCoords));
        const coordDir = path.dirname(relCoords) + path.sep;
        const basename = path.basename(relCoords);

        // Extract suffix from RELION pipeline convention: coords_suffix_<suffix>
        let coordSuffix;
        const suffixMatch = basename.match(/^coords_suffix(.+)$/);
        if (suffixMatch) {
          coordSuffix = suffixMatch[1];
        } else {
          // Fallback: use _autopick.star as default suffix
          coordSuffix = '_autopick.star';
          logger.warn(`[Extract] Could not extract coord suffix from ${basename}, using default: ${coordSuffix}`);
        }

        cmd.push('--coord_dir', coordDir);
        cmd.push('--coord_suffix', coordSuffix);
      }
    } else {
      // Re-extract from refined particles
      const refinedStar = getParam(data, ['refinedParticlesStarFile'], null);
      if (refinedStar) {
        const relRefined = this.makeRelative(this.resolveInputPath(refinedStar));
        cmd.push('--reextract_data_star', relRefined);
      } else {
        logger.warn('[Extract] Re-extract mode enabled but no refined particles STAR file provided - RELION will likely fail');
      }
    }

    // Offsets / recentering
    if (getBoolParam(data, ['resetRefinedOffsets'], false)) {
      cmd.push('--reset_offsets');
    }

    if (getBoolParam(data, ['reCenterRefinedCoordinates'], false)) {
      cmd.push('--recenter');
      cmd.push('--recenter_x', String(getFloatParam(data, ['xRec', 'reCenterCoordsX'], 0)));
      cmd.push('--recenter_y', String(getFloatParam(data, ['yRec', 'reCenterCoordsY'], 0)));
      cmd.push('--recenter_z', String(getFloatParam(data, ['zRec', 'reCenterCoordsZ'], 0)));
    }

    // Image format
    if (getBoolParam(data, ['writeOutputInFloat16'], false)) {
      cmd.push('--float16');
    }

    // Invert contrast
    if (getBoolParam(data, ['invertContrast'], false)) {
      cmd.push('--invert_contrast');
    }

    // Normalization
    if (getBoolParam(data, ['normalizeParticles'], true)) {
      cmd.push('--norm');
      cmd.push('--bg_radius', String(bgRadius.toFixed(2)));

      const whiteDust = getFloatParam(data, ['stddevWhiteDust'], -1);
      const blackDust = getFloatParam(data, ['stddevBlackDust'], -1);
      if (whiteDust > 0) {
        cmd.push('--white_dust', String(whiteDust));
      }
      if (blackDust > 0) {
        cmd.push('--black_dust', String(blackDust));
      }
    }

    // Rescale
    if (rescaleEnabled) {
      cmd.push('--scale', String(rescaledSize));
    }

    // FOM threshold for autopick filtering
    // Note: RELION 4+ uses --minimum_pick_fom instead of deprecated --minimum_fom_threshold
    if (getBoolParam(data, ['useAutopickFOMThreshold', 'useAutopickFomThreshold'], false)) {
      const minFom = getFloatParam(data, ['minimumAutopickFOM', 'minimumAutopickFom'], 0);
      cmd.push('--minimum_pick_fom', String(minFom));
    }

    // Helix mode
    if (getBoolParam(data, ['extractHelicalSegments'], false)) {
      cmd.push('--helix');
      cmd.push('--helical_outer_diameter', String(getFloatParam(data, ['tubeDiameter'], 200)));

      if (getBoolParam(data, ['useBimodalAngularPriors'], false)) {
        cmd.push('--helical_bimodal_angular_priors');
      }

      if (getBoolParam(data, ['coordinatesStartEndOnly'], false)) {
        cmd.push('--helical_tubes');
      }

      if (getBoolParam(data, ['cutHelicalSegments'], false)) {
        cmd.push('--helical_cut_into_segments');
      }

      cmd.push('--helical_nr_asu', String(getIntParam(data, ['numAsymmetricalUnits'], 1)));
      cmd.push('--helical_rise', String(getFloatParam(data, ['helicalRise'], 1)));
    }

    // Threads
    const threads = getThreads(data);
    if (threads > 1) {
      cmd.push('--j', String(threads));
    }

    // Pipeline control
    cmd.push('--pipeline_control', relOutputDir + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Extract] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Extract] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = ExtractBuilder;
