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
    const micrographStar = getParam(this.data, ['micrograph_star_file', 'micrographStarFile'], null);
    if (!micrographStar) {
      return { valid: false, error: 'Micrograph STAR file is required' };
    }

    let result = this.validateFileExists(micrographStar, 'Micrograph STAR file');
    if (!result.valid) {
      return result;
    }

    // Check for input coordinates if not re-extracting
    if (!getBoolParam(this.data, ['reExtractRefinedParticles', 're_extract_refined_particles'], false)) {
      const inputCoords = getParam(this.data, ['inputCoordinates', 'coords_star_file', 'coordsStarFile'], null);
      if (!inputCoords) {
        return { valid: false, error: 'Input coordinates are required when not re-extracting refined particles' };
      }
    }

    // Validate box sizes
    const boxSize = getIntParam(this.data, ['particleBoxSize', 'box_size', 'boxSize'], 128);
    if (boxSize <= 0) {
      return { valid: false, error: `Particle box size must be positive, got ${boxSize}` };
    }
    if (boxSize % 2 !== 0) {
      return { valid: false, error: `Particle box size must be an even number, got ${boxSize}` };
    }

    if (getBoolParam(this.data, ['rescaleParticles', 'rescale_particles'], false)) {
      const rescaledSize = getIntParam(this.data, ['rescaledSize', 'rescaled_size'], 128);
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
    if (getBoolParam(this.data, ['reExtractRefinedParticles', 're_extract_refined_particles'], false)) {
      const refinedStar = getParam(this.data, ['refinedParticlesStarFile', 'refined_particles_star_file'], null);
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
    const extractSize = getIntParam(data, ['particleBoxSize', 'box_size', 'boxSize'], 128);
    const rescaleEnabled = getBoolParam(data, ['rescaleParticles', 'rescale_particles'], false);
    const rescaledSize = rescaleEnabled ? getIntParam(data, ['rescaledSize', 'rescaled_size'], 128) : extractSize;

    // Determine effective box size for bg_radius calculation
    const effectiveSize = rescaleEnabled ? rescaledSize : extractSize;

    // Calculate background radius
    let bgRadius = getFloatParam(data, ['diameterBackgroundCircle', 'bg_radius', 'bgRadius'], -1);

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
    const micrographStar = getParam(data, ['micrographStarFile', 'micrograph_star_file'], null);
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
    if (!getBoolParam(data, ['reExtractRefinedParticles', 're_extract_refined_particles'], false)) {
      // Use coordinates from picking job
      const inputCoords = getParam(data, ['inputCoordinates', 'coords_star_file', 'coordsStarFile'], null);
      if (inputCoords) {
        const relCoords = this.makeRelative(this.resolveInputPath(inputCoords));
        cmd.push('--coord_list', relCoords);
      }
    } else {
      // Re-extract from refined particles
      const refinedStar = getParam(data, ['refinedParticlesStarFile', 'refined_particles_star_file'], null);
      if (refinedStar) {
        const relRefined = this.makeRelative(this.resolveInputPath(refinedStar));
        cmd.push('--reextract_data_star', relRefined);
      } else {
        logger.warn('[Extract] Re-extract mode enabled but no refined particles STAR file provided - RELION will likely fail');
      }
    }

    // Offsets / recentering
    if (getBoolParam(data, ['resetRefinedOffsets', 'reset_refined_offsets'], false)) {
      cmd.push('--reset_offsets');
    }

    if (getBoolParam(data, ['reCenterRefinedCoordinates', 'recenter_refined_coordinates'], false)) {
      cmd.push('--recenter');
      cmd.push('--recenter_x', String(getFloatParam(data, ['reCenterCoordsX', 'xRec'], 0)));
      cmd.push('--recenter_y', String(getFloatParam(data, ['reCenterCoordsY', 'yRec'], 0)));
      cmd.push('--recenter_z', String(getFloatParam(data, ['reCenterCoordsZ', 'zRec'], 0)));
    }

    // Image format
    if (getBoolParam(data, ['writeOutputInFloat16', 'write_output_in_float16'], false)) {
      cmd.push('--float16');
    }

    // Invert contrast
    if (getBoolParam(data, ['invertContrast', 'invert_contrast', 'do_invert', 'doInvert'], false)) {
      cmd.push('--invert_contrast');
    }

    // Normalization
    if (getBoolParam(data, ['normalizeParticles', 'normalize_particles', 'do_normalize', 'doNormalize'], true)) {
      cmd.push('--norm');
      cmd.push('--bg_radius', String(bgRadius.toFixed(2)));

      const whiteDust = getFloatParam(data, ['stddevWhiteDust', 'white_dust', 'whiteDust'], -1);
      const blackDust = getFloatParam(data, ['stddevBlackDust', 'black_dust', 'blackDust'], -1);
      cmd.push('--white_dust', String(whiteDust));
      cmd.push('--black_dust', String(blackDust));
    }

    // Rescale
    if (rescaleEnabled) {
      cmd.push('--scale', String(rescaledSize));
    }

    // FOM threshold for autopick filtering
    // Note: RELION 4+ uses --minimum_pick_fom instead of deprecated --minimum_fom_threshold
    if (getBoolParam(data, ['useAutopickFomThreshold', 'useAutopickFOMThreshold', 'use_autopick_fom_threshold'], false)) {
      const minFom = getFloatParam(data, ['minimumAutopickFom', 'minimumAutopickFOM', 'minimum_autopick_fom'], 0);
      cmd.push('--minimum_pick_fom', String(minFom));
    }

    // Helix mode
    if (getBoolParam(data, ['extractHelicalSegments', 'extract_helical_segments'], false)) {
      cmd.push('--helix');
      cmd.push('--helical_outer_diameter', String(getFloatParam(data, ['tubeDiameter', 'tube_diameter'], 200)));

      if (getBoolParam(data, ['useBimodalAngularPriors', 'use_bimodal_angular_priors'], false)) {
        cmd.push('--helical_bimodal_angular_priors');
      }

      if (getBoolParam(data, ['coordinatesStartEndOnly', 'coordinates_start_end_only'], false)) {
        cmd.push('--helical_tubes');
      }

      if (getBoolParam(data, ['cutHelicalSegments', 'cut_helical_segments'], false)) {
        cmd.push('--helical_cut_into_segments');
      }

      cmd.push('--helical_nr_asu', String(getIntParam(data, ['numAsymmetricalUnits', 'num_asymmetrical_units'], 1)));
      cmd.push('--helical_rise', String(getFloatParam(data, ['helicalRise', 'helical_rise'], 1)));
    }

    // Pipeline control
    cmd.push('--pipeline_control', path.resolve(outputDir) + path.sep);

    // Additional arguments
    this.addAdditionalArguments(cmd);

    logger.info(`[Extract] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Extract] Command: Full | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = ExtractBuilder;
