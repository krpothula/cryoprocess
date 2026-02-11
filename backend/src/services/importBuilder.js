/**
 * Import Job Builder
 *
 * Builds RELION import commands for movies/micrographs and other node types.
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const logger = require('../utils/logger');
const { getProjectPath } = require('../utils/pathUtils');
const settings = require('../config/settings');
const { isPathSafe } = require('../utils/security');
const {
  getBoolParam,
  getFloatParam,
  getParam
} = require('../utils/paramHelper');

// RELION node type mapping
const NODE_TYPE_MAP = {
  '2D references': 'refs2d',
  'Particle coordinates': 'coords',
  '3D reference': 'ref3d',
  '3D mask': 'mask',
  'Unfiltered half-map': 'halfmap'
};

// Output file mapping for node types
const OUTPUT_FILE_MAP = {
  'refs2d': 'class_averages.star',
  'coords': 'coords_suffix_autopick.star',
  'ref3d': 'ref3d.mrc',
  'mask': 'mask.mrc',
  'halfmap': 'halfmap.mrc'
};

/**
 * Import Job Builder class
 */
class ImportJobBuilder {
  constructor(data, project, user) {
    this.data = data;
    this.project = project;
    this.user = user;
    this.projectPath = getProjectPath(project);
    this.stageName = 'Import';
  }

  // Import is CPU-only (no GPU needed)
  get supportsGpu() {
    return false;
  }

  // Import doesn't use MPI
  get supportsMpi() {
    return false;
  }

  /**
   * Validate import job parameters
   * @returns {{valid: boolean, error: string|null}}
   */
  validate() {
    const isOtherImport = getBoolParam(this.data, ['nodetype', 'nodeType', 'node_type'], false);

    if (isOtherImport) {
      return this._validateOtherImport();
    } else {
      return this._validateMoviesImport();
    }
  }

  /**
   * Validate other node type import
   */
  _validateOtherImport() {
    const otherInput = getParam(this.data, ['otherInputFile', 'other_input_file'], '');
    const otherNodeType = getParam(this.data, ['otherNodeType', 'other_node_type'], '');

    if (!otherInput) {
      logger.warn('[Import] Validation: Failed | otherInputFile is required');
      return { valid: false, error: 'Input file is required for other node types' };
    }

    // Security: validate path doesn't contain shell metacharacters
    if (!isPathSafe(otherInput)) {
      logger.warn(`[Import] Validation: Failed | invalid characters in path: ${otherInput}`);
      return { valid: false, error: 'Input path contains invalid characters' };
    }

    if (!otherNodeType) {
      logger.warn('[Import] Validation: Failed | otherNodeType is required');
      return { valid: false, error: 'Node type must be selected' };
    }

    // Check if file exists
    let fullPath;
    if (path.isAbsolute(otherInput)) {
      fullPath = otherInput;
    } else {
      fullPath = path.join(this.projectPath, otherInput);
    }

    if (!fs.existsSync(fullPath)) {
      // Check for wildcard pattern
      if (otherInput.includes('*')) {
        const pattern = path.isAbsolute(otherInput)
          ? otherInput
          : path.join(this.projectPath, otherInput);
        const matches = glob.sync(pattern);
        if (matches.length === 0) {
          logger.warn(`[Import] Validation: Failed | no files match pattern: ${otherInput}`);
          return { valid: false, error: `No files match pattern: ${otherInput}` };
        }
        logger.info(`[Import] Validation: Found ${matches.length} files matching pattern`);
      } else {
        logger.warn(`[Import] Validation: Failed | file not found: ${fullPath}`);
        return { valid: false, error: `Input file not found: ${otherInput}` };
      }
    }

    logger.info(`[Import] Validation: Passed | otherInputFile: ${otherInput}, nodeType: ${otherNodeType}`);
    return { valid: true, error: null };
  }

