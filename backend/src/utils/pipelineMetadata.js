/**
 * Pipeline Metadata Helper
 *
 * Stores pipeline metadata when jobs complete.
 * Node.js equivalent of Python's common pipeline stats extraction
 *
 * PIXEL SIZE TRACKING:
 * pixel_size changes at specific pipeline stages:
 * 1. Import: Original pixel size from angpix parameter
 * 2. Motion Correction: pixel_size = original * binning_factor
 * 3. Extract: pixel_size = micrograph_pixel_size * (box_size / rescaled_size) if rescaling
 *
 * All other jobs inherit pixel_size from their upstream job.
 */

const fs = require('fs');
const path = require('path');
const logger = require('./logger');
const Job = require('../models/Job');
const Project = require('../models/Project');
const settings = require('../config/settings');
const { IMPORT_NODE_TYPES } = require('../config/constants');

/**
 * Calculate pixel_size by traversing the pipeline from Import to current job.
 * This is the AUTHORITATIVE way to get pixel_size - always calculates from scratch.
 *
 * @param {Object} job - The job document
 * @returns {Object} { original_pixel_size, current_pixel_size, transformations }
 */
async function calculatePixelSizeFromPipeline(job) {
  const result = {
    original_pixel_size: null,
    current_pixel_size: null,
    transformations: []
  };

  // Find the Import job to get original pixel size
  const importJob = await findImportJob(job);
  if (!importJob) {
    logger.warn(`[PixelSize] Could not find Import job for ${job.job_name}`);
    return result;
  }

  // Get original pixel size from Import
  const importParams = importJob.parameters || {};
  const angpix = parseFloat(importParams.angpix);
  if (!angpix || isNaN(angpix)) {
    logger.warn(`[PixelSize] No angpix in Import job for ${job.job_name}`);
    return result;
  }

  result.original_pixel_size = angpix;
  let currentPixelSize = angpix;

  // Now trace the path from Import to current job and apply transformations
  const jobPath = await getJobPath(importJob, job);

  for (const pathJob of jobPath) {
    const jobType = (pathJob.job_type || '').toLowerCase().replace(/[_\s-]/g, '');
    const params = pathJob.parameters || {};

    // Motion Correction: Apply binning
    if (['motioncorr', 'motion', 'motioncorrection'].includes(jobType)) {
      const binningFactor = parseInt(params.binningFactor) || parseInt(params.bin_factor) || 1;
      if (binningFactor > 1) {
        const oldPixelSize = currentPixelSize;
        currentPixelSize = currentPixelSize * binningFactor;
        result.transformations.push({
          job: pathJob.job_name,
          type: 'binning',
          factor: binningFactor,
          from: oldPixelSize,
          to: currentPixelSize
        });
        logger.debug(`[PixelSize] Motion ${pathJob.job_name}: ${oldPixelSize} * ${binningFactor} = ${currentPixelSize}`);
      }
    }

    // Particle Extraction: Apply rescaling
    if (['extract', 'particleextraction'].includes(jobType)) {
      const rescale = params.rescale === 'Yes' || params.rescale === true || params.doRescale === 'Yes';
      if (rescale) {
        const boxSize = parseInt(params.boxSize) || parseInt(params.extractSize) || parseInt(params.extract_size) || 0;
        const rescaledSize = parseInt(params.rescaledSize) || parseInt(params.rescale_size) || parseInt(params.rescaled_size) || 0;

        if (boxSize > 0 && rescaledSize > 0 && boxSize !== rescaledSize) {
          const oldPixelSize = currentPixelSize;
          currentPixelSize = currentPixelSize * (boxSize / rescaledSize);
          result.transformations.push({
            job: pathJob.job_name,
            type: 'rescale',
            boxSize,
            rescaledSize,
            from: oldPixelSize,
            to: currentPixelSize
          });
          logger.debug(`[PixelSize] Extract ${pathJob.job_name}: ${oldPixelSize} * (${boxSize}/${rescaledSize}) = ${currentPixelSize}`);
        }
      }
    }
  }

  result.current_pixel_size = currentPixelSize;
  return result;
}

/**
 * Get the path of jobs from startJob to endJob
 * @param {Object} startJob - Starting job (typically Import)
 * @param {Object} endJob - Ending job
 * @returns {Array} Array of jobs in order from start to end
 */
async function getJobPath(startJob, endJob) {
  // Build path by going backward from endJob to startJob
  const path = [];
  let current = endJob;
  const visited = new Set();

  while (current && current.id !== startJob.id) {
    if (visited.has(current.id)) break;
    visited.add(current.id);
    path.unshift(current);
    current = await findUpstreamJobDirect(current);
  }

  // Include startJob at the beginning
  if (current && current.id === startJob.id) {
    path.unshift(startJob);
  }

  return path;
}

/**
 * Safe pixel_size getter - tries multiple sources with fallbacks
 * @param {Object} job - The job document
 * @returns {number|null} The pixel size or null
 */
function getPixelSizeSafe(job) {
  if (!job) return null;

  // 1. Try pipeline_stats.pixel_size (authoritative)
  const stats = job.pipeline_stats || {};
  if (stats.pixel_size && !isNaN(stats.pixel_size)) {
    return stats.pixel_size;
  }

  // 2. Try legacy top-level pixel_size (backward compat for old data)
  if (job.pixel_size && !isNaN(job.pixel_size)) {
    return job.pixel_size;
  }

  // 3. Try parameters.angpix (for Import jobs)
  const params = job.parameters || {};
  if (params.angpix) {
    const angpix = parseFloat(params.angpix);
    if (!isNaN(angpix)) return angpix;
  }

  return null;
}

/**
 * Build a pipeline_stats update for Job.findOneAndUpdate.
 *
 * Uses $set with dot notation so ONLY the fields passed in `stats` are overwritten.
 * Fields not passed are preserved (e.g. submission-time fields like voltage, symmetry).
 *
 * @param {Object} stats - Partial stats object (only provided fields are updated)
 * @returns {Object} MongoDB $set update document
 */
function buildStatsUpdate(stats) {
  // Use dot-notation $set so only provided fields are overwritten.
  // Submission-time fields (voltage, symmetry, etc.) are preserved.
  const update = { 'updated_at': new Date() };

  const fields = {
    pixel_size: stats.pixel_size ?? null,
    micrograph_count: stats.micrograph_count ?? 0,
    particle_count: stats.particle_count ?? 0,
    box_size: stats.box_size ?? null,
    resolution: stats.resolution ?? null,
    bfactor: stats.bfactor ?? null,
    class_count: stats.class_count ?? 0,
    iteration_count: stats.iteration_count ?? 0,
    movie_count: stats.movie_count ?? 0,
    defocus_mean: stats.defocus_mean ?? null,
    astigmatism_mean: stats.astigmatism_mean ?? null,
    beam_tilt_x: stats.beam_tilt_x ?? null,
    beam_tilt_y: stats.beam_tilt_y ?? null,
    ctf_fitting: stats.ctf_fitting ?? null,
    beam_tilt_enabled: stats.beam_tilt_enabled ?? null,
    aniso_mag: stats.aniso_mag ?? null,
  };

  // Only set fields that were explicitly provided in stats
  for (const [key, value] of Object.entries(fields)) {
    if (key in stats) {
      update[`pipeline_stats.${key}`] = value;
    }
  }

  // Parameter-derived fields: only set if explicitly provided (don't overwrite submission-time values)
  const paramFields = ['total_iterations', 'voltage', 'cs', 'import_type', 'symmetry',
    'mask_diameter', 'bin_factor', 'pick_method', 'rescaled_size',
    // Import "other" node type fields
    'node_type', 'node_label', 'imported_file_name',
    'voxel_size', 'entry_count'];
  for (const key of paramFields) {
    if (key in stats) {
      update[`pipeline_stats.${key}`] = stats[key];
    }
  }

  return update;
}

/**
 * Parse a STAR file to count data rows in the movies/micrographs block (async)
 * @param {string} starPath - Path to the STAR file
 * @returns {Promise<number>} Count of data rows
 */
