/**
 * Pipeline Metadata Helper
 *
 * Stores pipeline metadata when jobs complete.
 * Node.js equivalent of Python's common/pipeline_metadata.py
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

  // 3. Try pipeline_metadata.original_pixel_size (for Import jobs)
  const meta = job.pipeline_metadata || {};
  if (meta.original_pixel_size && !isNaN(meta.original_pixel_size)) {
    return meta.original_pixel_size;
  }

  // 4. Try parameters.angpix (for Import jobs)
  const params = job.parameters || {};
  if (params.angpix) {
    const angpix = parseFloat(params.angpix);
    if (!isNaN(angpix)) return angpix;
  }

  return null;
}

/**
 * Build a complete pipeline_stats + pipeline_metadata update for Job.findOneAndUpdate.
 *
 * pipeline_stats: Uniform per-job statistics (always writes ALL 7 fields).
 * pipeline_metadata: Derivation context only (HOW values were computed, no duplicate counts).
 *
 * @param {Object} stats - Partial stats object (defaults applied for missing fields)
 * @param {Object} context - Derivation context for pipeline_metadata
 * @returns {Object} MongoDB update document
 */
function buildStatsUpdate(stats, context) {
  return {
    pipeline_stats: {
      pixel_size: stats.pixel_size ?? null,
      micrograph_count: stats.micrograph_count ?? 0,
      particle_count: stats.particle_count ?? 0,
      box_size: stats.box_size ?? null,
      resolution: stats.resolution ?? null,
      class_count: stats.class_count ?? 0,
      iteration_count: stats.iteration_count ?? 0
    },
    pipeline_metadata: context,
    updated_at: new Date()
  };
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
 * Store pipeline metadata for Import job
 * @param {Object} job - The job document
 */
async function storeImportMetadata(job) {
  const params = job.parameters || {};
  const command = job.command || '';

  // Determine import type
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
  let micrographCount = 0;
  const outputDir = job.output_file_path;
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
          micrographCount = count;
          logger.info(`[PipelineMetadata] Import job ${job.job_name}: counted ${count} entries from ${starName}`);
        }
        break;
      }
    }
  }

  // Build derivation context (no duplicate counts)
  const context = { import_type: importType || 'unknown' };
  if (originalPixelSize) context.original_pixel_size = originalPixelSize;
  if (params.kV) context.voltage_kv = parseFloat(params.kV);
  if (params.spherical) context.spherical_aberration = parseFloat(params.spherical);

  const updateData = buildStatsUpdate(
    { pixel_size: originalPixelSize, micrograph_count: micrographCount },
    context
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Import ${job.job_name} | pixels: ${originalPixelSize}Å | micrographs: ${micrographCount} | type: ${importType}`);
}

/**
 * Store pipeline metadata for Motion Correction job
 * @param {Object} job - The job document
 */
async function storeMotionMetadata(job) {
  const params = job.parameters || {};

  // Get original pixel size from Import job
  let originalPixelSize = null;
  let micrographCount = 0;
  const importJob = await findImportJob(job);
  if (importJob) {
    const importParams = importJob.parameters || {};
    if (importParams.angpix) {
      originalPixelSize = parseFloat(importParams.angpix);
    }
    micrographCount = importJob.pipeline_stats?.micrograph_count || importJob.micrograph_count || 0;
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

  // Build derivation context
  const context = {};
  if (originalPixelSize) context.original_pixel_size = originalPixelSize;
  context.binning_factor = binningFactor;
  const dosePerFrame = parseFloat(params.dosePerFrame) || parseFloat(params.dose_per_frame);
  if (dosePerFrame && !isNaN(dosePerFrame)) context.dose_per_frame = dosePerFrame;

  const updateData = buildStatsUpdate(
    { pixel_size: pixelSize, micrograph_count: micrographCount },
    context
  );

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
  const context = {};
  const motionJob = await findUpstreamJob(job, ['MotionCorr', 'Motion']);
  if (motionJob) {
    pixelSize = getPixelSizeSafe(motionJob);
    const motionMeta = motionJob.pipeline_metadata || {};
    if (motionMeta.original_pixel_size) {
      context.original_pixel_size = motionMeta.original_pixel_size;
    }
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
    { pixel_size: pixelSize, micrograph_count: micrographCount },
    context
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
  // Get pixel size from upstream CTF job
  let pixelSize = null;
  const ctfJob = await findUpstreamJob(job, ['CtfFind', 'CTF', 'CtfEstimation']);
  if (ctfJob) {
    pixelSize = getPixelSizeSafe(ctfJob);
  }

  // Count micrographs from autopick.star (async I/O to avoid blocking event loop)
  // NOTE: We only count micrographs here, NOT particles from each coordinate file.
  // Particle counts come from the Extract job later.
  let micrographCount = 0;
  const outputDir = job.output_file_path;

  if (outputDir) {
    const starPath = path.join(outputDir, 'autopick.star');
    try {
      const content = await fs.promises.readFile(starPath, 'utf-8');
      const lines = content.split('\n');
      let inDataSection = false;

      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed.startsWith('loop_')) { inDataSection = true; continue; }
        if (inDataSection && trimmed.startsWith('_')) continue;
        if (inDataSection && trimmed && !trimmed.startsWith('#') && !trimmed.startsWith('data_')) {
          micrographCount++;
        }
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        logger.warn(`[PipelineMetadata] Failed to read autopick.star for ${job.job_name}: ${error.message}`);
      }
    }
  }

  const updateData = buildStatsUpdate(
    { pixel_size: pixelSize, micrograph_count: micrographCount },
    {}
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] AutoPick ${job.job_name} | pixels: ${pixelSize}Å | micrographs: ${micrographCount}`);
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

  // Get pixel size from upstream job - try multiple sources
  let upstreamJob = await findUpstreamJob(job, ['CtfFind', 'CTF', 'CtfEstimation']);
  if (!upstreamJob) upstreamJob = await findUpstreamJob(job, ['AutoPick']);
  if (!upstreamJob) upstreamJob = await findUpstreamJob(job, ['MotionCorr', 'Motion']);

  // Get the micrograph pixel size (before extraction)
  let micrographPixelSize = null;
  if (upstreamJob) {
    micrographPixelSize = getPixelSizeSafe(upstreamJob);
  }

  // If no upstream pixel_size, try to calculate from scratch
  if (!micrographPixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) {
      micrographPixelSize = pixelCalc.current_pixel_size;
    }
  }

  // Check for rescaling
  const rescale = params.rescale === 'Yes' || params.rescale === true ||
                  params.doRescale === 'Yes' || params.do_rescale === 'Yes';

  const boxSize = parseInt(params.boxSize) || parseInt(params.extractSize) ||
                  parseInt(params.extract_size) || parseInt(params.box_size) || 0;

  const rescaledSize = parseInt(params.rescaledSize) || parseInt(params.rescaled_size) ||
                       parseInt(params.rescale_size) || 0;

  // Calculate pixel_size (may change with rescaling)
  let pixelSize = micrographPixelSize;
  const context = {};
  if (micrographPixelSize) context.micrograph_pixel_size = micrographPixelSize;

  if (rescale && micrographPixelSize && boxSize > 0 && rescaledSize > 0 && boxSize !== rescaledSize) {
    context.rescaled_size = rescaledSize;
    context.rescale_factor = boxSize / rescaledSize;
    pixelSize = micrographPixelSize * (boxSize / rescaledSize);
    logger.info(`[PixelSize] Extract ${job.job_name}: ${micrographPixelSize.toFixed(3)} × (${boxSize}/${rescaledSize}) = ${pixelSize.toFixed(3)} Å`);
  }

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

  // Inherit micrograph_count from upstream
  let micrographCount = 0;
  if (upstreamJob) {
    micrographCount = upstreamJob.pipeline_stats?.micrograph_count || upstreamJob.micrograph_count || 0;
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize || null
    },
    context
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Extract ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | particles: ${particleCount} | micrographs: ${micrographCount}`);
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
  const context = {};

  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    micrographCount = us.micrograph_count || upstreamJob.micrograph_count || 0;
    particleCount = us.particle_count || upstreamJob.particle_count || 0;
    boxSize = us.box_size || upstreamJob.box_size || null;
    resolution = us.resolution || upstreamJob.resolution || null;
    classCount = us.class_count || upstreamJob.class_count || 0;
    iterationCount = us.iteration_count || upstreamJob.iteration_count || 0;
  }

  // If no upstream pixel_size, calculate from the pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) {
      pixelSize = pixelCalc.current_pixel_size;
      context.original_pixel_size = pixelCalc.original_pixel_size;
    }
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
    },
    context
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Generic ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | mics: ${micrographCount} | parts: ${particleCount}`);
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

  // Inherit from upstream
  let pixelSize = null;
  let boxSize = null;
  let particleCount = 0;
  let micrographCount = 0;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    particleCount = us.particle_count || upstreamJob.particle_count || 0;
    boxSize = us.box_size || upstreamJob.box_size || null;
    micrographCount = us.micrograph_count || upstreamJob.micrograph_count || 0;
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

  // Count iterations from output files
  let iterationCount = 0;
  if (outputDir) {
    iterationCount = await countIterations(outputDir);
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize,
      class_count: classCount,
      iteration_count: iterationCount
    },
    {}
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Classification ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | classes: ${classCount} | iters: ${iterationCount} | mics: ${micrographCount}`);
}

/**
 * Store pipeline metadata for AutoRefine jobs
 * Extracts: resolution, iteration_count, particle_count, pixel_size
 *
 * @param {Object} job - The job document
 */
async function storeRefinementMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit from upstream
  let pixelSize = null;
  let boxSize = null;
  let particleCount = 0;
  let micrographCount = 0;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    particleCount = us.particle_count || upstreamJob.particle_count || 0;
    boxSize = us.box_size || upstreamJob.box_size || null;
    micrographCount = us.micrograph_count || upstreamJob.micrograph_count || 0;
  }

  // If no upstream pixel_size, calculate from pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Count iterations and extract resolution
  let iterationCount = 0;
  let resolution = null;
  if (outputDir) {
    iterationCount = await countIterations(outputDir);

    const modelStar = path.join(outputDir, 'run_model.star');
    resolution = await extractResolutionFromStar(modelStar);

    if (!resolution && iterationCount > 0) {
      const iterModelStar = path.join(outputDir, `run_it${String(iterationCount).padStart(3, '0')}_model.star`);
      resolution = await extractResolutionFromStar(iterModelStar);
    }
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize,
      resolution,
      iteration_count: iterationCount
    },
    {}
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] Refinement ${job.job_name} | pixels: ${pixelSize}Å | box: ${boxSize} | res: ${resolution}Å | iters: ${iterationCount} | mics: ${micrographCount}`);
}