  /**
   * Validate raw movies/micrographs import
   */
  _validateMoviesImport() {
    const inputFiles = getParam(this.data, ['input_files', 'inputFiles'], '');

    if (!inputFiles) {
      logger.warn('[Import] Validation: Failed | input_files is required');
      return { valid: false, error: 'Input files path is required' };
    }

    // Security: validate path doesn't contain shell metacharacters (allow * for glob)
    // We check the base path without the glob pattern
    const basePath = inputFiles.includes('*') ? path.dirname(inputFiles) : inputFiles;
    if (basePath && !isPathSafe(basePath.replace(/\*/g, ''))) {
      logger.warn(`[Import] Validation: Failed | invalid characters in path: ${inputFiles}`);
      return { valid: false, error: 'Input path contains invalid characters' };
    }

    // Input files can be a glob pattern
    const inputDir = inputFiles.includes('*')
      ? path.dirname(inputFiles)
      : inputFiles;

    logger.info(`[Import] Validation: project_path = ${this.projectPath}`);
    logger.info(`[Import] Validation: input_files = ${inputFiles}`);
    logger.info(`[Import] Validation: input_dir = ${inputDir}`);

    // Try multiple path resolutions
    const pathsToCheck = [inputDir];
    if (this.projectPath && !path.isAbsolute(inputDir)) {
      pathsToCheck.push(path.join(this.projectPath, inputDir));
    }

    let pathExists = false;

    for (const checkPath of pathsToCheck) {
      if (!checkPath) continue;

      if (fs.existsSync(checkPath)) {
        pathExists = true;
        logger.info(`[Import] Validation: Found path at: ${checkPath}`);
        break;
      }

      // Try realpath for symlinks
      try {
        const realPath = fs.realpathSync(checkPath);
        if (fs.existsSync(realPath)) {
          pathExists = true;
          logger.info(`[Import] Validation: Found path via symlink at: ${realPath}`);
          break;
        }
      } catch (err) {
        // Path doesn't exist
      }
    }

    // Check with glob pattern if it contains wildcards
    if (!pathExists && inputFiles.includes('*')) {
      const patterns = [inputFiles];
      if (this.projectPath && !path.isAbsolute(inputFiles)) {
        patterns.push(path.join(this.projectPath, inputFiles));
      }

      for (const pattern of patterns) {
        const matches = glob.sync(pattern);
        if (matches.length > 0) {
          pathExists = true;
          logger.info(`[Import] Validation: Found ${matches.length} files matching pattern: ${pattern}`);
          break;
        }

        // Try with realpath resolution
        const dirPart = path.dirname(pattern);
        const filePart = path.basename(pattern);
        if (dirPart) {
          try {
            const realDir = fs.realpathSync(dirPart);
            if (fs.existsSync(realDir)) {
              const resolvedPattern = path.join(realDir, filePart);
              const matches = glob.sync(resolvedPattern);
              if (matches.length > 0) {
                pathExists = true;
                logger.info(`[Import] Validation: Found ${matches.length} files matching resolved pattern`);
                break;
              }
            }
          } catch (err) {
            // Path doesn't exist
          }
        }
      }
    }

    if (!pathExists && inputDir) {
      logger.warn(`[Import] Validation: Failed | path not found: ${inputDir}`);
      return { valid: false, error: `Input path does not exist: ${inputDir}` };
    }

    logger.info(`[Import] Validation: Passed | input_files: ${inputFiles}`);
    return { valid: true, error: null };
  }