async function countStarFileEntries(starPath) {
  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');
    const lines = content.split('\n');

    let count = 0;
    let inMoviesBlock = false;
    let inDataSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track which data block we're in
      if (trimmed.startsWith('data_movies') || trimmed.startsWith('data_micrographs')) {
        inMoviesBlock = true;
        inDataSection = false;
        continue;
      }

      // Exit movies block if we hit another data_ block
      if (trimmed.startsWith('data_') && !trimmed.startsWith('data_movies') && !trimmed.startsWith('data_micrographs')) {
        inMoviesBlock = false;
        inDataSection = false;
        continue;
      }

      // Start of loop section
      if (inMoviesBlock && trimmed.startsWith('loop_')) {
        inDataSection = true;
        continue;
      }

      // Skip column headers
      if (inDataSection && trimmed.startsWith('_')) {
        continue;
      }

      // Count data rows (non-empty, not comments)
      if (inMoviesBlock && inDataSection && trimmed && !trimmed.startsWith('#')) {
        count++;
      }
    }

    return count;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count entries in ${starPath}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Count data rows in a STAR file, returning the largest data block count.
 * RELION STAR files often have multiple blocks (e.g. data_optics with 1-2 rows,
 * then data_ with the actual entries). This scans ALL blocks and returns the max.
 * @param {string} starPath - Path to the STAR file
 * @returns {Promise<number>} Count of data rows in the largest block
 */
async function countStarRowsGeneric(starPath) {
  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');
    const lines = content.split('\n');

    let maxCount = 0;
    let blockCount = 0;
    let inDataBlock = false;
    let inLoop = false;
    let pastHeaders = false;

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('data_')) {
        // Save previous block count before starting new block
        if (blockCount > maxCount) maxCount = blockCount;
        blockCount = 0;
        inDataBlock = true;
        inLoop = false;
        pastHeaders = false;
        continue;
      }

      if (inDataBlock && trimmed.startsWith('loop_')) {
        inLoop = true;
        pastHeaders = false;
        continue;
      }

      // Skip column headers (_rlnXxx)
      if (inLoop && !pastHeaders && trimmed.startsWith('_')) {
        continue;
      }

      // Count non-empty data rows
      if (inLoop && trimmed && !trimmed.startsWith('#')) {
        pastHeaders = true;
        blockCount++;
      }

      // Empty line after data rows ends the current block
      if (inLoop && pastHeaders && !trimmed) {
        inLoop = false;
        inDataBlock = false;
      }
    }

    // Check the last block
    if (blockCount > maxCount) maxCount = blockCount;

    return maxCount;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count rows in ${starPath}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Count total particles across per-micrograph coordinate STAR files.
 * RELION coords import stores a tiny suffix file at the top level, with actual
 * coordinate data in per-micrograph *_autopick.star / *_pick.star files in subdirectories.
 * @param {string} outputDir - Import job output directory
 * @param {string} mainFile - The main STAR filename to exclude
 * @returns {Promise<number>} Total particle count
 */
async function countCoordsParticles(outputDir, mainFile) {
  try {
    let totalCount = 0;
    const scanDir = async (dir) => {
      const entries = await fs.promises.readdir(dir, { withFileTypes: true });
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
          await scanDir(fullPath);
        } else if (entry.name.endsWith('.star') && entry.name !== mainFile) {
          const count = await countStarRowsGeneric(fullPath);
          if (count > 0) totalCount += count;
        }
      }
    };
    await scanDir(outputDir);
    if (totalCount > 0) {
      logger.info(`[PipelineMetadata] Counted ${totalCount} total particles across coordinate files in ${outputDir}`);
    }
    return totalCount;
  } catch (error) {
    logger.warn(`[PipelineMetadata] Failed to count coords particles in ${outputDir}: ${error.message}`);
    return 0;
  }
}

/**
 * Store pipeline metadata for Import job
 * @param {Object} job - The job document
 */
async function storeImportMetadata(job) {
  const params = job.parameters || {};
  const command = job.command || '';
  const outputDir = job.output_file_path;

  const nodeTypeInfo = IMPORT_NODE_TYPES;

  // --- Handle "other" node type imports (ref3d, mask, halfmap, refs2d, coords) ---
  // RELION uses different flags: --do_other (ref3d, mask, refs2d), --do_coordinates, --do_halfmaps
  const isOtherImport = command.includes('--do_other') || command.includes('--do_coordinates') || command.includes('--do_halfmaps');
  if (isOtherImport) {
    let nodeType = null;
    let nodeLabel = 'Unknown';
    let importedFile = null;

    // Detect node type from command flags
    if (command.includes('--do_coordinates')) {
      nodeType = 'coords';
      nodeLabel = nodeTypeInfo.coords.label;
      if (outputDir) {
        const outputFile = path.join(outputDir, nodeTypeInfo.coords.output_file);
        if (fs.existsSync(outputFile)) importedFile = outputFile;
      }
    } else if (command.includes('--do_halfmaps')) {
      nodeType = 'halfmap';
      nodeLabel = nodeTypeInfo.halfmap.label;
      if (outputDir) {
        const outputFile = path.join(outputDir, nodeTypeInfo.halfmap.output_file);
        if (fs.existsSync(outputFile)) importedFile = outputFile;
      }
    } else {
      // --do_other: parse --node_type flag
      const nodeTypeMatch = command.match(/--node_type\s+(\w+)/);
      if (nodeTypeMatch) {
        nodeType = nodeTypeMatch[1];
        if (nodeTypeInfo[nodeType] && outputDir) {
          nodeLabel = nodeTypeInfo[nodeType].label;
          const outputFile = path.join(outputDir, nodeTypeInfo[nodeType].output_file);
          if (fs.existsSync(outputFile)) importedFile = outputFile;
        } else if (nodeTypeInfo[nodeType]) {
          nodeLabel = nodeTypeInfo[nodeType].label;
        }
      }
    }

    // Search for expected output files if not found by command
    if (!importedFile && outputDir) {
      for (const [nt, info] of Object.entries(nodeTypeInfo)) {
        const potentialFile = path.join(outputDir, info.output_file);
        if (fs.existsSync(potentialFile)) {
          nodeType = nt;
          nodeLabel = info.label;
          importedFile = potentialFile;
          break;
        }
      }
    }

    // Final fallback: find ANY .mrc file
    if (!importedFile && outputDir && fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const fname of files) {
        if (fname.endsWith('.mrc')) {
          importedFile = path.join(outputDir, fname);
          if (!nodeType) { nodeType = 'ref3d'; nodeLabel = '3D Reference'; }
          break;
        }
      }
    }

    // Build stats for other node types
    const statsData = {
      import_type: nodeType || 'other',
      node_type: nodeType,
      node_label: nodeLabel
    };

    if (importedFile && fs.existsSync(importedFile)) {
      statsData.imported_file_name = path.basename(importedFile);

      // For MRC files, read volume dimensions and voxel size
      if (importedFile.endsWith('.mrc')) {
        try {
          const { getMrcInfo } = require('./mrcParser');
          const mrcInfo = getMrcInfo(importedFile);
          if (mrcInfo) {
            statsData.voxel_size = mrcInfo.pixelSize;
            statsData.pixel_size = mrcInfo.pixelSize;
          }
        } catch (e) {
          logger.warn(`[PipelineMetadata] Could not read MRC header for ${importedFile}: ${e.message}`);
        }
      }

      // For STAR files, count entries
      if (importedFile.endsWith('.star')) {
        let entryCount = await countStarRowsGeneric(importedFile);

        // For coords: the main file is tiny (just a suffix reference).
        // Actual particles are in per-micrograph STAR files in subdirectories.
        if (entryCount === 0 && nodeType === 'coords' && outputDir) {
          entryCount = await countCoordsParticles(outputDir, path.basename(importedFile));
        }

        if (entryCount > 0) {
          statsData.entry_count = entryCount;
        }
      }
    }

    const updateData = buildStatsUpdate(statsData);
    await Job.findOneAndUpdate({ id: job.id }, updateData);
    logger.info(`[PipelineMetadata] Import (other) ${job.job_name} | node: ${nodeType} | label: ${nodeLabel} | file: ${statsData.imported_file_name || 'none'}`);
    return;
  }

  // --- Handle movies/micrographs import ---
  let importType = null;

  // Method 1: Check command flags
  if (command.includes('--do_micrographs')) {
    importType = 'micrographs';
  } else if (command.includes('--do_movies')) {
    importType = 'movies';
  }

  // Method 2: Check parameters
  if (!importType) {
    if (params.rawMicrographs === 'Yes' || params.rawMicrographs === true) {
      importType = 'micrographs';
    } else if (params.rawMovies === 'Yes' || params.rawMovies === true) {
      importType = 'movies';
    }
  }

  // Method 3: Check multiframemovies
  if (!importType) {
    if (params.multiframemovies === 'No' || params.multiframemovies === false) {
      importType = 'micrographs';
    } else if (params.multiframemovies === 'Yes' || params.multiframemovies === true) {
      importType = 'movies';
    }
  }

  // Pixel size from angpix parameter
  const originalPixelSize = params.angpix ? parseFloat(params.angpix) : null;

  // Count total files from STAR file
  let fileCount = 0;
  if (outputDir) {
    for (const starName of ['micrographs.star', 'movies.star']) {
      const starPath = path.join(outputDir, starName);
      if (fs.existsSync(starPath)) {
        // Verify/correct import_type based on actual output file
        const actualType = starName.includes('micrographs') ? 'micrographs' : 'movies';
        if (importType !== actualType) {
          logger.info(`[PipelineMetadata] Correcting import_type from '${importType}' to '${actualType}'`);
          importType = actualType;
        }

        const count = await countStarFileEntries(starPath);
        if (count > 0) {
          fileCount = count;
          logger.info(`[PipelineMetadata] Import job ${job.job_name}: counted ${count} entries from ${starName}`);
        }
        break;
      }
    }
  }

  // Store count in both micrograph_count (for downstream inheritance) and movie_count when applicable
  const statsData = {
    pixel_size: originalPixelSize,
    micrograph_count: fileCount,
    import_type: importType
  };
  if (importType === 'movies') {
    statsData.movie_count = fileCount;
  }

  const updateData = buildStatsUpdate(statsData);
  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Import ${job.job_name} | pixels: ${originalPixelSize}Å | count: ${fileCount} | type: ${importType}`);
}

/**
 * Store pipeline metadata for Motion Correction job
 * @param {Object} job - The job document
 */
async function storeMotionMetadata(job) {
  const params = job.parameters || {};

  // Get original pixel size from Import job
  let originalPixelSize = null;
  const importJob = await findImportJob(job);
  if (importJob) {
    const importParams = importJob.parameters || {};
    if (importParams.angpix) {
      originalPixelSize = parseFloat(importParams.angpix);
    }
  }

  // Count micrographs from own output corrected_micrographs.star
  let micrographCount = 0;
  const outputDir = job.output_file_path;
  if (outputDir) {
    const starPath = path.join(outputDir, 'corrected_micrographs.star');
    if (fs.existsSync(starPath)) {
      const count = await countStarFileEntries(starPath);
      if (count > 0) micrographCount = count;
    }
  }

  // Calculate effective pixel size with binning
  const binningFactor = parseInt(params.binningFactor) ||
                        parseInt(params.bin_factor) ||
                        parseInt(params.binFactor) || 1;

  let pixelSize = null;
  if (originalPixelSize) {
    pixelSize = originalPixelSize * binningFactor;
    if (binningFactor > 1) {
      logger.info(`[PixelSize] Motion ${job.job_name}: ${originalPixelSize} × ${binningFactor} = ${pixelSize} Å`);
    }
  }

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    bin_factor: binningFactor
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Motion ${job.job_name} | pixels: ${pixelSize}Å | micrographs: ${micrographCount} | binning: ${binningFactor}`);
}