/**
 * Store pipeline metadata for PostProcess jobs
 * Extracts: resolution (final), pixel_size
 *
 * @param {Object} job - The job document
 */
async function storePostProcessMetadata(job) {
  const outputDir = job.output_file_path;

  // Inherit from upstream
  let pixelSize = null;
  let particleCount = 0;
  let boxSize = null;
  let micrographCount = 0;

  const upstreamJob = await findUpstreamJobDirect(job);
  if (upstreamJob) {
    const us = upstreamJob.pipeline_stats || {};
    pixelSize = getPixelSizeSafe(upstreamJob);
    particleCount = us.particle_count || upstreamJob.particle_count || 0;
    boxSize = us.box_size || upstreamJob.box_size || null;
    micrographCount = us.micrograph_count || upstreamJob.micrograph_count || 0;
  }

  // If no upstream pixel_size, calculate from pipeline
  if (!pixelSize) {
    const pixelCalc = await calculatePixelSizeFromPipeline(job);
    if (pixelCalc.current_pixel_size) pixelSize = pixelCalc.current_pixel_size;
  }

  // Extract resolution from postprocess.star
  let resolution = null;
  const context = {};
  if (outputDir) {
    const postprocessStar = path.join(outputDir, 'postprocess.star');
    resolution = await extractResolutionFromStar(postprocessStar);
    if (resolution && resolution > 0) {
      context.final_resolution = resolution; // Marks as final FSC-based resolution
    }
  }

  const updateData = buildStatsUpdate(
    {
      pixel_size: pixelSize,
      micrograph_count: micrographCount,
      particle_count: particleCount,
      box_size: boxSize,
      resolution
    },
    context
  );

  await Job.findOneAndUpdate({ id: job.id }, updateData);
  logger.info(`[PipelineMetadata] PostProcess ${job.job_name} | pixels: ${pixelSize}Å | res: ${resolution}Å | mics: ${micrographCount}`);
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

  // Detect node type from command
  const nodeTypeMatch = (job.command || '').match(/--node_type\s+(\w+)/);
  const nodeType = nodeTypeMatch?.[1];
  if (!nodeType) {
    logger.warn(`[CatalogImportOther] No --node_type in command for ${job.job_name}`);
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
  if (job.job_type === 'Import' && job.command?.includes('--do_other')) {
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

      // Jobs that inherit from upstream without special processing
      case 'manualselect':
      case 'manualpick':
      case 'manualpicking':
      case 'ctfrefine':
      case 'ctfrefinement':
      case 'polish':
      case 'bayesianpolishing':
      case 'maskcreate':
      case 'maskcreation':
      case 'subtract':
      case 'particlesubtraction':
      case 'localresolution':
      case 'localres':
      case '3dmultibody':
      case 'multibody':
      case 'subset':
      case 'subsetselection':
      case 'joinstarfiles':
      case 'joinstar':
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
  extractResolutionFromStar,
  countIterations,
  countClassFiles
};
