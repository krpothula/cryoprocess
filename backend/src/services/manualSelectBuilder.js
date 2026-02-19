/**
 * Manual Class Selection Job Builder
 *
 * Filters particles from a classification job based on selected class numbers.
 * This builder doesn't run a RELION command - it directly filters the STAR file.
 */

const fs = require('fs');
const path = require('path');
const logger = require('../utils/logger');
const BaseJobBuilder = require('./baseBuilder');
const { parseStarFile, writeStarFile } = require('../utils/starParser');
const { getParam } = require('../utils/paramHelper');

class ManualSelectBuilder extends BaseJobBuilder {
  constructor(data, project, user) {
    super(data, project, user);
    this.stageName = 'ManualSelect';
    this._selectionResult = null;
  }

  // Manual selection is CPU-only (file operations)
  get supportsGpu() {
    return false;
  }

  validate() {
    const classFromJob = getParam(this.data, ['classFromJob'], null);
    let selectedClasses = getParam(this.data, ['selectedClasses'], null);

    if (!classFromJob) {
      return { valid: false, error: 'Please select a classification job' };
    }

    if (!selectedClasses || (Array.isArray(selectedClasses) && selectedClasses.length === 0)) {
      return { valid: false, error: 'Please select at least one class' };
    }

    // Verify the input file exists
    let dataStarPath = classFromJob;
    if (dataStarPath.includes('_model.star')) {
      dataStarPath = dataStarPath.replace('_model.star', '_data.star');
    } else if (dataStarPath.includes('_optimiser.star')) {
      dataStarPath = dataStarPath.replace('_optimiser.star', '_data.star');
    }

    const fullPath = path.join(this.projectPath, dataStarPath);
    if (!fs.existsSync(fullPath)) {
      return { valid: false, error: `Data file does not exist: ${dataStarPath}` };
    }

    logger.info(`[ManualSelect] Validation passed | classFromJob: ${classFromJob}`);
    return { valid: true, error: null };
  }

  buildCommand(outputDir, jobName) {
    // ManualSelect doesn't return a command to run
    // Instead, we perform the selection directly here
    const data = this.data;
    const classFromJob = getParam(data, ['classFromJob'], null);
    let selectedClasses = getParam(data, ['selectedClasses'], null);

    logger.info(`[ManualSelect] Building selection | job_name: ${jobName}`);
    logger.info(`[ManualSelect] Input: ${classFromJob}`);
    logger.info(`[ManualSelect] Selected classes: ${selectedClasses}`);

    // Convert selectedClasses to integers
    if (typeof selectedClasses === 'string') {
      selectedClasses = selectedClasses.split(',').map(x => parseInt(x.trim())).filter(x => !isNaN(x));
    } else if (Array.isArray(selectedClasses)) {
      selectedClasses = selectedClasses.map(x => parseInt(x)).filter(x => !isNaN(x));
    }

    // Convert to data.star path
    let dataStarPath = classFromJob;
    if (dataStarPath.includes('_model.star')) {
      dataStarPath = dataStarPath.replace('_model.star', '_data.star');
    } else if (dataStarPath.includes('_optimiser.star')) {
      dataStarPath = dataStarPath.replace('_optimiser.star', '_data.star');
    }

    // Resolve full path
    const fullInputPath = dataStarPath.startsWith('/')
      ? dataStarPath
      : path.join(this.projectPath, dataStarPath);

    // Output file path
    const outputFile = path.join(outputDir, 'particles.star');

    try {
      // Parse the input star file
      const starData = parseStarFile(fullInputPath);

      // Find particles data
      const particlesKey = Object.keys(starData).find(k =>
        k.includes('particles') || k === 'data_' || k === 'data_particles'
      );

      if (!particlesKey || !starData[particlesKey]) {
        logger.error('[ManualSelect] No particles table found in star file');
        return null;
      }

      const particles = starData[particlesKey];
      const columns = particles.columns || [];
      const dataRows = particles.data || [];

      // Find rlnClassNumber column
      const classColIdx = columns.findIndex(c =>
        c === '_rlnClassNumber' || c === 'rlnClassNumber'
      );

      if (classColIdx === -1) {
        logger.error('[ManualSelect] No rlnClassNumber column found');
        return null;
      }

      // Filter particles by selected classes
      const selectedSet = new Set(selectedClasses);
      const filteredRows = [];

      for (const row of dataRows) {
        try {
          const classNum = parseInt(parseFloat(row[classColIdx]));
          if (selectedSet.has(classNum)) {
            filteredRows.push(row);
          }
        } catch (e) {
          // Skip problematic rows
        }
      }

      logger.info(`[ManualSelect] Filtered ${filteredRows.length} particles from ${dataRows.length} total`);

      if (filteredRows.length === 0) {
        logger.warn('[ManualSelect] No particles found in selected classes');
        return null;
      }

      // Update particles data
      starData[particlesKey].data = filteredRows;

      // Write output star file
      fs.mkdirSync(outputDir, { recursive: true });
      writeStarFile(outputFile, starData);

      // Create success marker
      const successMarker = path.join(outputDir, 'RELION_JOB_EXIT_SUCCESS');
      fs.writeFileSync(successMarker, '');

      // Store result
      this._selectionResult = {
        outputFile,
        numParticles: filteredRows.length,
        selectedClasses,
        totalParticles: dataRows.length
      };

      logger.info(`[ManualSelect] Successfully saved ${filteredRows.length} particles to ${outputFile}`);

      // Return null to indicate no external command to run
      return null;

    } catch (error) {
      logger.error(`[ManualSelect] Error: ${error.message}`);
      return null;
    }
  }

  getSelectionResult() {
    return this._selectionResult;
  }
}

module.exports = ManualSelectBuilder;