/**
 * Store pipeline metadata for CTF Estimation job
 * @param {Object} job - The job document
 */
async function storeCTFMetadata(job) {
  // Get pixel size from upstream Motion job
  let pixelSize = null;
  const motionJob = await findUpstreamJob(job, ['MotionCorr', 'Motion']);
  if (motionJob) {
    pixelSize = getPixelSizeSafe(motionJob);
  }

  // Count micrographs from CTF star file
  let micrographCount = 0;
  const outputDir = job.output_file_path;
  if (outputDir) {
    const starPath = path.join(outputDir, 'micrographs_ctf.star');
    if (fs.existsSync(starPath)) {
      const count = await countStarFileEntries(starPath);
      if (count > 0) micrographCount = count;
    }
  }

  const updateData = buildStatsUpdate(
    { pixel_size: pixelSize, micrograph_count: micrographCount }
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] CTF ${job.job_name} | pixels: ${pixelSize}Å | micrographs: ${micrographCount}`);
}

/**
 * Find the Import job in the pipeline for a given job
 * @param {Object} job - The job document
 * @returns {Object|null} Import job or null
 */
async function findImportJob(job) {
  const visited = new Set();
  let current = job;

  while (current) {
    const jobId = current.id;
    if (visited.has(jobId)) break;
    visited.add(jobId);

    const jobType = (current.job_type || '').toLowerCase();
    if (jobType === 'import') {
      return current;
    }

    // Try to find upstream job
    current = await findUpstreamJobDirect(current);
  }

  return null;
}

/**
 * Find upstream job by parsing input parameters
 * @param {Object} job - The job document
 * @returns {Object|null} Upstream job or null
 */
async function findUpstreamJobDirect(job) {
  const params = job.parameters || {};
  const projectId = job.project_id;

  if (!projectId) return null;

  // Check input_job_ids first
  if (job.input_job_ids && job.input_job_ids.length > 0) {
    const upstream = await Job.findOne({ id: job.input_job_ids[0] }).lean();
    if (upstream) return upstream;
  }

  // Parse input paths to find job name
  const inputFields = [
    'inputStarFile', 'inputMicrographs', 'micrographStarFile',
    'inputCoordinates', 'inputParticles', 'input_files',
    'particlesStarFile', 'input_star_file', 'inputMovies'
  ];

  for (const field of inputFields) {
    const inputPath = params[field];
    if (!inputPath || typeof inputPath !== 'string') continue;

    // Extract job name from path like "Import/Job002/movies.star"
    const match = inputPath.match(/(Job\d+)/i);
    if (match) {
      const jobName = match[1];
      const upstream = await Job.findOne({
        project_id: projectId,
        job_name: jobName
      }).lean();
      if (upstream) return upstream;
    }
  }

  return null;
}

/**
 * Find upstream job of specific types
 * @param {Object} job - The job document
 * @param {Array} targetTypes - Job types to look for
 * @returns {Object|null} Upstream job or null
 */
async function findUpstreamJob(job, targetTypes) {
  const visited = new Set();
  let current = await findUpstreamJobDirect(job);

  while (current) {
    const jobId = current.id;
    if (visited.has(jobId)) break;
    visited.add(jobId);

    const jobType = (current.job_type || '').replace(/[_\s-]/g, '').toLowerCase();
    const normalizedTargets = targetTypes.map(t => t.replace(/[_\s-]/g, '').toLowerCase());

    if (normalizedTargets.includes(jobType)) {
      return current;
    }

    current = await findUpstreamJobDirect(current);
  }

  return null;
}

/**
 * Store pipeline metadata for AutoPick job
 * @param {Object} job - The job document
 */
async function storeAutoPickMetadata(job) {
  const params = job.parameters || {};

  // Get pixel size from upstream CTF job
  let pixelSize = null;
  const ctfJob = await findUpstreamJob(job, ['CtfFind', 'CTF', 'CtfEstimation']);
  if (ctfJob) {
    pixelSize = getPixelSizeSafe(ctfJob);
  }

  // Count micrographs and particles from autopick.star + coordinate files
  let micrographCount = 0;
  let particleCount = 0;
  const outputDir = job.output_file_path;

  if (outputDir) {
    const starPath = path.join(outputDir, 'autopick.star');
    try {
      const content = await fs.promises.readFile(starPath, 'utf-8');
      const lines = content.split('\n');
      let inDataSection = false;
      let columnNames = [];
      let coordColIdx = -1;
      const coordFiles = [];

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('loop_')) { inDataSection = true; columnNames = []; continue; }
        if (inDataSection && trimmed.startsWith('_')) {
          const colName = trimmed.split(/\s+/)[0].replace(/^_/, '');
          columnNames.push(colName);
          if (colName === 'rlnMicrographCoordinates') coordColIdx = columnNames.length - 1;
          continue;
        }
        if (inDataSection && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('data_')) {
          micrographCount++;
          if (coordColIdx >= 0) {
            const fields = trimmed.split(/\s+/);
            if (fields[coordColIdx]) coordFiles.push(fields[coordColIdx]);
          }
        }
      }

      // Count particles from each coordinate file
      const projectRoot = path.dirname(path.dirname(outputDir));
      for (const coordFile of coordFiles) {
        const fullPath = path.join(projectRoot, coordFile);
        try {
          const coordContent = await fs.promises.readFile(fullPath, 'utf-8');
          const coordLines = coordContent.split('\n');
          let inCoordData = false;

          for (const cl of coordLines) {
            const ct = cl.trim();
            if (ct.startsWith('loop_')) { inCoordData = true; continue; }
            if (inCoordData && ct.startsWith('_')) continue;
            if (inCoordData && ct && !ct.startsWith('#') && !ct.startsWith('data_')) {
              particleCount++;
            }
          }
        } catch (e) {
          // Coordinate file missing or unreadable — skip
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`[PipelineMetadata] Failed to read autopick.star for ${job.job_name}: ${error.message}`);
      }
    }
  }

  // Determine picking method
  const pickMethod = params.useTopaz === 'Yes' ? 'Topaz'
    : params.templateMatching === 'Yes' ? 'Template' : 'LoG';

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    pick_method: pickMethod
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] AutoPick ${job.job_name} | pixels: ${pixelSize}Å | micrographs: ${micrographCount} | particles: ${particleCount} | method: ${pickMethod}`);
}

