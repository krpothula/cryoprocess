/**
 * Parameter Helper Utilities
 *
 * Simplifies parameter extraction from data objects.
 * Uses canonical camelCase field names matching the frontend form fields.
 */

const { DEFAULTS } = require('../config/constants');

/**
 * Get a parameter value from multiple possible field names
 * @param {Object} data - Data object to extract from
 * @param {Array<string>} names - Array of possible field names to check
 * @param {*} defaultValue - Default value if none found
 * @returns {*} - The found value or default
 */
function getParam(data, names, defaultValue = null) {
  for (const name of names) {
    if (data[name] !== undefined && data[name] !== null && data[name] !== '') {
      return data[name];
    }
  }
  return defaultValue;
}

/**
 * Get an integer parameter from multiple possible field names
 * @param {Object} data - Data object
 * @param {Array<string>} names - Array of possible field names
 * @param {number} defaultValue - Default value
 * @returns {number} - Parsed integer value
 */
function getIntParam(data, names, defaultValue = 0) {
  const value = getParam(data, names, defaultValue);
  const parsed = parseInt(value, 10);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a float parameter from multiple possible field names
 * @param {Object} data - Data object
 * @param {Array<string>} names - Array of possible field names
 * @param {number} defaultValue - Default value
 * @returns {number} - Parsed float value
 */
function getFloatParam(data, names, defaultValue = 0) {
  const value = getParam(data, names, defaultValue);
  const parsed = parseFloat(value);
  return isNaN(parsed) ? defaultValue : parsed;
}

/**
 * Get a boolean parameter from multiple possible field names
 * Handles 'Yes'/'No' strings as well as true/false
 * @param {Object} data - Data object
 * @param {Array<string>} names - Array of possible field names
 * @param {boolean} defaultValue - Default value
 * @returns {boolean}
 */
function getBoolParam(data, names, defaultValue = false) {
  const value = getParam(data, names, null);
  if (value === null) return defaultValue;
  if (typeof value === 'boolean') return value;
  if (typeof value === 'string') {
    return value.toLowerCase() === 'yes' || value.toLowerCase() === 'true';
  }
  return !!value;
}

/**
 * Get MPI process count from data
 * @param {Object} data - Job data object
 * @returns {number} - MPI process count (minimum 1)
 */
function getMpiProcs(data) {
  return Math.max(1, getIntParam(data, [
    'mpiProcs',
    'runningmpi',
    'numberOfMpiProcs'
  ], DEFAULTS.MPI_PROCS));
}

/**
 * Get thread count from data
 * @param {Object} data - Job data object
 * @returns {number} - Thread count (minimum 1)
 */
function getThreads(data) {
  return Math.max(1, getIntParam(data, [
    'numberOfThreads',
    'threads'
  ], DEFAULTS.THREADS));
}

/**
 * Check if GPU acceleration is enabled
 * Checks gpuAcceleration/GpuAcceleration toggle, then useGPU/gpuToUse device IDs
 * @param {Object} data - Job data object
 * @returns {boolean}
 */
function isGpuEnabled(data) {
  // First check explicit GPU acceleration toggle (primary method)
  const gpuAccel = getParam(data, ['gpuAcceleration', 'GpuAcceleration'], null);
  if (gpuAccel !== null) {
    if (typeof gpuAccel === 'boolean') return gpuAccel;
    if (typeof gpuAccel === 'string') {
      return gpuAccel.toLowerCase() === 'yes' || gpuAccel.toLowerCase() === 'true';
    }
  }

  // Check if gpuToUse contains a valid GPU ID (number or comma-separated list)
  const useGpu = getParam(data, ['gpuToUse', 'useGPU'], null);
  if (useGpu !== null && useGpu !== '' && useGpu !== 'No') {
    if (/^[\d,]+$/.test(String(useGpu))) {
      return true;
    }
    if (String(useGpu).toLowerCase() === 'yes') {
      return true;
    }
  }

  return false;
}

/**
 * Get GPU IDs string from data
 * @param {Object} data - Job data object
 * @returns {string} - GPU IDs (default '0')
 */
function getGpuIds(data) {
  let gpuIds = getParam(data, [
    'gpuToUse',
    'useGPU',
    'gpu'
  ], '0');

  // Handle 'Yes'/'No' values from frontend
  if (gpuIds === 'Yes' || gpuIds === 'No') {
    gpuIds = '0';
  }

  // Remove whitespace
  return String(gpuIds).replace(/\s/g, '');
}

/**
 * Get input star file path from data
 * @param {Object} data - Job data object
 * @returns {string|null}
 */
function getInputStarFile(data) {
  return getParam(data, [
    'inputStarFile'
  ], null);
}

/**
 * Get continue-from file path from data
 * @param {Object} data - Job data object
 * @returns {string|null}
 */
function getContinueFrom(data) {
  return getParam(data, [
    'continueFrom'
  ], null);
}

/**
 * Get mask diameter from data
 * @param {Object} data - Job data object
 * @param {number} defaultValue - Default diameter
 * @returns {number}
 */
function getMaskDiameter(data, defaultValue = 200) {
  return getIntParam(data, [
    'maskDiameter'
  ], defaultValue);
}

/**
 * Get number of classes from data
 * @param {Object} data - Job data object
 * @param {number} defaultValue - Default number
 * @returns {number}
 */
function getNumberOfClasses(data, defaultValue = 1) {
  return getIntParam(data, [
    'numberOfClasses'
  ], defaultValue);
}

/**
 * Get number of iterations from data
 * @param {Object} data - Job data object
 * @param {number} defaultValue - Default iterations
 * @returns {number}
 */
function getIterations(data, defaultValue = 25) {
  return getIntParam(data, [
    'numberOfIterations',
    'numberEMIterations'
  ], defaultValue);
}

/**
 * Get pooled particles count from data
 * @param {Object} data - Job data object
 * @param {number} defaultValue - Default pool size
 * @returns {number}
 */
function getPooledParticles(data, defaultValue = DEFAULTS.POOL_SIZE) {
  return Math.max(1, getIntParam(data, [
    'pooledParticles',
    'numberOfPooledParticle'
  ], defaultValue));
}

/**
 * Get pixel size (angstroms per pixel) from data
 * @param {Object} data - Job data object
 * @param {number} defaultValue - Default pixel size
 * @returns {number}
 */
function getAngpix(data, defaultValue = 1.0) {
  return getFloatParam(data, [
    'angpix',
    'calibratedPixelSize'
  ], defaultValue);
}

/**
 * Get reference file path from data
 * @param {Object} data - Job data object
 * @returns {string|null}
 */
function getReference(data) {
  return getParam(data, [
    'referenceMap'
  ], null);
}

/**
 * Get symmetry from data
 * @param {Object} data - Job data object
 * @param {string} defaultValue - Default symmetry
 * @returns {string}
 */
function getSymmetry(data, defaultValue = 'C1') {
  return getParam(data, [
    'symmetry',
    'Symmetry'
  ], defaultValue);
}

/**
 * Get scratch directory from data
 * @param {Object} data - Job data object
 * @returns {string|null}
 */
function getScratchDir(data) {
  return getParam(data, [
    'copyParticlesToScratch',
    'copyParticles',
    'copyParticle'
  ], null);
}

module.exports = {
  getParam,
  getIntParam,
  getFloatParam,
  getBoolParam,
  getMpiProcs,
  getThreads,
  isGpuEnabled,
  getGpuIds,
  getInputStarFile,
  getContinueFrom,
  getMaskDiameter,
  getNumberOfClasses,
  getIterations,
  getPooledParticles,
  getAngpix,
  getReference,
  getSymmetry,
  getScratchDir
};