  /**
   * Get output directory for the job
   * @param {string} jobName - Job name (e.g., Job001)
   * @returns {string} Output directory path
   */
  getOutputDir(jobName) {
    const outputDir = path.join(this.projectPath, this.stageName, jobName);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
    }
    return outputDir;
  }

  /**
   * Build the RELION import command
   * @param {string} outputDir - Output directory path
   * @param {string} jobName - Job name
   * @returns {string[]} Command array
   */
  buildCommand(outputDir, jobName) {
    logger.info(`[Import] Command: Building | job_name: ${jobName}`);

    // Compute relative output directory for RELION
    let relOutputDir;
    if (outputDir.startsWith(this.projectPath)) {
      relOutputDir = path.relative(this.projectPath, outputDir);
    } else {
      relOutputDir = outputDir;
    }

    const isOtherImport = getBoolParam(this.data, ['nodetype', 'nodeType', 'node_type'], false);
    logger.info(`[Import] Command: nodetype = '${this.data.nodetype}', import_other = ${isOtherImport}`);

    if (isOtherImport) {
      return this._buildOtherImportCommand(outputDir, relOutputDir);
    } else {
      return this._buildMoviesImportCommand(outputDir, relOutputDir);
    }
  }

  /**
   * Build command for other node type import
   */
  _buildOtherImportCommand(outputDir, relOutputDir) {
    const otherInput = getParam(this.data, ['otherInputFile', 'other_input_file'], '');
    const otherNodeType = getParam(this.data, ['otherNodeType', 'other_node_type'], '3D reference');

    // Get RELION node type value
    const relionNodeType = NODE_TYPE_MAP[otherNodeType] || 'ref3d';

    // Make input path relative to project
    let relativeInput;
    if (otherInput.startsWith(this.projectPath)) {
      relativeInput = path.relative(this.projectPath, otherInput);
    } else {
      relativeInput = otherInput;
    }

    const outputFile = OUTPUT_FILE_MAP[relionNodeType] || 'imported.star';

    const cmd = [
      'relion_import',
      '--do_other',
      '--node_type', relionNodeType,
      '--i', relativeInput,
      '--odir', relOutputDir + path.sep,
      '--ofile', outputFile,
      '--pipeline_control', path.resolve(outputDir) + path.sep
    ];

    // Add optics group rename if specified
    const renameOptics = getParam(this.data, ['renameopticsgroup', 'renameOpticsGroup', 'rename_optics_group'], '');
    if (renameOptics && ['coords', 'refs2d'].includes(relionNodeType)) {
      cmd.push('--optics_group_name', renameOptics);
    }

    logger.info(`[Import] Command: Built other import | node_type: ${otherNodeType} -> ${relionNodeType}`);
    logger.info(`[Import] Command: Full | ${cmd.join(' ')}`);

    return cmd;
  }

  /**
   * Build command for movies/micrographs import
   */
  _buildMoviesImportCommand(outputDir, relOutputDir) {
    // Decide output file based on multiframemovies
    const multiframe = getBoolParam(this.data, ['multiframemovies', 'multiFrameMovies', 'multi_frame_movies'], false);
    let outputFile, movieFlag;

    if (multiframe) {
      outputFile = 'movies.star';
      movieFlag = '--do_movies';
    } else {
      outputFile = 'micrographs.star';
      movieFlag = '--do_micrographs';
    }

    // Handle naming mismatch between frontend/backend
    const optics = getParam(this.data, ['optics_group_name', 'opticsgroupname', 'opticsGroupName'], 'opticsGroup1');

    // Get input path and make it relative
    let inputPath = getParam(this.data, ['input_files', 'inputFiles'], '');
    let relativeInput;
    if (inputPath.startsWith(this.projectPath)) {
      relativeInput = path.relative(this.projectPath, inputPath);
    } else {
      relativeInput = inputPath;
    }

    const cmd = [
      'relion_import',
      movieFlag,
      '--optics_group_name', optics,
      '--angpix', String(getFloatParam(this.data, ['angpix', 'pixelSize', 'pixel_size'], 1.4)),
      '--kV', String(getFloatParam(this.data, ['kV', 'voltage'], 300)),
      '--Cs', String(getFloatParam(this.data, ['spherical', 'Cs', 'sphericalAberration'], 2.7)),
      '--Q0', String(getFloatParam(this.data, ['amplitudeContrast', 'amplitude_contrast', 'Q0'], 0.1)),
      '--beamtilt_x', String(getFloatParam(this.data, ['beamtilt_x', 'beamTiltX'], 0.0)),
      '--beamtilt_y', String(getFloatParam(this.data, ['beamtilt_y', 'beamTiltY'], 0.0)),
      '--i', relativeInput,
      '--odir', relOutputDir + path.sep,
      '--ofile', outputFile,
      '--pipeline_control', path.resolve(outputDir) + path.sep,
      // Enable PNG thumbnail generation
      '--do_thumbnails', 'true',
      '--thumbnail_size', '512',
      '--thumbnail_count', '50'
    ];

    logger.info(`[Import] Command: Built | output_dir: ${outputDir}`);
    logger.info(`[Import] Command: Full | ${cmd.join(' ')}`);

    return cmd;
  }

  /**
   * Get primary input job ID (for pipeline tree)
   * @returns {string} Empty string for import (no input)
   */
  getInputJobId() {
    return '';
  }

  /**
   * Get all input job IDs
   * @returns {string[]} Empty array for import
   */
  getInputJobIds() {
    return [];
  }
}

module.exports = ImportJobBuilder;