/**
 * Count particles in a particles.star file (async to avoid blocking event loop)
 * At 10K+ micrographs, particles.star can be 50-200MB — sync read freezes for 2-6 seconds.
 * @param {string} starPath - Path to the STAR file
 * @returns {Promise<number>} Particle count
 */
async function countParticlesInStar(starPath) {
  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');
    const lines = content.split('\n');

    let count = 0;
    let inParticlesBlock = false;
    let inDataSection = false;

    for (const line of lines) {
      const trimmed = line.trim();

      // Track which data block we're in
      if (trimmed.startsWith('data_particles')) {
        inParticlesBlock = true;
        inDataSection = false;
        continue;
      }

      // Exit particles block if we hit another data_ block
      if (trimmed.startsWith('data_') && !trimmed.startsWith('data_particles')) {
        inParticlesBlock = false;
        inDataSection = false;
        continue;
      }

      // Start of loop section
      if (inParticlesBlock && trimmed.startsWith('loop_')) {
        inDataSection = true;
        continue;
      }

      // Skip column headers
      if (inDataSection && trimmed.startsWith('_')) {
        continue;
      }

      // Count data rows (non-empty, not comments)
      if (inParticlesBlock && inDataSection && trimmed && !trimmed.startsWith('#')) {
        count++;
      }
    }

    return count;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count particles in ${starPath}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Count unique micrographs in a STAR file by parsing _rlnMicrographName column
 * @param {string} starPath - Path to the STAR file
 * @returns {Promise<number>} Unique micrograph count
 */
async function countMicrographsInStar(starPath) {
  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');
    const lines = content.split('\n');

    let inParticlesBlock = false;
    let inDataSection = false;
    let micColumnIndex = -1;
    let columnCounter = 0;
    const micrographs = new Set();

    for (const line of lines) {
      const trimmed = line.trim();

      if (trimmed.startsWith('data_particles')) {
        inParticlesBlock = true;
        inDataSection = false;
        columnCounter = 0;
        micColumnIndex = -1;
        continue;
      }

      if (trimmed.startsWith('data_') && !trimmed.startsWith('data_particles')) {
        inParticlesBlock = false;
        inDataSection = false;
        continue;
      }

      if (inParticlesBlock && trimmed.startsWith('loop_')) {
        inDataSection = true;
        continue;
      }

      // Track column headers to find _rlnMicrographName index
      if (inDataSection && trimmed.startsWith('_')) {
        if (trimmed.startsWith('_rlnMicrographName')) {
          micColumnIndex = columnCounter;
        }
        columnCounter++;
        continue;
      }

      // Parse data rows
      if (inParticlesBlock && inDataSection && trimmed && !trimmed.startsWith('#') && micColumnIndex >= 0) {
        const fields = trimmed.split(/\s+/);
        if (fields.length > micColumnIndex) {
          micrographs.add(fields[micColumnIndex]);
        }
      }
    }

    return micrographs.size;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count micrographs in ${starPath}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Extract resolution from a postprocess.star or model.star file
 * @param {string} starPath - Path to the STAR file
 * @returns {number|null} Resolution in Angstroms
 */
async function extractResolutionFromStar(starPath) {
  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');

    // Look for _rlnFinalResolution in postprocess.star
    const finalResMatch = content.match(/_rlnFinalResolution\s+([\d.]+)/);
    if (finalResMatch) {
      return parseFloat(finalResMatch[1]);
    }

    // Look for _rlnCurrentResolution in model.star (for refinement)
    const currentResMatch = content.match(/_rlnCurrentResolution\s+([\d.]+)/);
    if (currentResMatch) {
      return parseFloat(currentResMatch[1]);
    }

    // Look for _rlnGoldStandardFsc0143 resolution
    const fscMatch = content.match(/_rlnGoldStandardFsc0143\s+([\d.]+)/);
    if (fscMatch) {
      return parseFloat(fscMatch[1]);
    }

    return null;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to extract resolution from ${starPath}: ${error.message}`);
    }
    return null;
  }
}

/**
 * Count iteration files in a job output directory
 * @param {string} outputDir - Job output directory
 * @returns {Promise<number>} Highest iteration number found
 */
async function countIterations(outputDir) {
  try {
    const files = await fs.promises.readdir(outputDir);
    let maxIteration = 0;

    for (const file of files) {
      // Match patterns like run_it025_model.star or run_it015_class001.mrc
      const match = file.match(/run_it(\d+)/i);
      if (match) {
        const iter = parseInt(match[1], 10);
        if (iter > maxIteration) {
          maxIteration = iter;
        }
      }
    }

    return maxIteration;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count iterations in ${outputDir}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Count class files (MRC volumes) in a job output directory
 * @param {string} outputDir - Job output directory
 * @returns {number} Number of classes
 */
async function countClassFiles(outputDir) {
  try {
    const files = await fs.promises.readdir(outputDir);

    // For 2D: count from run_it*_classes.mrcs (single file with stacked classes)
    // For 3D: count run_it*_class*.mrc files

    // First check for 3D class volumes (run_it025_class001.mrc, etc.)
    const classVolumes = files.filter(f => f.match(/run_it\d+_class\d+\.mrc$/i));
    if (classVolumes.length > 0) {
      // Get the highest iteration and count classes at that iteration
      let maxIter = 0;
      for (const f of classVolumes) {
        const match = f.match(/run_it(\d+)_class/i);
        if (match) {
          const iter = parseInt(match[1], 10);
          if (iter > maxIter) maxIter = iter;
        }
      }
      // Count classes at max iteration
      const classesAtMaxIter = classVolumes.filter(f =>
        f.match(new RegExp(`run_it${String(maxIter).padStart(3, '0')}_class\\d+\\.mrc$`, 'i'))
      );
      return classesAtMaxIter.length;
    }

    // For 2D, we'd need to read the MRCS stack header - approximate from parameters
    return 0;
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to count classes in ${outputDir}: ${error.message}`);
    }
    return 0;
  }
}

/**
 * Store pipeline metadata for Extract (particle extraction) job
 *
 * IMPORTANT: Pixel size can CHANGE here if rescaling is enabled!
 * New pixel_size = micrograph_pixel_size × (box_size / rescaled_size)
 *
 * @param {Object} job - The job document
 */
