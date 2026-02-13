/**
 * Backfill Job Stats Utility
 *
 * Populates pixel_size, micrograph_count, and particle_count for existing jobs.
 * Uses the robust calculatePixelSizeFromPipeline to ensure accurate pixel_size
 * even when upstream jobs have missing data.
 *
 * Run with: node backend/src/utils/backfillJobStats.js
 */

const mongoose = require('mongoose');
const path = require('path');
// Load .env from project root (single config file for all settings)
require('dotenv').config({ path: path.join(__dirname, '../../../.env') });

// Import after dotenv so environment variables are available
const Job = require('../models/Job');
const {
  storeJobMetadata,
  calculatePixelSizeFromPipeline,
  getPixelSizeSafe,
  findImportJob
} = require('./pipelineMetadata');

const logger = {
  info: (...args) => console.log('[INFO]', ...args),
  warn: (...args) => console.warn('[WARN]', ...args),
  error: (...args) => console.error('[ERROR]', ...args),
  debug: (...args) => process.env.DEBUG && console.log('[DEBUG]', ...args)
};

/**
 * Connect to MongoDB
 */
async function connectDB() {
  const mongoUri = process.env.MONGO_URI || 'mongodb://localhost:27017/cryoprocess';
  await mongoose.connect(mongoUri);
  logger.info(`Connected to MongoDB: ${mongoUri}`);
}

/**
 * Backfill stats for a single job
 * @param {Object} job - The job document
 * @param {boolean} forceRecalculate - If true, recalculate pixel_size from scratch
 */
async function backfillJobStats(job, forceRecalculate = false) {
  try {
    const updates = {};

    // Check if pixel_size needs updating
    const currentPixelSize = job.pipeline_stats?.pixel_size || job.pixel_size;
    if (!currentPixelSize || forceRecalculate) {
      // Calculate pixel_size from pipeline (authoritative)
      const pixelCalc = await calculatePixelSizeFromPipeline(job);
      if (pixelCalc.current_pixel_size) {
        // Update pipeline_stats (the canonical location)
        const existingStats = job.pipeline_stats || {};
        updates.pipeline_stats = {
          pixel_size: pixelCalc.current_pixel_size,
          micrograph_count: existingStats.micrograph_count || 0,
          particle_count: existingStats.particle_count || 0,
          box_size: existingStats.box_size || null,
          resolution: existingStats.resolution || null,
          class_count: existingStats.class_count || 0,
          iteration_count: existingStats.iteration_count || 0
        };


        if (pixelCalc.transformations.length > 0) {
          logger.debug(`[${job.job_name}] pixel_size calculated: ${pixelCalc.current_pixel_size} (${pixelCalc.transformations.length} transformations)`);
        }
      }
    }

    // Also run the standard metadata extraction for counts
    await storeJobMetadata(job.id);

    // Apply any additional updates
    if (Object.keys(updates).length > 0) {
      await Job.findOneAndUpdate({ id: job.id }, { ...updates, updated_at: new Date() });
    }

    return true;
  } catch (error) {
    logger.error(`Failed to backfill job ${job.job_name}: ${error.message}`);
    return false;
  }
}

/**
 * Backfill stats for all jobs in a project
 * @param {string} projectId - Project ID
 */
