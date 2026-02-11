/**
 * Thumbnail Generator Service
 *
 * Generates PNG thumbnails from MRC files after job completion.
 * Runs as post-processing for MotionCorr, CTF, and AutoPick jobs.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../utils/logger');
const { frameToPng } = require('../utils/mrcParser');

// Job types that need thumbnail generation
const THUMBNAIL_JOB_TYPES = ['MotionCorr', 'CtfFind', 'AutoPick'];

/**
 * Generate thumbnails for a completed job
 * @param {Object} job - Job document
 * @returns {Promise<{generated: number, errors: number}>}
 */
const generateThumbnailsForJob = async (job) => {
  const jobType = job.job_type || job.stage_name;

  if (!THUMBNAIL_JOB_TYPES.includes(jobType)) {
    logger.debug(`[Thumbnails] Skipping ${job.id} - type ${jobType} not supported`);
    return { generated: 0, errors: 0 };
  }

  const outputDir = job.output_file_path;
  if (!outputDir || !fs.existsSync(outputDir)) {
    logger.warn(`[Thumbnails] Output directory not found for ${job.id}`);
    return { generated: 0, errors: 0 };
  }

  // Create thumbnails directory
  const thumbnailsDir = path.join(outputDir, 'thumbnails');
  if (!fs.existsSync(thumbnailsDir)) {
    fs.mkdirSync(thumbnailsDir, { recursive: true });
  }

  // Find MRC files
  const mrcPatterns = [
    path.join(outputDir, 'Movies', '*.mrc'),
    path.join(outputDir, 'Micrographs', '*.mrc'),
    path.join(outputDir, '*.mrc')
  ];

  let mrcFiles = [];
  for (const pattern of mrcPatterns) {
    const matches = glob.sync(pattern);
    mrcFiles = mrcFiles.concat(matches);
  }

  // Remove duplicates
  mrcFiles = [...new Set(mrcFiles)];

  if (mrcFiles.length === 0) {
    logger.debug(`[Thumbnails] No MRC files found in ${outputDir}`);
    return { generated: 0, errors: 0 };
  }

  logger.info(`[Thumbnails] Generating ${mrcFiles.length} thumbnails for ${job.id}`);

  let generated = 0;
  let errors = 0;

  // Generate MRC thumbnails
  for (const mrcPath of mrcFiles) {
    const baseName = path.basename(mrcPath, '.mrc');
    const thumbnailPath = path.join(thumbnailsDir, `${baseName}.png`);

    // Skip if thumbnail already exists
    if (fs.existsSync(thumbnailPath)) {
      generated++;
      continue;
    }

    try {
      const pngBuffer = await frameToPng(mrcPath, 0, 512);
      if (pngBuffer) {
        fs.writeFileSync(thumbnailPath, pngBuffer);
        generated++;
      } else {
        errors++;
        logger.warn(`[Thumbnails] Failed to convert ${baseName}.mrc`);
      }
    } catch (error) {
      errors++;
      logger.warn(`[Thumbnails] Error converting ${baseName}.mrc: ${error.message}`);
    }
  }

  // For CTF jobs, also generate power spectrum thumbnails from .ctf files
  if (jobType === 'CtfFind') {
    const ctfPatterns = [
      path.join(outputDir, 'Movies', '*.ctf'),
      path.join(outputDir, 'Micrographs', '*.ctf'),
      path.join(outputDir, '*.ctf'),
      // RELION stores CTF files in nested MotionCorr directories
      path.join(outputDir, 'MotionCorr', '*', 'Movies', '*.ctf'),
      path.join(outputDir, 'MotionCorr', '*', 'Micrographs', '*.ctf'),
      path.join(outputDir, '**', '*.ctf')  // Recursive fallback
    ];

    let ctfFiles = [];
    for (const pattern of ctfPatterns) {
      const matches = glob.sync(pattern);
      ctfFiles = ctfFiles.concat(matches);
    }
    ctfFiles = [...new Set(ctfFiles)];

    if (ctfFiles.length > 0) {
      logger.info(`[Thumbnails] Generating ${ctfFiles.length} power spectrum thumbnails for ${job.id}`);

      for (const ctfPath of ctfFiles) {
        const baseName = path.basename(ctfPath, '.ctf');
        const thumbnailPath = path.join(thumbnailsDir, `${baseName}_PS.png`);

        // Skip if thumbnail already exists
        if (fs.existsSync(thumbnailPath)) {
          generated++;
          continue;
        }

        try {
          // .ctf files are MRC format, so we can use the same conversion
          const pngBuffer = await frameToPng(ctfPath, 0, 512);
          if (pngBuffer) {
            fs.writeFileSync(thumbnailPath, pngBuffer);
            generated++;
            logger.debug(`[Thumbnails] Generated power spectrum: ${baseName}_PS.png`);
          } else {
            errors++;
            logger.warn(`[Thumbnails] Failed to convert ${baseName}.ctf`);
          }
        } catch (error) {
          errors++;
          logger.warn(`[Thumbnails] Error converting ${baseName}.ctf: ${error.message}`);
        }
      }
    }
  }

  logger.info(`[Thumbnails] ${job.id}: generated ${generated}, errors ${errors}`);
  return { generated, errors };
};

/**
 * Handle job status change event
 * @param {Object} event - Status change event from SlurmMonitor
 */
const onJobStatusChange = async (event) => {
  const { jobId, newStatus } = event;

  // Only generate thumbnails on successful completion
  if (newStatus !== 'success') {
    return;
  }

  try {
    // Get job details from database
    const Job = require('../models/Job');
    const job = await Job.findOne({ id: jobId });

    if (!job) {
      logger.warn(`[Thumbnails] Job ${jobId} not found`);
      return;
    }

    // Generate thumbnails in background (don't block)
    setImmediate(async () => {
      try {
        await generateThumbnailsForJob(job);
      } catch (error) {
        logger.error(`[Thumbnails] Failed for ${jobId}: ${error.message}`);
      }
    });
  } catch (error) {
    logger.error(`[Thumbnails] Error handling status change: ${error.message}`);
  }
};

module.exports = {
  generateThumbnailsForJob,
  onJobStatusChange,
  THUMBNAIL_JOB_TYPES
};