async function storeExtractMetadata(job) {
  const params = job.parameters || {};

  // Get pixel size from upstream AutoPick job (inherits micrograph pixel size from CTF/Motion)
  let upstreamJob = await findUpstreamJob(job, ['AutoPick']);
  if (!upstreamJob) upstreamJob = await findUpstreamJob(job, ['CtfFind', 'CTF', 'CtfEstimation']);
  if (!upstreamJob) upstreamJob = await findUpstreamJob(job, ['MotionCorr', 'Motion']);

  // Micrograph pixel size (before extraction/rescaling)
  let micrographPixelSize = upstreamJob ? getPixelSizeSafe(upstreamJob) : null;

  // Box size and rescaling from job parameters
  const boxSize = parseInt(params.particleBoxSize) || parseInt(params.boxSize) || 0;
  const rescale = params.rescaleParticles === 'Yes';
  const rescaledSize = parseInt(params.rescaledSize) || 0;

  // Effective pixel size: if rescale, multiply by (boxSize / rescaledSize)
  let pixelSize = micrographPixelSize;
  if (rescale && micrographPixelSize && boxSize > 0 && rescaledSize > 0 && boxSize !== rescaledSize) {
    pixelSize = micrographPixelSize * (boxSize / rescaledSize);
    logger.info(`[PixelSize] Extract ${job.job_name}: ${micrographPixelSize.toFixed(3)} × (${boxSize}/${rescaledSize}) = ${pixelSize.toFixed(3)} Å`);
  }

  // Effective box size: rescaled if rescaling, otherwise original
  const effectiveBoxSize = (rescale && rescaledSize > 0) ? rescaledSize : boxSize;

  // Count particles from particles.star file
  let particleCount = 0;
  const outputDir = job.output_file_path;
  if (outputDir) {
    const starPath = path.join(outputDir, 'particles.star');
    if (fs.existsSync(starPath)) {
      const count = await countParticlesInStar(starPath);
      if (count > 0) particleCount = count;
    }
  }

  // Count unique micrographs from own particles.star output
  let micrographCount = 0;
  if (outputDir) {
    const micStarPath = path.join(outputDir, 'particles.star');
    if (fs.existsSync(micStarPath)) {
      micrographCount = await countMicrographsInStar(micStarPath);
    }
  }

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    box_size: effectiveBoxSize || null,
    rescaled_size: (rescale && rescaledSize > 0) ? rescaledSize : null
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Extract ${job.job_name} | pixels: ${micrographPixelSize}→${pixelSize}Å | box: ${boxSize}→${effectiveBoxSize} | particles: ${particleCount} | micrographs: ${micrographCount}`);
}

/**
 * Store pipeline metadata for Bayesian Polishing job
 * Counts actual output particles from shiny.star
 *
 * @param {Object} job - The job document
 */
async function storePolishMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Count actual output particles and micrographs from shiny.star
  let particleCount = 0;
  let micrographCount = 0;
  if (outputDir) {
    const starPath = path.join(outputDir, 'shiny.star');
    if (fs.existsSync(starPath)) {
      particleCount = await countParticlesInStar(starPath);
      micrographCount = await countMicrographsInStar(starPath);
    }
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize
    }
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Polish ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | particles: ${particleCount} | mics: ${micrographCount}`);
}

/**
 * Store pipeline metadata for CTF Refinement job
 * Counts output particles and extracts defocus/astigmatism/beam tilt stats
 * from particles_ctf_refine.star
 *
 * @param {Object} job - The job document
 */
async function storeCtfRefineMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Parse output star file for particle count, defocus stats, and beam tilt
  let particleCount = 0;
  let micrographCount = 0;
  let defocusMean = null;
  let astigmatismMean = null;
  let beamTiltX = null;
  let beamTiltY = null;

  if (outputDir) {
    const starPath = path.join(outputDir, 'particles_ctf_refine.star');
    if (fs.existsSync(starPath)) {
      const stats = await parseCtfRefineStats(starPath);
      particleCount = stats.particleCount;
      defocusMean = stats.defocusMean;
      astigmatismMean = stats.astigmatismMean;
      beamTiltX = stats.beamTiltX;
      beamTiltY = stats.beamTiltY;
      micrographCount = await countMicrographsInStar(starPath);
    }
  }

  // Extract refinement mode flags from job parameters
  const params = job.parameters || {};
  const ctfFitting = params.ctfParameter === 'Yes' || params.doDefocusRefine === 'Yes';
  const beamTiltEnabled = params.estimateBeamtilt === 'Yes' || params.doBeamTilt === 'Yes';
  const anisoMag = params.estimateMagnification === 'Yes' || params.doAnisoMag === 'Yes';

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    box_size: boxSize,
    defocus_mean: defocusMean,
    astigmatism_mean: astigmatismMean,
    beam_tilt_x: beamTiltX,
    beam_tilt_y: beamTiltY,
    ctf_fitting: ctfFitting,
    beam_tilt_enabled: beamTiltEnabled,
    aniso_mag: anisoMag
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] CtfRefine ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | particles: ${particleCount} | mics: ${micrographCount} | defocus: ${defocusMean?.toFixed(0)}Å | astig: ${astigmatismMean?.toFixed(0)}Å | tiltX: ${beamTiltX} | tiltY: ${beamTiltY}`);
}

/**
 * Parse CTF Refine output star file for defocus/astigmatism/beam tilt stats.
 * Lightweight line-by-line parser — does NOT load full rows into memory.
 *
 * @param {string} starPath - Path to particles_ctf_refine.star
 * @returns {Promise<Object>} { particleCount, defocusMean, astigmatismMean, beamTiltX, beamTiltY }
 */
async function parseCtfRefineStats(starPath) {
  const result = {
    particleCount: 0,
    defocusMean: null,
    astigmatismMean: null,
    beamTiltX: null,
    beamTiltY: null
  };

  try {
    const content = await fs.promises.readFile(starPath, 'utf-8');
    const lines = content.split('\n');

    // --- Pass 1: Extract beam tilt from data_optics block ---
    let inOpticsBlock = false;
    let inOpticsData = false;
    let opticsColumns = [];
    let tiltXIdx = -1;
    let tiltYIdx = -1;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'data_optics') { inOpticsBlock = true; inOpticsData = false; opticsColumns = []; continue; }
      if (trimmed.startsWith('data_') && trimmed !== 'data_optics') {
        if (inOpticsBlock) break; // Done with optics
        continue;
      }
      if (inOpticsBlock && trimmed.startsWith('loop_')) { inOpticsData = true; continue; }
      if (inOpticsBlock && inOpticsData && trimmed.startsWith('_')) {
        opticsColumns.push(trimmed.split(/\s+/)[0]);
        continue;
      }
      if (inOpticsBlock && inOpticsData && trimmed && !trimmed.startsWith('#')) {
        // First data row of optics
        const vals = trimmed.split(/\s+/);
        tiltXIdx = opticsColumns.indexOf('_rlnBeamTiltX');
        tiltYIdx = opticsColumns.indexOf('_rlnBeamTiltY');
        if (tiltXIdx >= 0 && tiltXIdx < vals.length) result.beamTiltX = parseFloat(vals[tiltXIdx]) || null;
        if (tiltYIdx >= 0 && tiltYIdx < vals.length) result.beamTiltY = parseFloat(vals[tiltYIdx]) || null;
        break; // Only need first optics row
      }
    }

    // --- Pass 2: Extract defocus stats from data_particles block ---
    let inParticlesBlock = false;
    let inParticlesData = false;
    let particleColumns = [];
    let defUIdx = -1;
    let defVIdx = -1;

    let defocusSum = 0;
    let astigSum = 0;
    let count = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed === 'data_particles') { inParticlesBlock = true; inParticlesData = false; particleColumns = []; continue; }
      if (inParticlesBlock && trimmed.startsWith('data_') && trimmed !== 'data_particles') { break; }
      if (inParticlesBlock && trimmed.startsWith('loop_')) { inParticlesData = true; continue; }
      if (inParticlesBlock && inParticlesData && trimmed.startsWith('_')) {
        particleColumns.push(trimmed.split(/\s+/)[0]);
        continue;
      }
      if (inParticlesBlock && inParticlesData && trimmed && !trimmed.startsWith('#')) {
        count++;
        // Only resolve column indices once
        if (defUIdx < 0) {
          defUIdx = particleColumns.indexOf('_rlnDefocusU');
          defVIdx = particleColumns.indexOf('_rlnDefocusV');
        }
        if (defUIdx >= 0 && defVIdx >= 0) {
          const vals = trimmed.split(/\s+/);
          const defU = parseFloat(vals[defUIdx]) || 0;
          const defV = parseFloat(vals[defVIdx]) || 0;
          defocusSum += (defU + defV) / 2;
          astigSum += Math.abs(defU - defV);
        }
      }
    }

    result.particleCount = count;
    if (count > 0 && defUIdx >= 0) {
      result.defocusMean = defocusSum / count;
      result.astigmatismMean = astigSum / count;
    }
  } catch (error) {
    if (error.code !== 'ENOENT') {
      logger.warn(`[PipelineMetadata] Failed to parse CTF refine stats from ${starPath}: ${error.message}`);
    }
  }

  return result;
}

/**
 * Store pipeline metadata for Particle Subtraction job
 * Counts actual output particles from particles_subtracted.star
 *
 * @param {Object} job - The job document
 */
async function storeSubtractMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Check for re-boxing: new box size changes particle pixel size
  const params = job.parameters || {};
  const newBoxSize = parseInt(params.newBoxSize) || 0;
  if (newBoxSize > 0) {
    boxSize = newBoxSize;
  }

  // Count actual output particles and micrographs from particles_subtracted.star
  let particleCount = 0;
  let micrographCount = 0;
  if (outputDir) {
    const starPath = path.join(outputDir, 'particles_subtracted.star');
    if (fs.existsSync(starPath)) {
      particleCount = await countParticlesInStar(starPath);
      if (particleCount > 0) {
        micrographCount = await countMicrographsInStar(starPath);
      }
    }
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize
    },
    {}
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Subtract ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | particles: ${particleCount}`);
}