async function backfillProjectJobs(projectId) {
  const jobs = await Job.find({ project_id: projectId, status: 'success' })
    .sort({ created_at: 1 })
    .lean();

  logger.info(`Found ${jobs.length} successful jobs in project ${projectId}`);

  let success = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await backfillJobStats(job);
    if (result) {
      success++;
    } else {
      failed++;
    }
  }

  logger.info(`Backfill complete: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

/**
 * Backfill stats for all jobs in the database
 */
async function backfillAllJobs() {
  // Get all successful jobs, sorted by creation date (oldest first)
  // This ensures we process parent jobs before children
  const jobs = await Job.find({ status: 'success' })
    .sort({ created_at: 1 })
    .lean();

  logger.info(`Found ${jobs.length} successful jobs to backfill`);

  let success = 0;
  let failed = 0;

  for (const job of jobs) {
    const result = await backfillJobStats(job);
    if (result) {
      success++;
      if (success % 100 === 0) {
        logger.info(`Progress: ${success} jobs processed...`);
      }
    } else {
      failed++;
    }
  }

  logger.info(`Backfill complete: ${success} succeeded, ${failed} failed`);
  return { success, failed };
}

/**
 * Show current stats for jobs (dry run)
 */
async function showJobStats() {
  const stats = await Job.aggregate([
    { $match: { status: 'success' } },
    {
      $group: {
        _id: '$job_type',
        total: { $sum: 1 },
        withPixelSize: {
          $sum: { $cond: [{ $gt: ['$pipeline_stats.pixel_size', null] }, 1, 0] }
        },
        withMicrographCount: {
          $sum: { $cond: [{ $gt: ['$pipeline_stats.micrograph_count', 0] }, 1, 0] }
        },
        withParticleCount: {
          $sum: { $cond: [{ $gt: ['$pipeline_stats.particle_count', 0] }, 1, 0] }
        }
      }
    },
    { $sort: { _id: 1 } }
  ]);

  logger.info('\nCurrent job stats by type:');
  logger.info('----------------------------------------');
  console.table(stats.map(s => ({
    'Job Type': s._id,
    'Total': s.total,
    'Has pixel_size': s.withPixelSize,
    'Has micrograph_count': s.withMicrographCount,
    'Has particle_count': s.withParticleCount
  })));
}

/**
 * Verify pixel_size values by recalculating from pipeline
 * Reports any discrepancies without making changes
 */
async function verifyPixelSizes(projectId = null) {
  const query = { status: 'success' };
  if (projectId) query.project_id = projectId;

  const jobs = await Job.find(query).sort({ created_at: 1 }).lean();
  logger.info(`Verifying pixel_size for ${jobs.length} jobs...`);

  let correct = 0;
  let incorrect = 0;
  let missing = 0;
  const discrepancies = [];

  for (const job of jobs) {
    const stored = job.pipeline_stats?.pixel_size || job.pixel_size;
    const calculated = await calculatePixelSizeFromPipeline(job);

    if (!stored && !calculated.current_pixel_size) {
      missing++;
      continue;
    }

    if (!stored && calculated.current_pixel_size) {
      missing++;
      discrepancies.push({
        job: job.job_name,
        type: job.job_type,
        stored: 'null',
        calculated: calculated.current_pixel_size.toFixed(4)
      });
      continue;
    }

    if (calculated.current_pixel_size) {
      // Allow small floating point differences (0.1%)
      const diff = Math.abs(stored - calculated.current_pixel_size) / calculated.current_pixel_size;
      if (diff < 0.001) {
        correct++;
      } else {
        incorrect++;
        discrepancies.push({
          job: job.job_name,
          type: job.job_type,
          stored: stored.toFixed(4),
          calculated: calculated.current_pixel_size.toFixed(4)
        });
      }
    } else {
      correct++; // Can't verify, assume correct
    }
  }

  logger.info(`\nVerification results:`);
  logger.info(`  Correct: ${correct}`);
  logger.info(`  Incorrect: ${incorrect}`);
  logger.info(`  Missing: ${missing}`);

  if (discrepancies.length > 0) {
    logger.info(`\nDiscrepancies found:`);
    console.table(discrepancies.slice(0, 20)); // Show first 20
    if (discrepancies.length > 20) {
      logger.info(`  ... and ${discrepancies.length - 20} more`);
    }
  }

  return { correct, incorrect, missing, discrepancies };
}

/**
 * Extract job names from input file paths in job parameters
 * @param {Object} params - Job parameters
 * @returns {string[]} Array of job names (e.g., ["Job002", "Job005"])
 */
function extractJobNamesFromParams(params) {
  if (!params) return [];

  const inputFields = [
    'inputStarFile', 'inputMicrographs', 'micrographStarFile',
    'inputCoordinates', 'inputParticles', 'particlesStarFile',
    'input_star_file', 'inputMovies', 'ctfStarFile', 'autopickStarFile',
    'refinementStarFile', 'particleStarFile', 'inputImages',
    'inputStarMicrograph', 'micrographsCtfFile', 'coordinatesFile',
    'maskFile', 'referenceMap', 'inputMap', 'inputVolume',
    'halfMap1', 'halfMap2', 'inputModel', 'sharpenedMap',
    'referenceVolume', 'solventMask', 'inputMask',
    'inputPdb', 'inputPdbFile', 'pdbFile', 'bodyStarFile',
    'polishStarFile', 'subtractStarFile', 'localresStarFile',
    'particlesStarFile1', 'particlesStarFile2', 'particlesStarFile3', 'particlesStarFile4',
    'classFromJob', 'class_from_job', 'selectClassesFromJob', 'select_classes_from_job'
  ];

  const jobNames = new Set();
  for (const field of inputFields) {
    const value = params[field];
    if (value && typeof value === 'string') {
      const match = value.match(/Job(\d+)/i);
      if (match) {
        const jobNum = parseInt(match[1], 10);
        jobNames.add(`Job${String(jobNum).padStart(3, '0')}`);
      }
    }
  }

  return Array.from(jobNames);
}

/**
 * Fix input_job_ids for existing jobs by extracting from their parameters
 * This repairs the job tree connections
 */
async function fixInputJobIds(projectId = null) {
  const query = {};
  if (projectId) query.project_id = projectId;

  const jobs = await Job.find(query).sort({ created_at: 1 }).lean();
  logger.info(`Processing ${jobs.length} jobs for input_job_ids repair...`);

  // Build a map of job_name -> id for each project
  const projectJobMaps = new Map();
  for (const job of jobs) {
    if (!projectJobMaps.has(job.project_id)) {
      projectJobMaps.set(job.project_id, new Map());
    }
    projectJobMaps.get(job.project_id).set(job.job_name, job.id);
  }

  let updated = 0;
  let skipped = 0;
  let errors = 0;

  for (const job of jobs) {
    try {
      // Skip Import jobs (they have no inputs)
      if (job.job_type === 'Import') {
        skipped++;
        continue;
      }

      // Skip if already has valid input_job_ids
      if (job.input_job_ids && job.input_job_ids.length > 0) {
        // Verify they're valid IDs
        const jobMap = projectJobMaps.get(job.project_id);
        const allValid = job.input_job_ids.every(id => {
          // Check if id exists in our job map values
          for (const [, jobId] of jobMap) {
            if (jobId === id) return true;
          }
          return false;
        });

        if (allValid) {
          skipped++;
          continue;
        }
      }

      // Extract job names from parameters
      const inputJobNames = extractJobNamesFromParams(job.parameters);
      if (inputJobNames.length === 0) {
        skipped++;
        continue;
      }

      // Resolve to database IDs
      const jobMap = projectJobMaps.get(job.project_id);
      const resolvedIds = inputJobNames
        .map(name => jobMap.get(name))
        .filter(Boolean);

      if (resolvedIds.length === 0) {
        skipped++;
        continue;
      }

      // Update the job
      await Job.findOneAndUpdate(
        { id: job.id },
        { input_job_ids: resolvedIds, updated_at: new Date() }
      );

      logger.debug(`[${job.job_name}] Set input_job_ids: ${inputJobNames.join(',')} -> ${resolvedIds.join(',')}`);
      updated++;

    } catch (error) {
      logger.error(`Error fixing ${job.job_name}: ${error.message}`);
      errors++;
    }
  }

  logger.info(`\nInput job IDs repair complete:`);
  logger.info(`  Updated: ${updated}`);
  logger.info(`  Skipped: ${skipped}`);
  logger.info(`  Errors: ${errors}`);

  return { updated, skipped, errors };
}

// Run if executed directly
if (require.main === module) {
  const args = process.argv.slice(2);
  const command = args[0] || 'show';

  connectDB()
    .then(async () => {
      switch (command) {
        case 'show':
          await showJobStats();
          break;
        case 'backfill':
          await backfillAllJobs();
          break;
        case 'project':
          if (!args[1]) {
            logger.error('Usage: node backfillJobStats.js project <project_id>');
            process.exit(1);
          }
          await backfillProjectJobs(args[1]);
          break;
        case 'verify':
          await verifyPixelSizes(args[1] || null);
          break;
        case 'fix-tree':
          await fixInputJobIds(args[1] || null);
          break;
        default:
          logger.info('Usage:');
          logger.info('  node backfillJobStats.js show              - Show current stats');
          logger.info('  node backfillJobStats.js backfill          - Backfill all jobs');
          logger.info('  node backfillJobStats.js project <id>      - Backfill specific project');
          logger.info('  node backfillJobStats.js verify [id]       - Verify pixel_size values');
          logger.info('  node backfillJobStats.js fix-tree [id]     - Fix job tree connections');
      }
    })
    .catch(err => {
      logger.error('Error:', err);
    })
    .finally(() => {
      mongoose.disconnect();
      process.exit(0);
    });
}

module.exports = {
  backfillJobStats,
  backfillProjectJobs,
  backfillAllJobs,
  showJobStats,
  verifyPixelSizes,
  fixInputJobIds
};
