/**
 * Subset Selection Job Builder
 *
 * Builds RELION relion_star_handler and relion_class_ranker commands for subset selection.
 */

const path = require('path');
const fs = require('fs');
const glob = require('glob');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const {
  getBoolParam,
  getIntParam,
  getFloatParam,
  getParam
} = require('../utils/paramHelper');

class SubsetBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'Select';
  }

  // Subset selection is CPU-only
  get supportsGpu() {
    return false;
  }

  // relion_star_handler and relion_class_ranker are NOT MPI commands
  get supportsMpi() {
    return false;
  }

  validate() {
    const inputFile = getParam(this.data, [
      'classFromJob',
      'particlesStar',
      'microGraphsStar'
    ], null);

    if (!inputFile) {
      return { valid: false, error: 'At least one input STAR file is required' };
    }

    logger.info(`[Subset] Validation passed | input: ${inputFile}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    const data = this.data;

    // Input file
    const classInput = getParam(data, ['classFromJob'], null);
    const particlesInput = getParam(data, ['particlesStar'], null);
    const micrographsInput = getParam(data, ['microGraphsStar'], null);
    const inputFile = classInput || particlesInput || micrographsInput;

    const outputFile = path.join(relOutputDir, 'particles.star');

    // Check if auto-select 2D classes is enabled
    const autoSelect = getBoolParam(data, ['select2DClass'], false);

    if (autoSelect) {
      return this.buildClassRankerCommand(data, inputFile, outputFile, relOutputDir);
    } else {
      return this.buildStarHandlerCommand(data, inputFile, outputFile);
    }
  }

  buildClassRankerCommand(data, inputFile, outputFile, relOutputDir) {
    // relion_class_ranker needs _optimiser.star file
    let optimiserFile = inputFile;
    if (inputFile.includes('_data.star')) {
      optimiserFile = inputFile.replace('_data.star', '_optimiser.star');
    } else if (inputFile.includes('_model.star')) {
      optimiserFile = inputFile.replace('_model.star', '_optimiser.star');
    }

    // Check if optimiser file exists and find latest if not
    const fullOptPath = path.join(this.projectPath, optimiserFile);
    if (!fs.existsSync(fullOptPath)) {
      const jobDir = path.dirname(fullOptPath);
      if (fs.existsSync(jobDir)) {
        const optFiles = glob.sync(path.join(jobDir, '*_optimiser.star')).sort();
        if (optFiles.length > 0) {
          optimiserFile = path.relative(this.projectPath, optFiles[optFiles.length - 1]);
          logger.info(`[Subset] Using latest optimiser: ${optimiserFile}`);
        }
      }
    }

    const cmd = [
      'relion_class_ranker',
      '--opt', optimiserFile,
      '--o', relOutputDir + path.sep,
      '--auto_select'
    ];

    // Threshold for auto-selection
    const threshold = getFloatParam(data, ['minThresholdAutoSelect'], 0.5);
    cmd.push('--min_score', String(threshold));

    // Minimum particles (RELION uses --select_min_nr_particles)
    const minParticles = getIntParam(data, ['manyParticles'], -1);
    if (minParticles > 0) {
      cmd.push('--select_min_nr_particles', String(minParticles));
    }

    // Minimum classes (RELION uses --select_min_nr_classes)
    const minClasses = getIntParam(data, ['manyClasses'], -1);
    if (minClasses > 0) {
      cmd.push('--select_min_nr_classes', String(minClasses));
    }

    cmd.push('--pipeline_control', relOutputDir + path.sep);

    logger.info(`[Subset] ClassRanker command built | ${cmd.join(' ')}`);
    return cmd;
  }

  buildStarHandlerCommand(data, inputFile, outputFile) {
    const cmd = [
      'relion_star_handler',
      '--i', inputFile,
      '--o', outputFile
    ];

    // Selection based on metadata values
    if (getBoolParam(data, ['metaDataValues'], false)) {
      const metadataLabel = getParam(data, ['metaDataLabel'], 'rlnCtfMaxResolution');
      const minVal = getFloatParam(data, ['minMetaData'], -9999);
      const maxVal = getFloatParam(data, ['maxMetaData'], 9999);

      cmd.push('--select', metadataLabel);
      cmd.push('--minval', String(minVal));
      cmd.push('--maxval', String(maxVal));
    }

    // Select on image statistics
    if (getBoolParam(data, ['imageStatics'], false)) {
      const imageLabel = getParam(data, ['metaDataForImage'], 'rlnImageName');
      const sigma = getFloatParam(data, ['SigmaValue'], 4);
      cmd.push('--discard_on_stats');
      cmd.push('--discard_label', imageLabel);
      cmd.push('--discard_sigma', String(sigma));
    }

    // Split into subsets
    if (getBoolParam(data, ['split'], false)) {
      cmd.push('--split');

      if (getBoolParam(data, ['randomise'], false)) {
        cmd.push('--random_order');
      }

      const numSubsets = getIntParam(data, ['numberSubsets'], -1);
      const subsetSize = getIntParam(data, ['subsetSize'], 100);

      if (numSubsets > 0) {
        cmd.push('--nr_split', String(numSubsets));
      } else if (subsetSize > 0) {
        cmd.push('--size_split', String(subsetSize));
      }
    }

    // Remove duplicates
    if (getBoolParam(data, ['removeDuplicates'], false)) {
      const minDistance = getFloatParam(data, ['minParticleDistance'], -1);
      const pixelSize = getFloatParam(data, ['pixelSizeExtraction'], -1);

      if (minDistance > 0) {
        // Spatial duplicate removal: --remove_duplicates takes distance in Angstroms
        cmd.push('--remove_duplicates', String(minDistance));
        if (pixelSize > 0) {
          cmd.push('--image_angpix', String(pixelSize));
        }
      } else {
        // No distance specified: use minimum distance of 0 to remove exact positional duplicates
        cmd.push('--remove_duplicates', '0');
        if (pixelSize > 0) {
          cmd.push('--image_angpix', String(pixelSize));
        }
      }
    }

    logger.info(`[Subset] StarHandler command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = SubsetBuilder;