/**
 * Store pipeline metadata for Join Star Files job
 * Counts actual output particles/micrographs from join_*.star files
 *
 * @param {Object} job - The job document
 */
async function storeJoinStarMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit pixel_size and box_size from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = upstreamJob.pipeline_stats?.box_size ?? upstreamJob.box_size ?? null;
  }

  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Count actual output from join_*.star files
  let particleCount = 0;
  let micrographCount = 0;
  let movieCount = 0;
  if (outputDir) {
    const particlesPath = path.join(outputDir, 'join_particles.star');
    if (fs.existsSync(particlesPath)) {
      particleCount = await countParticlesInStar(particlesPath);
    }
    const micrographsPath = path.join(outputDir, 'join_micrographs.star');
    if (fs.existsSync(micrographsPath)) {
      micrographCount = await countStarFileEntries(micrographsPath);
    }
    const moviesPath = path.join(outputDir, 'join_movies.star');
    if (fs.existsSync(moviesPath)) {
      movieCount = await countStarFileEntries(moviesPath);
    }
  }

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    movie_count: movieCount,
    box_size: boxSize
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] JoinStar ${job.job_name} | pixels: ${pixelSize}Å | particles: ${particleCount} | mics: ${micrographCount} | movies: ${movieCount}`);
}

/**
 * Store pipeline metadata for Local Resolution job
 * Parses run.out for mean resolution stats and stores in pipeline_stats.resolution
 *
 * @param {Object} job - The job document
 */
async function storeLocalResMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? null;
  }

  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Parse mean resolution from run.out
  let resolution = null;
  if (outputDir) {
    const runOutPath = path.join(outputDir, 'run.out');
    if (fs.existsSync(runOutPath)) {
      try {
        const runOut = fs.readFileSync(runOutPath, 'utf-8');
        const meanMatch = runOut.match(/Mean:\s+([\d.]+)/);
        if (meanMatch) {
          resolution = parseFloat(meanMatch[1]);
        }
      } catch (err) {
        logger.debug(`[PipelineMetadata] Could not parse LocalRes run.out: ${err.message}`);
      }
    }
  }

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    box_size: boxSize,
    resolution: resolution
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] LocalRes ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | resolution: ${resolution}Å`);
}

/**
 * Resolve a job's output_file_path to an absolute directory path.
 * If the path is already absolute, returns it directly.
 * If relative, resolves via project directory (ROOT_PATH + folder_name).
 *
 * @param {Object} job - The job document (needs project_id and output_file_path)
 * @returns {Promise<string|null>} Absolute output directory path, or null
 */
async function resolveOutputDir(job) {
  const outputDir = job.output_file_path;
  if (!outputDir) return null;
  if (path.isAbsolute(outputDir)) return outputDir;
  if (!job.project_id) return null;
  try {
    const project = await Project.findOne({ id: job.project_id });
    if (!project) return null;
    return path.join(settings.ROOT_PATH, project.folder_name || project.project_name, outputDir);
  } catch (err) {
    logger.warn(`[PipelineMetadata] Could not resolve project path for ${job.job_name}: ${err.message}`);
    return null;
  }
}

/**
 * Find the latest iteration *_data.star file in a directory.
 * Matches patterns: run_it{NNN}_data.star or _it{NNN}_data.star
 * Returns the file with the highest iteration number.
 *
 * @param {string} absDir - Absolute directory path
 * @returns {string|null} Absolute path to the latest data.star file, or null
 */
function findLatestDataStar(absDir) {
  if (!absDir || !fs.existsSync(absDir)) return null;
  try {
    const files = fs.readdirSync(absDir);
    const dataStarPattern = /_it(\d+)_data\.star$/;
    let maxIter = -1;
    let bestFile = null;

    for (const file of files) {
      const match = file.match(dataStarPattern);
      if (match) {
        const iter = parseInt(match[1], 10);
        if (iter > maxIter) {
          maxIter = iter;
          bestFile = file;
        }
      }
    }

    // Also check for run_data.star or _data.star (AutoRefine final output)
    if (!bestFile) {
      if (files.includes('run_data.star')) {
        bestFile = 'run_data.star';
      } else {
        const dataStarFinal = files.find(f => f.endsWith('_data.star') && !dataStarPattern.test(f));
        if (dataStarFinal) bestFile = dataStarFinal;
      }
    }

    return bestFile ? path.join(absDir, bestFile) : null;
  } catch (err) {
    logger.warn(`[PipelineMetadata] Could not scan directory ${absDir}: ${err.message}`);
    return null;
  }
}

/**
 * Store generic pipeline metadata by inheriting from upstream job
 * Used for job types that don't produce new counts but should inherit existing ones
 *
 * For jobs AFTER Extract: pixel_size comes from Extract (particle pixel size)
 * For jobs BEFORE Extract: pixel_size comes from Motion (micrograph pixel size)
 *
 * @param {Object} job - The job document
 */
async function storeGenericMetadata(job) {
  const upstreamJob = await findUpstreamJobDirect(job);

  let pixelSize = null;
  let micrographCount = 0;
  let particleCount = 0;
  let boxSize = null;
  let resolution = null;
  let classCount = 0;
  let iterationCount = 0;

  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
    resolution = us.resolution ?? upstreamJob.resolution ?? null;
    classCount = us.class_count ?? upstreamJob.class_count ?? 0;
    iterationCount = us.iteration_count ?? upstreamJob.iteration_count ?? 0;
  }

  // If no upstream pixel_size, calculate from the pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) {
      pixelSize = pixelCalc.current_pixel_size;
    }
  }

  // Count particles and micrographs from output star file
  const absOutputDir = await resolveOutputDir(job);
  if (absOutputDir) {
    const starPath = path.join(absOutputDir, 'particles.star');
    if (fs.existsSync(starPath)) {
      const count = await countParticlesInStar(starPath);
      if (count > 0) particleCount = count;
      const micCount = await countMicrographsInStar(starPath);
      if (micCount > 0) micrographCount = micCount;
    } else if (job.output_files?.length > 0) {
      // Fallback: use entryCount from output_files (set by builders like ManualSelect)
      const particleFile = job.output_files.find(f => f.fileName === 'particles.star' || f.role === 'particlesStar');
      if (particleFile?.entryCount > 0) particleCount = particleFile.entryCount;
    }
  }

  // ManualSelect-specific: class_count = selected classes, iteration_count = total classes from upstream
  const params = job.parameters || {};
  if (params.selected_classes || params.num_classes_selected) {
    // iteration_count = total classes from upstream (inherited as classCount above)
    iterationCount = classCount;
    // class_count = number of selected classes
    classCount = parseInt(params.num_classes_selected) || (Array.isArray(params.selected_classes) ? params.selected_classes.length : 0);
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize,
      resolution,
      class_count: classCount,
      iteration_count: iterationCount
    }
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Generic ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | mics: ${micrographCount} | parts: ${particleCount} | classes: ${classCount}/${iterationCount}`);
}

/**
 * Store pipeline metadata for 2D/3D Classification jobs
 * Extracts: class_count, iteration_count, particle_count, pixel_size
 *
 * @param {Object} job - The job document
 */
async function storeClassificationMetadata(job) {
  const params = job.parameters || {};
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;
  let particleCount = 0;
  let micrographCount = 0;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  // If no upstream pixel_size, calculate from pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Get class count from parameters or count output files
  let classCount = parseInt(params.numberOfClasses) || parseInt(params.numClasses) ||
                   parseInt(params.nr_classes) || parseInt(params.K) || 0;
  if (classCount === 0 && outputDir) {
    classCount = await countClassFiles(outputDir);
  }

  // Get iteration count from user-submitted parameters (EM or VDAM)
  let iterationCount = 0;
  if (params.useVDAM === 'Yes') {
    iterationCount = parseInt(params.vdamMiniBatches) || parseInt(params.nr_iter_grad) || 0;
  } else {
    iterationCount = parseInt(params.numberEMIterations) || parseInt(params.numberOfIterations) ||
                     parseInt(params.nr_iter) || 0;
  }

  // Count particles and micrographs from latest output data.star
  const absOutputDir = await resolveOutputDir(job);
  if (absOutputDir) {
    const latestStar = findLatestDataStar(absOutputDir);
    if (latestStar) {
      const pc = await countParticlesInStar(latestStar);
      if (pc > 0) particleCount = pc;
      const mc = await countMicrographsInStar(latestStar);
      if (mc > 0) micrographCount = mc;
    }
  }

  // Parameter-derived fields
  const maskDiameter = parseFloat(params.maskDiameter) || null;
  const symmetry = params.symmetry || null;

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    box_size: boxSize,
    class_count: classCount,
    iteration_count: iterationCount,
    total_iterations: iterationCount, // total requested = same value since job completed all
    mask_diameter: maskDiameter,
    symmetry: symmetry
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Classification ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | classes: ${classCount} | iters: ${iterationCount} | mics: ${micrographCount} | parts: ${particleCount}`);
}

