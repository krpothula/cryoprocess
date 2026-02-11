/**
 * Link Movies Job Builder
 *
 * Creates symlink from source folder to project's Movies directory.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const { getParam } = require('../utils/paramHelper');

class LinkMoviesBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'LinkMovies';
  }

  // Link movies is CPU-only (file operations)
  get supportsGpu() {
    return false;
  }

  validate() {
    const sourcePath = getParam(this.data, ['source_path', 'sourcePath'], null);

    if (!sourcePath) {
      return { valid: false, error: 'Source path is required' };
    }

    if (!fs.existsSync(sourcePath)) {
      return { valid: false, error: `Source path does not exist: ${sourcePath}` };
    }

    const stat = fs.statSync(sourcePath);
    if (!stat.isDirectory()) {
      return { valid: false, error: `Source path is not a directory: ${sourcePath}` };
    }

    logger.info(`[LinkMovies] Validation passed | source: ${sourcePath}`);
    return { valid: true, error: null };
  }

  /**
   * Override getOutputDir to NOT create folders.
   * LinkMovies only creates a symlink, no output directory needed.
   * @param {string} jobName - Job name (unused)
   * @returns {null} No output directory
   */
  getOutputDir(_jobName) {
    // LinkMovies doesn't create output folders - only a symlink
    return null;
  }

  buildCommand(outputDir, jobName) {
    // LinkMovies doesn't need a command - it creates symlink directly
    return null;
  }

  /**
   * Execute the symlink creation directly
   * @returns {Object} Result with status
   */
  execute() {
    const sourcePath = getParam(this.data, ['source_path', 'sourcePath'], null);
    const moviesPath = path.join(this.projectPath, 'Movies');

    try {
      // Remove existing if present
      if (fs.existsSync(moviesPath)) {
        const stat = fs.lstatSync(moviesPath);
        if (stat.isSymbolicLink()) {
          fs.unlinkSync(moviesPath);
          logger.debug(`[LinkMovies] Removed existing symlink: ${moviesPath}`);
        } else if (stat.isDirectory()) {
          fs.rmdirSync(moviesPath);
          logger.debug(`[LinkMovies] Removed existing folder: ${moviesPath}`);
        }
      }

      // Create symlink
      fs.symlinkSync(sourcePath, moviesPath);
      logger.info(`[LinkMovies] Created symlink: ${moviesPath} -> ${sourcePath}`);

      return {
        status: 'success',
        message: 'Movies linked successfully',
        source: sourcePath,
        destination: moviesPath,
        project_folder: this.projectPath
      };
    } catch (error) {
      logger.error(`[LinkMovies] Error: ${error.message}`);
      return {
        status: 'error',
        message: error.message
      };
    }
  }
}

module.exports = LinkMoviesBuilder;
