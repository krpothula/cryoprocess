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
      'classFromJob', 'class_from_job',
      'selectClassesFromJob', 'select_classes_from_job',
      'particlesStar', 'particles_star',
      'microGraphsStar', 'micrographsStar', 'micrographs_star'
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
    const classInput = getParam(data, ['classFromJob', 'class_from_job', 'selectClassesFromJob', 'select_classes_from_job'], null);
    const particlesInput = getParam(data, ['particlesStar', 'particles_star'], null);
    const micrographsInput = getParam(data, ['microGraphsStar', 'micrographsStar', 'micrographs_star'], null);
    const inputFile = classInput || particlesInput || micrographsInput;

    const outputFile = path.join(relOutputDir, 'particles.star');

    // Check if auto-select 2D classes is enabled
    const autoSelect = getBoolParam(data, ['select2DClass', 'select_2d_class', 'autoSelect'], false);

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
    const threshold = getFloatParam(data, ['minThresholdAutoSelect', 'min_threshold_auto_select'], 0.5);
    cmd.push('--min_score', String(threshold));

    // Minimum particles
    const minParticles = getIntParam(data, ['manyParticles', 'many_particles', 'minParticles'], -1);
    if (minParticles > 0) {
      cmd.push('--min_particles', String(minParticles));
    }

    // Minimum classes
    const minClasses = getIntParam(data, ['manyClasses', 'many_classes', 'minClasses'], -1);
    if (minClasses > 0) {
      cmd.push('--min_classes', String(minClasses));
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
    if (getBoolParam(data, ['metaDataValues', 'meta_data_values'], false)) {
      const metadataLabel = getParam(data, ['metaDataLabel', 'meta_data_label'], 'rlnCtfMaxResolution');
      const minVal = getFloatParam(data, ['minMetaData', 'min_meta_data'], -9999);
      const maxVal = getFloatParam(data, ['maxMetaData', 'max_meta_data'], 9999);

      cmd.push('--select', metadataLabel);
      cmd.push('--minval', String(minVal));
      cmd.push('--maxval', String(maxVal));
    }

    // Select on image statistics
    if (getBoolParam(data, ['imageStatics', 'image_statics', 'imageStatistics'], false)) {
      const imageLabel = getParam(data, ['metaDataForImage', 'meta_data_for_image'], 'rlnImageName');
      const sigma = getFloatParam(data, ['SigmaValue', 'sigmaValue', 'sigma_value'], 4);
      cmd.push('--discard_on_stats');
      cmd.push('--discard_label', imageLabel);
      cmd.push('--discard_sigma', String(sigma));
    }

    // Split into subsets
    if (getBoolParam(data, ['split'], false)) {
      cmd.push('--split');

      if (getBoolParam(data, ['randomise', 'randomize'], false)) {
        cmd.push('--random_order');
      }

      const numSubsets = getIntParam(data, ['numberSubsets', 'number_subsets'], -1);
      const subsetSize = getIntParam(data, ['subsetSize', 'subset_size'], 100);

      if (numSubsets > 0) {
        cmd.push('--nr_split', String(numSubsets));
      } else if (subsetSize > 0) {
        cmd.push('--size_split', String(subsetSize));
      }
    }

    // Remove duplicates
    if (getBoolParam(data, ['removeDuplicates', 'remove_duplicates'], false)) {
      cmd.push('--check_duplicates', 'rlnImageName');
    }

    logger.info(`[Subset] StarHandler command built | ${cmd.join(' ')}`);
    return cmd;
  }
}

module.exports = SubsetBuilder;