/**
 * Store pipeline metadata for AutoRefine jobs
 * Extracts: resolution, iteration_count, particle_count, pixel_size
 *
 * @param {Object} job - The job document
 */
async function storeRefinementMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;
  let particleCount = 0;
  let micrographCount = 0;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  // If no upstream pixel_size, calculate from pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Count iterations and extract resolution
  let iterationCount = 0;
  let resolution = null;
  const absOutputDir = await resolveOutputDir(job);
  const effectiveDir = absOutputDir || outputDir;

  if (effectiveDir) {
    iterationCount = await countIterations(effectiveDir);

    const modelStar = path.join(effectiveDir, 'run_model.star');
    resolution = await extractResolutionFromStar(modelStar);

    if (!resolution && iterationCount > 0) {
      const iterModelStar = path.join(effectiveDir, `run_it${String(iterationCount).padStart(3, '0')}_model.star`);
      resolution = await extractResolutionFromStar(iterModelStar);
    }

    // Fallback to --ini_high (starting resolution) if no model.star resolution yet
    if (!resolution) {
      const iniHigh = parseFloat(job.parameters?.initialLowPassFilter || job.parameters?.lowPassFilter || job.parameters?.ini_high);
      if (iniHigh > 0) resolution = iniHigh;
    }

    // Count particles and micrographs from output data.star
    const latestStar = findLatestDataStar(effectiveDir);
    if (latestStar) {
      const pc = await countParticlesInStar(latestStar);
      if (pc > 0) particleCount = pc;
      const mc = await countMicrographsInStar(latestStar);
      if (mc > 0) micrographCount = mc;
    }
  }

  const symmetry = job.parameters?.symmetry || null;

  const updateData = buildStatsUpdate({
    pixel_size: pixelSize,
    micrograph_count: micrographCount,
    particle_count: particleCount,
    box_size: boxSize,
    resolution,
    iteration_count: iterationCount,
    symmetry: symmetry
  });

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Refinement ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | res: ${resolution}Å | iters: ${iterationCount} | mics: ${micrographCount} | parts: ${particleCount}`);
}

/**
 * Store pipeline metadata for PostProcess jobs
 * Extracts: resolution (final), pixel_size
 *
 * @param {Object} job - The job document
 */
async function storePostProcessMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit non-count fields from upstream
  let pixelSize = null;
  let boxSize = null;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    boxSize = us.box_size ?? upstreamJob.box_size ?? null;
  }

  // If no upstream pixel_size, calculate from pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Extract resolution and B-factor from postprocess.star
  // PostProcess doesn't produce count outputs — omit micrograph_count/particle_count
  // to preserve submission-time inherited values via dot-notation updates
  let resolution = null;
  let bfactor = null;
  if (outputDir) {
    const postprocessStar = path.join(outputDir, 'postprocess.star');
    resolution = await extractResolutionFromStar(postprocessStar);

    // Extract B-factor using regex
    try {
      const content = await fs.promises.readFile(postprocessStar, 'utf-8');
      const bfactorMatch = content.match(/_rlnBfactorUsedForSharpening\s+(-?[\d.]+)/);
      if (bfactorMatch) {
        bfactor = parseFloat(bfactorMatch[1]);
      }
    } catch (e) {
      // Star file not found or unreadable — bfactor stays null
    }
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      box_size: boxSize,
      resolution,
      bfactor
    }
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] PostProcess ${job.job_name} | pixels: ${pixelSize}Å | res: ${resolution}Å | bfac: ${bfactor}`);
}

/**
 * Catalog output files for Import "other" node type jobs.
 * RELION copies imported files with their original names, so pattern-based
 * cataloging won't work. Instead, detect the node type and find the actual file.
 *
 * Node type -> role mapping:
 *   ref3d  -> referenceMrc  (3D reference map)
 *   mask   -> maskMrc       (solvent mask)
 *   halfmap-> halfMapMrc    (unfiltered half-map)
 *   refs2d -> refs2dMrcs    (2D class average references)
 *   coords -> coordinatesStar (particle coordinates)
 */
async function catalogImportOtherOutputFiles(job) {
  const outputDir = job.output_file_path;
  if (!outputDir) return;

  try {
    await fs.promises.access(outputDir);
  } catch {
    logger.warn(`[CatalogImportOther] Output dir not accessible: ${outputDir}`);
    return;
  }

  // Detect node type from command flags
  const cmd = job.command || '';
  let nodeType = null;
  if (cmd.includes('--do_coordinates')) {
    nodeType = 'coords';
  } else if (cmd.includes('--do_halfmaps')) {
    nodeType = 'halfmap';
  } else {
    const nodeTypeMatch = cmd.match(/--node_type\s+(\w+)/);
    nodeType = nodeTypeMatch?.[1];
  }
  if (!nodeType) {
    logger.warn(`[CatalogImportOther] Cannot determine node type from command for ${job.job_name}`);
    return;
  }

  // Map node type to semantic role and expected file type
  const NODE_ROLE_MAP = {
    ref3d:   { role: 'referenceMrc',    fileType: 'mrc',  extensions: ['.mrc'] },
    mask:    { role: 'maskMrc',         fileType: 'mrc',  extensions: ['.mrc'] },
    halfmap: { role: 'halfMapMrc',      fileType: 'mrc',  extensions: ['.mrc'] },
    refs2d:  { role: 'refs2dMrcs',      fileType: 'mrcs', extensions: ['.mrcs', '.star'] },
    coords:  { role: 'coordinatesStar', fileType: 'star', extensions: ['.star'] },
  };

  const mapping = NODE_ROLE_MAP[nodeType];
  if (!mapping) {
    logger.warn(`[CatalogImportOther] Unknown node type '${nodeType}' for ${job.job_name}`);
    return;
  }

  // Find the data file in output dir (skip run.* and RELION_* control files)
  const allFiles = await fs.promises.readdir(outputDir);
  const dataFiles = allFiles.filter(f =>
    !f.startsWith('run.') && !f.startsWith('RELION_') &&
    mapping.extensions.some(ext => f.endsWith(ext))
  );

  if (dataFiles.length === 0) {
    logger.warn(`[CatalogImportOther] No ${mapping.extensions.join('/')} files found in ${outputDir}`);
    return;
  }

  const projectRoot = path.dirname(path.dirname(outputDir));
  const outputFiles = [];

  for (const fileName of dataFiles) {
    const filePath = path.join(outputDir, fileName);
    const relativePath = path.relative(projectRoot, filePath);
    let entryCount = 0;

    // Count entries: STAR rows for star files, Z-slices for mrcs stacks
    if (fileName.endsWith('.star')) {
      entryCount = await countStarFileEntries(filePath);
      if (entryCount === 0) entryCount = await countParticlesInStar(filePath);
    } else if (fileName.endsWith('.mrcs')) {
      try {
        const { getMrcInfo } = require('./mrcParser');
        const info = getMrcInfo(filePath);
        if (info?.num_frames > 1) entryCount = info.num_frames;
      } catch (e) { /* ignore */ }
    }

    outputFiles.push({
      role: mapping.role,
      fileType: mapping.fileType,
      fileName,
      relativePath,
      entryCount,
    });
  }

  if (outputFiles.length > 0) {
    await Job.findOneAndUpdate(
      { id: job.id },
      { output_files: outputFiles }
    );
    logger.info(`[CatalogImportOther] Cataloged ${outputFiles.length} files for ${job.job_name} (${nodeType}): ${outputFiles.map(f => f.fileName).join(', ')}`);
  }
}

