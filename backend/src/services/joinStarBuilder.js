/**
 * Join STAR Files Job Builder
 *
 * Builds RELION relion_star_handler commands for combining STAR files.
 */

const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getBoolParam,
  getParam
} = require('../utils/paramHelper');

class JoinStarBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'JoinStar';
  }

  // Join STAR files is CPU-only
  get supportsGpu() {
    return false;
  }

  // relion_star_handler is NOT an MPI command
  get supportsMpi() {
    return false;
  }

  validate() {
    const combineParticles = getBoolParam(this.data, ['combineParticles', 'combine_particles'], false);
    const combineMicrographs = getBoolParam(this.data, ['combineMicrographs', 'combine_micrographs'], false);
    const combineMovies = getBoolParam(this.data, ['combineMovies', 'combine_movies'], false);

    if (!combineParticles && !combineMicrographs && !combineMovies) {
      return { valid: false, error: 'At least one type of file combination must be selected' };
    }

    logger.info(`[JoinStar] Validation passed | particles: ${combineParticles}, micrographs: ${combineMicrographs}, movies: ${combineMovies}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    const cmd = ['relion_star_handler', '--combine'];

    // Combine particle STARs
    if (getBoolParam(data, ['combineParticles', 'combine_particles'], false)) {
      const inputs = [
        getParam(data, ['particlesStarFile1', 'particles_star_file_1'], null),
        getParam(data, ['particlesStarFile2', 'particles_star_file_2'], null),
        getParam(data, ['particlesStarFile3', 'particles_star_file_3'], null),
        getParam(data, ['particlesStarFile4', 'particles_star_file_4'], null)
      ].filter(Boolean).join(' ');

      if (inputs) {
        cmd.push('--i', inputs);
        cmd.push('--o', path.join(relOutputDir, 'join_particles.star'));
      }
    }

    // Combine micrograph STARs
    if (getBoolParam(data, ['combineMicrographs', 'combine_micrographs'], false)) {
      const inputs = [
        getParam(data, ['micrographStarFile1', 'micrograph_star_file_1'], null),
        getParam(data, ['micrographStarFile2', 'micrograph_star_file_2'], null),
        getParam(data, ['micrographStarFile3', 'micrograph_star_file_3'], null),
        getParam(data, ['micrographStarFile4', 'micrograph_star_file_4'], null)
      ].filter(Boolean).join(' ');

      if (inputs) {
        cmd.push('--i', inputs);
        cmd.push('--o', path.join(relOutputDir, 'join_micrographs.star'));
      }
    }

    // Combine movie STARs
    if (getBoolParam(data, ['combineMovies', 'combine_movies'], false)) {
      const inputs = [
        getParam(data, ['movieStarFile1', 'movie_star_file_1'], null),
        getParam(data, ['movieStarFile2', 'movie_star_file_2'], null),
        getParam(data, ['movieStarFile3', 'movie_star_file_3'], null),
        getParam(data, ['movieStarFile4', 'movie_star_file_4'], null)
      ].filter(Boolean).join(' ');

      if (inputs) {
        cmd.push('--i', inputs);
        cmd.push('--o', path.join(relOutputDir, 'join_movies.star'));
      }
    }

    cmd.push('--pipeline_control', relOutputDir);

    logger.info(`[JoinStar] Command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = JoinStarBuilder;