/**
 * Catalog output files for a completed job.
 * Scans the job's output directory using STAGE_OUTPUT_CATALOG patterns
 * and stores structured entries in the output_files[] array.
 *
 * @param {Object} job - The job document (lean)
 */
async function catalogOutputFiles(job) {
  const { STAGE_OUTPUT_CATALOG } = require('../config/constants');
  const { glob } = require('glob');

  // Special handling for Import "other" node type jobs (ref3d, mask, halfmap, refs2d, coords)
  // RELION copies files with original names, so pattern-based cataloging won't work
  const isOtherNodeImport = job.job_type === 'Import' && (job.command?.includes('--do_other') || job.command?.includes('--do_coordinates') || job.command?.includes('--do_halfmaps'));
  if (isOtherNodeImport) {
    return catalogImportOtherOutputFiles(job);
  }

  const catalog = STAGE_OUTPUT_CATALOG[job.job_type];
  if (!catalog || !job.output_file_path) {
    logger.warn(`[CatalogOutput] Skipping ${job.job_name}: no catalog for type '${job.job_type}' or no output_file_path`);
    return;
  }

  const outputDir = job.output_file_path;
  try {
    await fs.promises.access(outputDir);
  } catch {
    logger.warn(`[CatalogOutput] Skipping ${job.job_name}: output dir not accessible: ${outputDir}`);
    return;
  }

  // Derive project root from outputDir (go up 2 levels: Stage/JobXXX -> projectRoot)
  const projectRoot = path.dirname(path.dirname(outputDir));
  const outputFiles = [];

  for (const entry of catalog) {
    let matches = await glob(path.join(outputDir, entry.pattern));

    // For iteration-aware files, keep only the final (highest) iteration
    if (entry.iterationAware && matches.length > 1) {
      let maxIter = -1;
      let finalFiles = [];
      for (const m of matches) {
        const iterMatch = path.basename(m).match(/it(\d+)/);
        const iter = iterMatch ? parseInt(iterMatch[1]) : 0;
        if (iter > maxIter) {
          maxIter = iter;
          finalFiles = [m];
        } else if (iter === maxIter) {
          finalFiles.push(m);
        }
      }
      matches = finalFiles;
    }

    for (const matchPath of matches) {
      const fileName = path.basename(matchPath);
      const relativePath = path.relative(projectRoot, matchPath);

      let entryCount = 0;
      if (entry.fileType === 'star') {
        entryCount = await countStarFileEntries(matchPath);
        if (entryCount === 0) {
          entryCount = await countParticlesInStar(matchPath);
        }
      }

      outputFiles.push({
        role: entry.role,
        fileType: entry.fileType,
        fileName,
        relativePath,
        entryCount,
      });
    }
  }

  if (outputFiles.length > 0) {
    await Job.findOneAndUpdate(
      { id: job.id },
      { output_files: outputFiles }
    );
    logger.info(`[CatalogOutput] Cataloged ${outputFiles.length} output files for ${job.job_name}: ${outputFiles.map(f => f.fileName).join(', ')}`);
  } else {
    logger.warn(`[CatalogOutput] No output files found for ${job.job_name} (type: ${job.job_type}) in ${outputDir}`);
    // Log what patterns were searched
    for (const entry of catalog) {
      logger.warn(`[CatalogOutput]   Pattern '${entry.pattern}' (${entry.fileType}) -> 0 matches in ${outputDir}`);
    }
  }
}

/**
 * Store pipeline metadata when a job completes
 * @param {string} jobId - The job ID
 */
async function storeJobMetadata(jobId) {
  try {
    const job = await Job.findOne({ id: jobId }).lean();
    if (!job) {
      logger.warn(`[PipelineMetadata] Job ${jobId} not found`);
      return;
    }

    const jobType = (job.job_type || '').toLowerCase().replace(/[_\s-]/g, '');

    switch (jobType) {
      case 'import':
        await storeImportMetadata(job);
        break;
      case 'motioncorr':
      case 'motion':
      case 'motioncorrection':
        await storeMotionMetadata(job);
        break;
      case 'ctffind':
      case 'ctf':
      case 'ctfestimation':
        await storeCTFMetadata(job);
        break;
      case 'autopick':
      case 'autopicking':
        await storeAutoPickMetadata(job);
        break;
      case 'extract':
      case 'particleextraction':
        await storeExtractMetadata(job);
        break;

      // Classification jobs - extract class_count, iteration_count
      case 'class2d':
      case '2dclassification':
      case 'class3d':
      case '3dclassification':
      case 'initialmodel':
      case '3dinitialmodel':
        await storeClassificationMetadata(job);
        break;

      // Refinement jobs - extract resolution, iteration_count
      case 'autorefine':
      case 'refine3d':
      case '3drefinement':
        await storeRefinementMetadata(job);
        break;

      // PostProcess - extract final resolution
      case 'postprocess':
      case 'postprocessing':
        await storePostProcessMetadata(job);
        break;

      // CTF Refinement - counts output particles from particles_ctf_refine.star
      case 'ctfrefine':
      case 'ctfrefinement':
        await storeCtfRefineMetadata(job);
        break;

      // Bayesian Polishing - counts output particles from shiny.star
      case 'polish':
      case 'bayesianpolishing':
        await storePolishMetadata(job);
        break;

      // Particle Subtraction - counts output from particles_subtracted.star
      case 'subtract':
      case 'particlesubtraction':
        await storeSubtractMetadata(job);
        break;

      // Join Star Files - counts output from join_*.star files
      case 'joinstarfiles':
      case 'joinstar':
        await storeJoinStarMetadata(job);
        break;

      // Local Resolution - parses mean resolution from run.out
      case 'localresolution':
      case 'localres':
        await storeLocalResMetadata(job);
        break;

      // Jobs that inherit from upstream without special processing
      case 'manualselect':
      case 'manualpick':
      case 'manualpicking':
      case 'maskcreate':
      case 'maskcreation':
      case '3dmultibody':
      case 'multibody':
      case 'subset':
      case 'subsetselection':
      case 'dynamight':
      case 'dynamightflexibility':
      case 'modelangelo':
        await storeGenericMetadata(job);
        break;
      default:
        logger.debug(`[PipelineMetadata] No specific metadata handler for job type: ${job.job_type}`);
        // Still try to inherit generic metadata for unknown types
        await storeGenericMetadata(job);
    }

    // Catalog output files for all job types (for downstream auto-population)
    await catalogOutputFiles(job);

  } catch (error) {
    logger.error(`[PipelineMetadata] Error storing metadata for job ${jobId}: ${error.message}`);
  }
}

module.exports = {
  // Main functions
  storeJobMetadata,
  catalogOutputFiles,

  // Stage-specific functions
  storeImportMetadata,
  storeMotionMetadata,
  storeCTFMetadata,
  storeAutoPickMetadata,
  storeExtractMetadata,
  storeGenericMetadata,
  storeClassificationMetadata,
  storeRefinementMetadata,
  storePostProcessMetadata,
  storePolishMetadata,
  storeCtfRefineMetadata,
  storeSubtractMetadata,
  storeJoinStarMetadata,
  storeLocalResMetadata,

  // Stats utilities
  buildStatsUpdate,
  calculatePixelSizeFromPipeline,
  getPixelSizeSafe,

  // Job traversal utilities
  findImportJob,
  findUpstreamJob,
  findUpstreamJobDirect,
  getJobPath,

  // STAR file utilities
  countStarFileEntries,
  countParticlesInStar,
  countMicrographsInStar,
  extractResolutionFromStar,
  countIterations,
  countClassFiles
};
