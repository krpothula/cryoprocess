/**
 * Dashboard Controller
 *
 * Provides dashboard data for all job types by parsing output STAR files.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../utils/logger');
const Job = require('../models/Job');
const { parseStarFile } = require('../utils/starParser');
const { getProjectPath } = require('../utils/pathUtils');
const { frameToPng } = require('../utils/mrcParser');
const { JOB_STATUS } = require('../config/constants');

/**
 * Get job and validate access
 * Supports lookup by: MongoDB id, job_name, or _id
 */
const getJobWithAccess = async (jobId, userId) => {
  // Try multiple lookup strategies
  let job = await Job.findOne({ id: jobId });

  if (!job) {
    // Try by job_name (e.g., "Job007")
    job = await Job.findOne({ job_name: jobId });
  }

  if (!job) {
    // Try by MongoDB _id
    job = await Job.findById(jobId).catch(() => null);
  }

  if (!job) {
    return { error: 'Job not found', status: 404 };
  }
  return { job };
};

/**
 * Parse STAR file with caching
 * Skips MongoDB caching for large files (>10MB) to avoid BSON size limits
 */
const STAR_CACHE_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const parseStarWithCache = async (job, starPath) => {
  const stat = fs.statSync(starPath);

  // Check if we have cached data
  if (job.star_cache && job.star_cache.path === starPath) {
    if (job.star_cache.mtime === stat.mtime.toISOString()) {
      return job.star_cache.data;
    }
  }

  // Parse the file
  const data = await parseStarFile(starPath);

  // Only cache in MongoDB if file is small enough to avoid BSON size limits
  if (stat.size <= STAR_CACHE_MAX_FILE_SIZE) {
    try {
      await Job.findOneAndUpdate(
        { id: job.id },
        {
          star_cache: {
            path: starPath,
            mtime: stat.mtime.toISOString(),
            data
          }
        }
      );
    } catch (cacheErr) {
      logger.warn(`[Dashboard] Star cache skipped for ${job.job_name}: ${cacheErr.message}`);
    }
  }

  return data;
};

/**
 * Motion correction results (legacy endpoint using query params)
 * GET /motion/results/?job_id=xxx&offset=0&limit=50
 */
exports.getMotionResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const offset = parseInt(req.query.offset) || 0;
    const limit = parseInt(req.query.limit) || 50;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'corrected_micrographs.star');

    // Build command from parameters if not stored
    let command = job.command;
    if (!command && job.parameters && job.job_type === 'MotionCorr') {
      const params = job.parameters;
      const inputFile = params.inputMovies || params.inputStarFile || params.input_star_file || '';
      const cmdParts = [
        'relion_run_motioncorr',
        '--i', inputFile,
        '--o', `${job.job_name}/`,
        '--first_frame_sum', String(params.firstFrame || 1),
        '--last_frame_sum', String(params.lastFrame || -1),
        '--use_own',
        '--j', String(params.threads || 1)
      ];
      if (params.dosePerFrame && parseFloat(params.dosePerFrame) > 0) {
        cmdParts.push('--dose_per_frame', String(params.dosePerFrame));
        cmdParts.push('--preexposure', String(params.preExposure || 0));
      }
      cmdParts.push('--patch_x', String(params.patchesX || 1));
      cmdParts.push('--patch_y', String(params.patchesY || 1));
      if (params.binningFactor && parseInt(params.binningFactor) > 1) {
        cmdParts.push('--bin_factor', String(params.binningFactor));
      }
      cmdParts.push('--bfactor', String(params.bfactor || 150));
      if (params.gainReferenceImage) {
        cmdParts.push('--gainref', params.gainReferenceImage);
      }
      command = cmdParts.join(' ');
    }

    // Base response with command
    const overview = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      job_dir: outputDir,
      command: command,
      total_micrographs: 0,
      pixel_size: null,
      summary_stats: {
        total_motion: {},
        early_motion: {},
        late_motion: {},
        processed: 0,
        total: 0
      },
      pagination: { offset, limit, total: 0, has_more: false },
      micrographs: []
    };

    // Get pixel size from pipeline_stats or parameters
    if (job.pipeline_stats?.pixel_size) {
      overview.pixel_size = job.pipeline_stats.pixel_size;
    } else if (job.pixel_size) {
      overview.pixel_size = job.pixel_size;
    } else if (job.parameters?.angpix) {
      const binFactor = parseInt(job.parameters?.binningFactor) || 1;
      overview.pixel_size = parseFloat(job.parameters.angpix) * binFactor;
    }

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: overview });
    }

    const starData = await parseStarWithCache(job, starPath);
    const allMicrographs = starData.files || starData.files || starData.micrographs || starData.data_micrographs || [];
    const totalCount = allMicrographs.length;

    // Calculate stats
    if (allMicrographs.length > 0) {
      const totalMotions = allMicrographs.map(m => parseFloat(m.rlnAccumMotionTotal) || 0);
      const earlyMotions = allMicrographs.map(m => parseFloat(m.rlnAccumMotionEarly) || 0);
      const lateMotions = allMicrographs.map(m => parseFloat(m.rlnAccumMotionLate) || 0);

      overview.summary_stats = {
        total_motion: {
          min: Math.min(...totalMotions),
          max: Math.max(...totalMotions),
          mean: totalMotions.reduce((a, b) => a + b, 0) / totalMotions.length
        },
        early_motion: {
          min: Math.min(...earlyMotions),
          max: Math.max(...earlyMotions),
          mean: earlyMotions.reduce((a, b) => a + b, 0) / earlyMotions.length
        },
        late_motion: {
          min: Math.min(...lateMotions),
          max: Math.max(...lateMotions),
          mean: lateMotions.reduce((a, b) => a + b, 0) / lateMotions.length
        },
        processed: totalCount,
        total: totalCount
      };
    }

    // Paginate micrographs
    const paginatedMicrographs = allMicrographs.slice(offset, offset + limit);
    overview.total_micrographs = totalCount;
    overview.pagination = {
      offset,
      limit,
      total: totalCount,
      has_more: offset + limit < totalCount
    };
    overview.micrographs = paginatedMicrographs.map(m => ({
      micrograph_name: m.rlnMicrographName || m.micrograph_name || '',
      total_motion: parseFloat(m.rlnAccumMotionTotal) || 0,
      early_motion: parseFloat(m.rlnAccumMotionEarly) || 0,
      late_motion: parseFloat(m.rlnAccumMotionLate) || 0
    }));

    res.json({ success: true,
      status: 'success', data: overview });
  } catch (error) {
    logger.error(`[Dashboard] Motion results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get motion results' });
  }
};

/**
 * Motion live stats (legacy endpoint using query params)
 * GET /motion/live-stats/?job_id=xxx
 */
exports.getMotionLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'corrected_micrographs.star');

    const stats = {
      id: job.id,
      job_status: job.status,
      processed: 0,
      total: 0,
      progress_percent: 0,
      latest_micrographs: [],
      motion_stats: {
        total: { min: 0, max: 0, mean: 0, latest: 0 },
        early: { min: 0, max: 0, mean: 0, latest: 0 },
        late: { min: 0, max: 0, mean: 0, latest: 0 }
      },
      motion_timeline: []
    };

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: stats });
    }

    const starData = await parseStarWithCache(job, starPath);
    const micrographs = starData.files || starData.files || starData.micrographs || starData.data_micrographs || [];

    stats.processed = micrographs.length;
    stats.total = micrographs.length;
    stats.progress_percent = 100;

    // Update pipeline_stats.micrograph_count in DB so stats cards stay current
    if (micrographs.length > 0 && micrographs.length !== (job.pipeline_stats?.micrograph_count || 0)) {
      Job.updateOne({ id: job.id }, { 'pipeline_stats.micrograph_count': micrographs.length }).catch(() => {});
    }

    if (micrographs.length > 0) {
      // Get latest micrographs
      stats.latest_micrographs = micrographs.slice(-5).map(m => ({
        name: path.basename(m.rlnMicrographName || m.micrograph_name || ''),
        total_motion: parseFloat(m.rlnAccumMotionTotal) || 0,
        early_motion: parseFloat(m.rlnAccumMotionEarly) || 0,
        late_motion: parseFloat(m.rlnAccumMotionLate) || 0
      }));

      // Calculate motion stats
      const totalMotions = micrographs.map(m => parseFloat(m.rlnAccumMotionTotal) || 0);
      const earlyMotions = micrographs.map(m => parseFloat(m.rlnAccumMotionEarly) || 0);
      const lateMotions = micrographs.map(m => parseFloat(m.rlnAccumMotionLate) || 0);

      stats.motion_stats = {
        total: {
          min: Math.min(...totalMotions),
          max: Math.max(...totalMotions),
          mean: totalMotions.reduce((a, b) => a + b, 0) / totalMotions.length,
          latest: totalMotions[totalMotions.length - 1] || 0
        },
        early: {
          min: Math.min(...earlyMotions),
          max: Math.max(...earlyMotions),
          mean: earlyMotions.reduce((a, b) => a + b, 0) / earlyMotions.length,
          latest: earlyMotions[earlyMotions.length - 1] || 0
        },
        late: {
          min: Math.min(...lateMotions),
          max: Math.max(...lateMotions),
          mean: lateMotions.reduce((a, b) => a + b, 0) / lateMotions.length,
          latest: lateMotions[lateMotions.length - 1] || 0
        }
      };

      // Motion timeline (last 20)
      stats.motion_timeline = micrographs.slice(-20).map((m, i) => ({
        index: Math.max(0, micrographs.length - 20) + i,
        total: parseFloat(m.rlnAccumMotionTotal) || 0,
        early: parseFloat(m.rlnAccumMotionEarly) || 0,
        late: parseFloat(m.rlnAccumMotionLate) || 0
      }));
    }

    res.json({ success: true,
      status: 'success', data: stats });
  } catch (error) {
    logger.error(`[Dashboard] Motion live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get live stats' });
  }
};

/**
 * Micrograph shifts (legacy endpoint using query params)
 * GET /motion/shifts/?job_id=xxx&micrograph=xxx
 */
exports.getMicrographShifts = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph;

    if (!jobId || !micrograph) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const moviesDir = path.join(outputDir, 'Movies');

    // Look for shift STAR file
    const patterns = [
      path.join(moviesDir, `${micrograph}.star`),
      path.join(moviesDir, `${micrograph}_frameImage.star`),
      path.join(outputDir, `${micrograph}.star`)
    ];

    let starFile = null;
    for (const p of patterns) {
      if (fs.existsSync(p)) {
        starFile = p;
        break;
      }
    }

    // Fallback: glob search
    if (!starFile && fs.existsSync(moviesDir)) {
      const files = fs.readdirSync(moviesDir);
      const match = files.find(f => f.includes(micrograph) && f.endsWith('.star'));
      if (match) {
        starFile = path.join(moviesDir, match);
      }
    }

    if (!starFile) {
      return res.status(404).json({ status: 'error', message: 'Shift data not found' });
    }

    const starData = await parseStarFile(starFile);

    // Get shift data from the global_shift block - starData has { columns, rows } structure
    const shiftBlock = starData.global_shift || {};
    const shiftRows = shiftBlock.rows || [];

    // Get general metadata from the general block
    const generalBlock = starData.general || {};
    const generalRows = generalBlock.rows || [];
    const general = generalRows[0] || {};

    logger.info(`[Dashboard] Parsing shifts for ${micrograph}: found ${shiftRows.length} shift rows`);

    // Format shifts data as array of frame objects (matching Python's MicrographShifts.to_dict format)
    // Frontend expects: { frames: [{ frame, shift_x, shift_y }, ...] }
    const frames = shiftRows.map((s, i) => ({
      frame: parseInt(s.rlnMicrographFrameNumber) || i + 1,
      shift_x: parseFloat(s.rlnMicrographShiftX) || parseFloat(s.rlnShiftX) || 0,
      shift_y: parseFloat(s.rlnMicrographShiftY) || parseFloat(s.rlnShiftY) || 0
    }));

    // Include metadata like Python does
    const formattedShifts = {
      micrograph_name: path.basename(starFile).replace('.star', ''),
      image_size_x: parseInt(general.rlnImageSizeX) || 0,
      image_size_y: parseInt(general.rlnImageSizeY) || 0,
      num_frames: parseInt(general.rlnImageSizeZ) || frames.length,
      pixel_size: parseFloat(general.rlnMicrographPixelSize || general.rlnMicrographOriginalPixelSize) || 0,
      voltage: parseFloat(general.rlnVoltage) || 300,
      dose_per_frame: parseFloat(general.rlnMicrographDoseRate) || 0,
      frames: frames
    };

    res.json({
      success: true,
      status: 'success',
      data: { shifts: formattedShifts, processing: {} }
    });
  } catch (error) {
    logger.error(`[Dashboard] Micrograph shifts error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get shift data' });
  }
};

/**
 * Micrograph image (legacy endpoint using query params)
 * GET /motion/image/?job_id=xxx&micrograph=xxx&type=micrograph|power_spectrum
 */
exports.getMicrographImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph;
    const imageType = req.query.type || 'micrograph';

    if (!jobId || !micrograph) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const moviesDir = path.join(outputDir, 'Movies');
    const thumbnailsDir = path.join(outputDir, 'thumbnails');
    const hiddenThumbnailsDir = path.join(outputDir, '.thumbnails');

    // Extract base name (handle both with and without extension)
    const baseName = path.basename(micrograph).replace(/\.[^.]+$/, '');

    logger.info(`[Dashboard] Looking for image: micrograph=${micrograph}, baseName=${baseName}, type=${imageType}`);

    // Check for pre-generated thumbnails first (match Python behavior)
    const thumbnailPatterns = imageType === 'power_spectrum'
      ? [
          // Power spectrum thumbnails
          path.join(hiddenThumbnailsDir, `${baseName}_PS.png`),
          path.join(thumbnailsDir, `${baseName}_PS.png`),
          path.join(thumbnailsDir, `${baseName}_ps.png`),
          path.join(moviesDir, `${baseName}_PS.png`),
          // JPG variants
          path.join(hiddenThumbnailsDir, `${baseName}_PS.jpg`),
          path.join(moviesDir, `${baseName}_PS.jpg`)
        ]
      : [
          // Micrograph thumbnails
          path.join(hiddenThumbnailsDir, `${baseName}.png`),
          path.join(thumbnailsDir, `${baseName}.png`),
          path.join(moviesDir, `${baseName}.png`),
          // JPG variants
          path.join(hiddenThumbnailsDir, `${baseName}.jpg`),
          path.join(moviesDir, `${baseName}.jpg`)
        ];

    for (const thumbPath of thumbnailPatterns) {
      if (fs.existsSync(thumbPath)) {
        logger.info(`[Dashboard] Found thumbnail: ${thumbPath}`);
        const imgData = fs.readFileSync(thumbPath);
        const base64 = imgData.toString('base64');
        const ext = path.extname(thumbPath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return res.json({
          success: true,
      status: 'success',
          data: {
            micrograph,
            type: imageType,
            image: `data:${mimeType};base64,${base64}`,
            source: 'thumbnail'
          }
        });
      }
    }

    // No thumbnail found - try to convert MRC file on-the-fly
    // Build search patterns based on image type
    let mrcPatterns;
    if (imageType === 'power_spectrum') {
      mrcPatterns = [
        path.join(moviesDir, `${baseName}_PS.mrc`),
        path.join(outputDir, `${baseName}_PS.mrc`)
      ];
    } else {
      mrcPatterns = [
        path.join(moviesDir, `${baseName}.mrc`),
        path.join(outputDir, `${baseName}.mrc`)
      ];
    }

    // Also try glob-style search if direct paths don't exist
    for (const mrcPath of mrcPatterns) {
      if (fs.existsSync(mrcPath)) {
        try {
          logger.info(`[Dashboard] Converting MRC to PNG: ${mrcPath}`);
          const pngBuffer = await frameToPng(mrcPath, 0, 512);
          if (pngBuffer) {
            const base64 = pngBuffer.toString('base64');
            return res.json({
              success: true,
      status: 'success',
              data: {
                micrograph,
                type: imageType,
                image: `data:image/png;base64,${base64}`,
                source: 'mrc_converted'
              }
            });
          }
        } catch (convErr) {
          logger.warn(`[Dashboard] MRC conversion failed for ${mrcPath}: ${convErr.message}`);
        }
      }
    }

    // Fallback: Search for matching files in directories
    const searchDirs = [moviesDir, outputDir];
    for (const searchDir of searchDirs) {
      if (!fs.existsSync(searchDir)) continue;

      const files = fs.readdirSync(searchDir);
      const suffix = imageType === 'power_spectrum' ? '_PS.mrc' : '.mrc';
      const match = files.find(f => f.includes(baseName) && f.endsWith(suffix) &&
        (imageType !== 'power_spectrum' || f.includes('_PS')));

      if (match) {
        const mrcPath = path.join(searchDir, match);
        try {
          logger.info(`[Dashboard] Found MRC via search: ${mrcPath}`);
          const pngBuffer = await frameToPng(mrcPath, 0, 512);
          if (pngBuffer) {
            const base64 = pngBuffer.toString('base64');
            return res.json({
              success: true,
      status: 'success',
              data: {
                micrograph,
                type: imageType,
                image: `data:image/png;base64,${base64}`,
                source: 'mrc_converted'
              }
            });
          }
        } catch (convErr) {
          logger.warn(`[Dashboard] MRC conversion failed for ${mrcPath}: ${convErr.message}`);
        }
      }
    }

    logger.warn(`[Dashboard] No image found for micrograph: ${micrograph}`);
    return res.status(404).json({
      status: 'error',
      message: 'No thumbnail or MRC file found for this micrograph.'
    });
  } catch (error) {
    logger.error(`[Dashboard] Micrograph image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get image' });
  }
};

/**
 * Motion correction dashboard
 */
exports.getMotionDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Look for corrected_micrographs.star
    const starPath = path.join(outputDir, 'corrected_micrographs.star');

    if (!fs.existsSync(starPath)) {
      return res.json({
        success: true,
      status: 'success',
        data: {
          job: { id: job.id, name: job.job_name, status: job.status },
          micrographs: [],
          stats: { total: 0, processed: 0 }
        }
      });
    }

    const starData = await parseStarWithCache(job, starPath);
    const micrographs = starData.files || starData.files || starData.micrographs || starData.data_micrographs || [];

    // Calculate stats
    const stats = {
      total: micrographs.length,
      processed: micrographs.length,
      avgMotion: 0
    };

    if (micrographs.length > 0) {
      const totalMotion = micrographs.reduce((sum, m) => {
        return sum + (parseFloat(m.rlnAccumMotionTotal) || 0);
      }, 0);
      stats.avgMotion = totalMotion / micrographs.length;
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats,
        micrographCount: micrographs.length
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Motion error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get motion dashboard' });
  }
};

/**
 * Motion micrographs list
 */
exports.getMotionMicrographs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const starPath = path.join(job.output_file_path, 'corrected_micrographs.star');

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: [], total: 0 });
    }

    const starData = await parseStarWithCache(job, starPath);
    const allMicrographs = starData.files || starData.files || starData.micrographs || starData.data_micrographs || [];

    // Paginate
    const start = parseInt(offset);
    const end = start + parseInt(limit);
    const micrographs = allMicrographs.slice(start, end).map(m => ({
      name: path.basename(m.rlnMicrographName || m.micrograph_name || ''),
      path: m.rlnMicrographName || m.micrograph_name,
      motionTotal: parseFloat(m.rlnAccumMotionTotal) || 0,
      motionEarly: parseFloat(m.rlnAccumMotionEarly) || 0,
      motionLate: parseFloat(m.rlnAccumMotionLate) || 0
    }));

    res.json({
      success: true,
      status: 'success',
      data: micrographs,
      total: allMicrographs.length
    });
  } catch (error) {
    logger.error(`[Dashboard] Motion micrographs error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get micrographs' });
  }
};

/**
 * CTF estimation dashboard
 */
exports.getCtfDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const starPath = path.join(job.output_file_path, 'micrographs_ctf.star');

    if (!fs.existsSync(starPath)) {
      return res.json({
        success: true,
      status: 'success',
        data: {
          job: { id: job.id, name: job.job_name, status: job.status },
          micrographs: [],
          stats: { total: 0, processed: 0 }
        }
      });
    }

    const starData = await parseStarWithCache(job, starPath);
    const micrographs = starData.files || starData.micrographs || starData.data_micrographs || [];

    // Calculate CTF stats
    const stats = {
      total: micrographs.length,
      processed: micrographs.length,
      avgDefocus: 0,
      avgMaxRes: 0
    };

    if (micrographs.length > 0) {
      let totalDefocus = 0;
      let totalMaxRes = 0;

      for (const m of micrographs) {
        const defocusU = parseFloat(m.rlnDefocusU) || 0;
        const defocusV = parseFloat(m.rlnDefocusV) || 0;
        totalDefocus += (defocusU + defocusV) / 2;
        totalMaxRes += parseFloat(m.rlnCtfMaxResolution) || 0;
      }

      stats.avgDefocus = totalDefocus / micrographs.length;
      stats.avgMaxRes = totalMaxRes / micrographs.length;
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats,
        micrographCount: micrographs.length
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get CTF dashboard' });
  }
};

/**
 * CTF micrographs list
 */
exports.getCtfMicrographs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const starPath = path.join(job.output_file_path, 'micrographs_ctf.star');

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: [], total: 0 });
    }

    const starData = await parseStarWithCache(job, starPath);
    const allMicrographs = starData.files || starData.micrographs || starData.data_micrographs || [];

    const start = parseInt(offset);
    const end = start + parseInt(limit);
    const micrographs = allMicrographs.slice(start, end).map(m => ({
      name: path.basename(m.rlnMicrographName || ''),
      path: m.rlnMicrographName,
      defocusU: parseFloat(m.rlnDefocusU) || 0,
      defocusV: parseFloat(m.rlnDefocusV) || 0,
      defocusAngle: parseFloat(m.rlnDefocusAngle) || 0,
      ctfMaxRes: parseFloat(m.rlnCtfMaxResolution) || 0,
      ctfFigureOfMerit: parseFloat(m.rlnCtfFigureOfMerit) || 0,
      powerSpectrum: m.rlnCtfImage || null
    }));

    res.json({
      success: true,
      status: 'success',
      data: micrographs,
      total: allMicrographs.length
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF micrographs error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get micrographs' });
  }
};

/**
 * Auto-picking dashboard
 */
exports.getAutopickDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Count coordinate files
    const coordFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('_autopick.star'))
      : [];

    // Get total particle count
    let totalParticles = 0;
    for (const coordFile of coordFiles.slice(0, 100)) { // Sample first 100
      try {
        const starData = await parseStarFile(path.join(outputDir, coordFile));
        const coords = starData.data_ || starData.coordinates || [];
        totalParticles += coords.length;
      } catch (e) {
        // Skip problematic files
      }
    }

    const avgPerMic = coordFiles.length > 0 ? totalParticles / Math.min(coordFiles.length, 100) : 0;

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats: {
          micrographs: coordFiles.length,
          estimatedParticles: Math.round(avgPerMic * coordFiles.length),
          avgPerMicrograph: Math.round(avgPerMic)
        }
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Autopick error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get autopick dashboard' });
  }
};

/**
 * Auto-picking micrographs
 */
exports.getAutopickMicrographs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { offset = 0, limit = 50 } = req.query;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const coordFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('_autopick.star')).sort()
      : [];

    const start = parseInt(offset);
    const end = start + parseInt(limit);
    const selectedFiles = coordFiles.slice(start, end);

    const micrographs = [];
    for (const coordFile of selectedFiles) {
      try {
        const starData = await parseStarFile(path.join(outputDir, coordFile));
        const coords = starData.data_ || starData.coordinates || [];
        micrographs.push({
          name: coordFile.replace('_autopick.star', ''),
          coordFile,
          particleCount: coords.length
        });
      } catch (e) {
        micrographs.push({
          name: coordFile.replace('_autopick.star', ''),
          coordFile,
          particleCount: 0
        });
      }
    }

    res.json({
      success: true,
      status: 'success',
      data: micrographs,
      total: coordFiles.length
    });
  } catch (error) {
    logger.error(`[Dashboard] Autopick micrographs error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get micrographs' });
  }
};

/**
 * Particle extraction dashboard
 * Uses pre-computed pipeline_stats stored at job completion for fast lookups
 */
exports.getExtractDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const ps = job.pipeline_stats || {};
    const totalParticles = ps.particle_count || job.particle_count || 0;
    const micrographs = ps.micrograph_count || job.micrograph_count || 0;

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats: {
          totalParticles,
          micrographs,
          avgPerMicrograph: micrographs > 0 ? Math.round(totalParticles / micrographs) : 0
        }
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Extract error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get extract dashboard' });
  }
};

/**
 * 2D Classification dashboard
 */
exports.getClass2dDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find the latest iteration model file
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/run_it\d+_model\.star$/)).sort()
      : [];

    const latestModel = modelFiles.length > 0 ? modelFiles[modelFiles.length - 1] : null;

    if (!latestModel) {
      return res.json({
        success: true,
      status: 'success',
        data: {
          job: { id: job.id, name: job.job_name, status: job.status },
          stats: { classes: 0, iteration: 0, totalParticles: 0 }
        }
      });
    }

    // Extract iteration number
    const iterMatch = latestModel.match(/run_it(\d+)_model\.star/);
    const iteration = iterMatch ? parseInt(iterMatch[1]) : 0;

    const starData = await parseStarFile(path.join(outputDir, latestModel));
    // STAR file structure: { model_classes: { columns: [...], rows: [...] } }
    const classesBlock = starData.model_classes || starData.data_model_classes || {};
    const classes = classesBlock.rows || (Array.isArray(classesBlock) ? classesBlock : []);

    let totalParticles = 0;
    for (const c of classes) {
      totalParticles += parseInt(c.rlnClassDistribution * 1000) || 0;
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats: {
          classes: classes.length,
          iteration,
          totalParticles,
          modelFile: latestModel
        }
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Class2D error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Class2D dashboard' });
  }
};

/**
 * 2D Classification classes
 */
exports.getClass2dClasses = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { iteration } = req.query;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find model file for specified iteration or latest
    let modelFile;
    if (iteration) {
      modelFile = `run_it${String(iteration).padStart(3, '0')}_model.star`;
    } else {
      const modelFiles = fs.existsSync(outputDir)
        ? fs.readdirSync(outputDir).filter(f => f.match(/run_it\d+_model\.star$/)).sort()
        : [];
      modelFile = modelFiles.length > 0 ? modelFiles[modelFiles.length - 1] : null;
    }

    if (!modelFile || !fs.existsSync(path.join(outputDir, modelFile))) {
      return res.json({ success: true,
      status: 'success', data: [], total: 0 });
    }

    const starData = await parseStarFile(path.join(outputDir, modelFile));
    // STAR file structure: { model_classes: { columns: [...], rows: [...] } }
    const classesBlock = starData.model_classes || starData.data_model_classes || {};
    const classesRows = classesBlock.rows || (Array.isArray(classesBlock) ? classesBlock : []);
    const classes = classesRows.map((c, i) => ({
      classNumber: i + 1,
      distribution: parseFloat(c.rlnClassDistribution) || 0,
      resolution: parseFloat(c.rlnEstimatedResolution) || 0,
      referenceImage: c.rlnReferenceImage || null,
      accuracy: parseFloat(c.rlnAccuracyRotations) || 0
    }));

    // Sort by distribution (most particles first)
    classes.sort((a, b) => b.distribution - a.distribution);

    res.json({
      success: true,
      status: 'success',
      data: classes,
      total: classes.length
    });
  } catch (error) {
    logger.error(`[Dashboard] Class2D classes error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get classes' });
  }
};

/**
 * Import dashboard
 */
exports.getImportDashboard = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const starPath = path.join(job.output_file_path, 'movies.star');

    if (!fs.existsSync(starPath)) {
      return res.json({
        success: true,
      status: 'success',
        data: {
          job: { id: job.id, name: job.job_name, status: job.status },
          stats: { movies: 0, importType: (job.parameters?.rawMovies === 'Yes' ? 'movies' : 'micrographs') }
        }
      });
    }

    const starData = await parseStarWithCache(job, starPath);
    const movies = starData.movies || starData.data_movies || [];

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status },
        stats: {
          movies: movies.length,
          importType: job.parameters?.rawMovies === 'Yes' ? 'movies' : 'micrographs',
          pixelSize: job.pipeline_stats?.pixel_size || job.parameters?.angpix || null,
          voltage: job.parameters?.kV || null
        }
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Import error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get import dashboard' });
  }
};

/**
 * Generic job output
 */
exports.getJobOutput = async (req, res) => {
  try {
    const { jobId } = req.params;
    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // List output files
    const files = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).map(f => ({
          name: f,
          path: path.join(outputDir, f),
          size: fs.statSync(path.join(outputDir, f)).size,
          isDirectory: fs.statSync(path.join(outputDir, f)).isDirectory()
        }))
      : [];

    res.json({
      success: true,
      status: 'success',
      data: {
        job: { id: job.id, name: job.job_name, status: job.status, type: job.job_type },
        outputDir,
        files: files.filter(f => !f.isDirectory)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Output error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get job output' });
  }
};

/**
 * Get job logs
 */
exports.getJobLogs = async (req, res) => {
  try {
    const { jobId } = req.params;
    const { lines = 100 } = req.query;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const logs = { stdout: '', stderr: '' };

    // Handle link_movies and other direct-execution jobs (no SLURM log files)
    if (job.job_type === 'link_movies' || job.job_type === 'linkmovies') {
      const statusLine = job.status === 'success'
        ? 'Link Movies completed successfully.'
        : `Link Movies ${job.status || 'unknown'}.`;
      logs.stdout = [
        '='.repeat(60),
        `Job: ${job.job_name || jobId}`,
        `Type: Link Movies`,
        `Status: ${(job.status || 'unknown').toUpperCase()}`,
        `Started: ${job.start_time ? new Date(job.start_time).toLocaleString() : 'N/A'}`,
        `Completed: ${job.end_time ? new Date(job.end_time).toLocaleString() : 'N/A'}`,
        '='.repeat(60),
        '',
        statusLine,
        job.error_message ? `Error: ${job.error_message}` : ''
      ].filter(Boolean).join('\n');

      return res.json({ success: true,
      status: 'success', data: logs });
    }

    // Standard jobs with log files
    const outPath = path.join(outputDir, 'run.out');
    const errPath = path.join(outputDir, 'run.err');

    if (fs.existsSync(outPath)) {
      const content = fs.readFileSync(outPath, 'utf8');
      const allLines = content.split('\n');
      logs.stdout = allLines.slice(-parseInt(lines)).join('\n');
    }

    if (fs.existsSync(errPath)) {
      const content = fs.readFileSync(errPath, 'utf8');
      const allLines = content.split('\n');
      logs.stderr = allLines.slice(-parseInt(lines)).join('\n');
    }

    // If no log files found, show job info
    if (!logs.stdout && !logs.stderr) {
      logs.stdout = [
        `Job: ${job.job_name || jobId}`,
        `Status: ${(job.status || 'unknown').toUpperCase()}`,
        `Type: ${job.job_type || 'unknown'}`,
        '',
        'No log files available yet.'
      ].join('\n');
    }

    res.json({
      success: true,
      status: 'success',
      data: logs
    });
  } catch (error) {
    logger.error(`[Dashboard] Logs error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get logs' });
  }
};

/**
 * Get cached thumbnail
 * GET /api/dashboard/thumbnail/:jobId/:filename
 */
exports.getCachedThumbnail = async (req, res) => {
  try {
    const { jobId, filename } = req.params;
    logger.info(`[Dashboard] Thumbnail requested: job=${jobId}, file=${filename}`);

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      logger.warn(`[Dashboard] Thumbnail job not found: ${jobId}`);
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const thumbnailsDir = path.join(job.output_file_path, 'thumbnails');
    const thumbnailPath = path.join(thumbnailsDir, filename);

    if (!fs.existsSync(thumbnailPath)) {
      logger.warn(`[Dashboard] Thumbnail not found: ${thumbnailPath}`);
      return res.status(404).json({ status: 'error', message: 'Thumbnail not found' });
    }

    logger.info(`[Dashboard] Serving thumbnail: ${thumbnailPath}`);
    res.sendFile(thumbnailPath);
  } catch (error) {
    logger.error(`[Dashboard] Thumbnail error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get thumbnail' });
  }
};

/**
 * List cached thumbnails for a job
 * GET /api/dashboard/thumbnails/:jobId
 */
exports.listCachedThumbnails = async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const thumbnailsDir = path.join(job.output_file_path, 'thumbnails');

    let thumbnails = [];
    if (fs.existsSync(thumbnailsDir)) {
      thumbnails = fs.readdirSync(thumbnailsDir)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg') || f.endsWith('.jpeg'))
        .sort();
    }

    res.json({
      success: true,
      status: 'success',
      thumbnails,
      count: thumbnails.length
    });
  } catch (error) {
    logger.error(`[Dashboard] List thumbnails error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to list thumbnails' });
  }
};

/**
 * Get cached stats for a job
 * GET /api/dashboard/stats/:jobId
 */
exports.getCachedStats = async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const statsPath = path.join(job.output_file_path, 'stats.json');

    if (!fs.existsSync(statsPath)) {
      // Return basic job stats if no cached stats file
      return res.json({
        success: true,
      status: 'success',
        stats: {
          id: job.id,
          job_name: job.job_name,
          job_type: job.job_type,
          status: job.status,
          created_at: job.created_at,
          updated_at: job.updated_at
        }
      });
    }

    const statsContent = fs.readFileSync(statsPath, 'utf8');
    const stats = JSON.parse(statsContent);

    res.json({
      success: true,
      status: 'success',
      stats
    });
  } catch (error) {
    logger.error(`[Dashboard] Stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get stats' });
  }
};

/**
 * Get post-processing status for a job
 * GET /api/dashboard/postprocess-status/:jobId
 */
exports.getPostProcessStatus = async (req, res) => {
  try {
    const { jobId } = req.params;
    logger.info(`[Dashboard] PostProcess status requested for job: ${jobId}`);

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      logger.warn(`[Dashboard] Job not found: ${jobId}`);
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const thumbnailsDir = path.join(job.output_file_path, 'thumbnails');
    const statsPath = path.join(job.output_file_path, 'stats.json');

    let thumbnailCount = 0;
    if (fs.existsSync(thumbnailsDir)) {
      thumbnailCount = fs.readdirSync(thumbnailsDir)
        .filter(f => f.endsWith('.png') || f.endsWith('.jpg')).length;
    }

    const statsAvailable = fs.existsSync(statsPath);
    const complete = job.status === JOB_STATUS.SUCCESS || job.status === JOB_STATUS.COMPLETED;

    logger.info(`[Dashboard] PostProcess status: job=${job.job_name}, thumbnails=${thumbnailCount}, dir=${thumbnailsDir}`);

    res.json({
      success: true,
      status: 'success',
      complete,
      thumbnail_count: thumbnailCount,
      stats_available: statsAvailable,
      job_status: job.status
    });
  } catch (error) {
    logger.error(`[Dashboard] PostProcess status error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get post-process status' });
  }
};

/**
 * CTF results (legacy endpoint using query params)
 * GET /ctf/results/?job_id=xxx&page=1&page_size=100
 */
exports.getCtfResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const page = parseInt(req.query.page) || 1;
    const pageSize = parseInt(req.query.page_size) || 100;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'micrographs_ctf.star');

    // Build command from parameters if not stored
    let command = job.command;
    if (!command && job.parameters && job.job_type === 'CtfFind') {
      const params = job.parameters;
      const inputFile = params.inputMicrographs || params.input_star_mics || '';
      const cmdParts = [
        'relion_run_ctffind',
        '--i', inputFile,
        '--o', `${job.job_name}/`,
        '--CS', String(params.cs || 2.7),
        '--HT', String(params.kV || 300),
        '--AmpCnst', String(params.q0 || 0.1),
        '--ctfWin', String(params.ctfWindowSize || -1)
      ];
      command = cmdParts.join(' ');
    }

    // Base response
    const overview = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: command,
      total_micrographs: 0,
      summary: { processed: 0, total: 0 },
      micrographs: []
    };

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: overview });
    }

    const starData = await parseStarWithCache(job, starPath);
    const allMicrographs = starData.files || starData.micrographs || starData.data_micrographs || [];
    const totalCount = allMicrographs.length;

    // Paginate
    const offset = (page - 1) * pageSize;
    const paginatedMicrographs = allMicrographs.slice(offset, offset + pageSize);

    overview.total_micrographs = totalCount;
    overview.summary = { processed: totalCount, total: totalCount };

    overview.micrographs = paginatedMicrographs.map(m => ({
      micrograph_name: m.rlnMicrographName || '',
      defocus_u: parseFloat(m.rlnDefocusU) || 0,
      defocus_v: parseFloat(m.rlnDefocusV) || 0,
      defocus_angle: parseFloat(m.rlnDefocusAngle) || 0,
      max_resolution: parseFloat(m.rlnCtfMaxResolution) || 0,
      figure_of_merit: parseFloat(m.rlnCtfFigureOfMerit) || 0,
      ctf_image: m.rlnCtfImage || ''
    }));

    res.json({ success: true,
      status: 'success', data: overview });
  } catch (error) {
    logger.error(`[Dashboard] CTF results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get CTF results' });
  }
};

/**
 * CTF live stats (legacy endpoint using query params)
 * GET /ctf/live-stats/?job_id=xxx
 */
exports.getCtfLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'micrographs_ctf.star');

    const stats = {
      id: job.id,
      job_status: job.status,
      processed: 0,
      total: 0,
      progress_percent: 0,
      ctf_stats: {
        defocus: { min: 0, max: 0, mean: 0 },
        max_resolution: { min: 0, max: 0, mean: 0 },
        astigmatism: { min: 0, max: 0, mean: 0 },
        figure_of_merit: { min: 0, max: 0, mean: 0 }
      }
    };

    if (!fs.existsSync(starPath)) {
      return res.json({ success: true,
      status: 'success', data: stats });
    }

    const starData = await parseStarWithCache(job, starPath);
    const micrographs = starData.files || starData.micrographs || starData.data_micrographs || [];

    stats.processed = micrographs.length;
    stats.total = micrographs.length;
    stats.progress_percent = 100;

    if (micrographs.length > 0) {
      const defocusValues = micrographs.map(m => {
        const u = parseFloat(m.rlnDefocusU) || 0;
        const v = parseFloat(m.rlnDefocusV) || 0;
        return (u + v) / 2;
      });
      const resValues = micrographs.map(m => parseFloat(m.rlnCtfMaxResolution) || 0);
      const astigmatismValues = micrographs.map(m => {
        const u = parseFloat(m.rlnDefocusU) || 0;
        const v = parseFloat(m.rlnDefocusV) || 0;
        return Math.abs(u - v);
      });
      const fomValues = micrographs.map(m => parseFloat(m.rlnCtfFigureOfMerit) || 0);

      stats.ctf_stats = {
        defocus: {
          min: Math.min(...defocusValues),
          max: Math.max(...defocusValues),
          mean: defocusValues.reduce((a, b) => a + b, 0) / defocusValues.length
        },
        max_resolution: {
          min: Math.min(...resValues),
          max: Math.max(...resValues),
          mean: resValues.reduce((a, b) => a + b, 0) / resValues.length
        },
        astigmatism: {
          min: Math.min(...astigmatismValues),
          max: Math.max(...astigmatismValues),
          mean: astigmatismValues.reduce((a, b) => a + b, 0) / astigmatismValues.length
        },
        figure_of_merit: {
          min: Math.min(...fomValues),
          max: Math.max(...fomValues),
          mean: fomValues.reduce((a, b) => a + b, 0) / fomValues.length
        }
      };
    }

    res.json({ success: true,
      status: 'success', data: stats });
  } catch (error) {
    logger.error(`[Dashboard] CTF live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get CTF live stats' });
  }
};

/**
 * CTF power spectrum image (legacy endpoint using query params)
 * GET /ctf/image/?job_id=xxx&micrograph=xxx
 */
exports.getCtfImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph;

    if (!jobId || !micrograph) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const thumbnailsDir = path.join(outputDir, 'thumbnails');
    const micrographsDir = path.join(outputDir, 'Micrographs');

    // Extract base name (just the filename, not the path)
    const baseName = path.basename(micrograph).replace(/\.[^.]+$/, '');

    logger.info(`[CTF Image] Looking for power spectrum: baseName=${baseName}, outputDir=${outputDir}`);

    // Check for pre-generated thumbnails (match Python's search order)
    const thumbnailPatterns = [
      // RELION-generated power spectrum thumbnails
      path.join(micrographsDir, `${baseName}_PS.png`),
      path.join(micrographsDir, `${baseName}_PS.jpg`),
      // Cached thumbnails directory
      path.join(thumbnailsDir, `${baseName}_PS.png`),
      path.join(thumbnailsDir, `${baseName}_ctf.png`),
      path.join(outputDir, '.thumbnails', `${baseName}_PS.png`),
      path.join(outputDir, '.thumbnails', `${baseName}_ctf.png`),
    ];

    for (const thumbPath of thumbnailPatterns) {
      if (fs.existsSync(thumbPath)) {
        logger.info(`[CTF Image] Found thumbnail: ${thumbPath}`);
        const imgData = fs.readFileSync(thumbPath);
        const base64 = imgData.toString('base64');
        const ext = path.extname(thumbPath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return res.json({
          success: true,
      status: 'success',
          data: {
            micrograph,
            image: `data:${mimeType};base64,${base64}`,
            source: 'thumbnail',
            cached: true
          }
        });
      }
    }

    // No pre-generated thumbnail found - try on-the-fly conversion from .ctf file
    logger.info(`[CTF Image] No thumbnail found, trying on-the-fly conversion for ${baseName}`);

    // Search for .ctf file in multiple locations
    const glob = require('glob');
    const ctfPatterns = [
      path.join(outputDir, 'Movies', `${baseName}.ctf`),
      path.join(outputDir, 'Micrographs', `${baseName}.ctf`),
      path.join(outputDir, `${baseName}.ctf`),
      path.join(outputDir, 'MotionCorr', '*', 'Movies', `${baseName}.ctf`),
      path.join(outputDir, 'MotionCorr', '*', 'Micrographs', `${baseName}.ctf`),
    ];

    let ctfFile = null;
    for (const pattern of ctfPatterns) {
      const matches = glob.sync(pattern);
      if (matches.length > 0) {
        ctfFile = matches[0];
        break;
      }
    }

    if (ctfFile && fs.existsSync(ctfFile)) {
      logger.info(`[CTF Image] Found CTF file: ${ctfFile}, converting on-the-fly`);
      try {
        const pngBuffer = await frameToPng(ctfFile, 0, 512);
        if (pngBuffer) {
          const base64 = pngBuffer.toString('base64');

          // Optionally cache the thumbnail for future requests
          if (!fs.existsSync(thumbnailsDir)) {
            fs.mkdirSync(thumbnailsDir, { recursive: true });
          }
          const cachePath = path.join(thumbnailsDir, `${baseName}_PS.png`);
          fs.writeFileSync(cachePath, pngBuffer);
          logger.info(`[CTF Image] Cached thumbnail: ${cachePath}`);

          return res.json({
            success: true,
      status: 'success',
            data: {
              micrograph,
              image: `data:image/png;base64,${base64}`,
              source: 'converted',
              cached: false
            }
          });
        }
      } catch (convError) {
        logger.error(`[CTF Image] On-the-fly conversion failed: ${convError.message}`);
      }
    }

    logger.warn(`[CTF Image] No power spectrum found for ${baseName}`);
    return res.status(404).json({
      status: 'error',
      message: 'CTF power spectrum image not found'
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get CTF image' });
  }
};

/**
 * CTF micrograph image (legacy endpoint using query params)
 * GET /ctf/micrograph-image/?job_id=xxx&micrograph=xxx
 *
 * For CTF jobs, the micrograph is from the motion correction job.
 * The micrograph parameter contains the relative path from the project root.
 */
exports.getCtfMicrographImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph;

    if (!jobId || !micrograph) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    // Get the project root (CTF output is at /project_root/CtfFind/JobXXX)
    const projectRoot = path.dirname(path.dirname(outputDir));

    // Extract base name (just the filename, not the path)
    const baseName = path.basename(micrograph).replace(/\.[^.]+$/, '');

    logger.info(`[CTF Micrograph] Looking for micrograph: baseName=${baseName}, projectRoot=${projectRoot}`);

    // For CTF jobs, micrograph is from motion correction
    // micrograph path is like "MotionCorr/Job005/Movies/xxx.mrc"
    // Extract the motion correction job path
    const motionJobMatch = micrograph.match(/(MotionCorr\/Job\d+)/i) || micrograph.match(/(Motion\/Job\d+)/i);
    const motionJobPath = motionJobMatch ? path.join(projectRoot, motionJobMatch[1]) : null;

    // Check for pre-generated thumbnails in multiple locations
    const thumbnailPatterns = [];

    // 1. Check motion correction job's thumbnails directory
    if (motionJobPath) {
      thumbnailPatterns.push(
        path.join(motionJobPath, 'thumbnails', `${baseName}.png`),
        path.join(motionJobPath, '.thumbnails', `${baseName}.png`),
        path.join(motionJobPath, 'Movies', `${baseName}.png`)
      );
    }

    // 2. Check CTF job's thumbnails directory
    thumbnailPatterns.push(
      path.join(outputDir, 'thumbnails', `${baseName}.png`),
      path.join(outputDir, '.thumbnails', `${baseName}.png`)
    );

    // 3. Try to find thumbnail using the full relative path from project root
    const micDir = path.dirname(micrograph);
    if (micDir) {
      thumbnailPatterns.push(
        path.join(projectRoot, micDir, `${baseName}.png`),
        path.join(projectRoot, path.dirname(micDir), 'thumbnails', `${baseName}.png`)
      );
    }

    for (const thumbPath of thumbnailPatterns) {
      if (fs.existsSync(thumbPath)) {
        logger.info(`[CTF Micrograph] Found thumbnail: ${thumbPath}`);
        const imgData = fs.readFileSync(thumbPath);
        const base64 = imgData.toString('base64');
        const ext = path.extname(thumbPath).toLowerCase();
        const mimeType = ext === '.jpg' || ext === '.jpeg' ? 'image/jpeg' : 'image/png';
        return res.json({
          success: true,
      status: 'success',
          data: {
            micrograph,
            image: `data:${mimeType};base64,${base64}`,
            source: 'thumbnail'
          }
        });
      }
    }

    logger.warn(`[CTF Micrograph] No thumbnail found for ${baseName}`);
    return res.status(404).json({
      status: 'error',
      message: 'Micrograph image not found'
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF micrograph image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get micrograph image' });
  }
};

/**
 * Parse full STAR file preserving all columns and raw data for export.
 * Matches Python's parse_full_ctf_star_file behavior.
 */
const parseFullStarFile = (starPath) => {
  if (!fs.existsSync(starPath)) {
    return { opticsBlock: null, columnHeaders: [], dataRows: [], micrographNameCol: null, dataBlockName: 'data_micrographs' };
  }

  try {
    const content = fs.readFileSync(starPath, 'utf8');
    const lines = content.split('\n');

    const opticsBlock = [];
    const columnHeaders = [];
    const dataRows = [];
    let currentBlock = null;
    let micrographNameCol = null;
    let inLoop = false;
    let readingHeaders = false;
    let dataBlockName = 'data_micrographs';

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      const stripped = line.trim();

      if (stripped.startsWith('data_optics')) {
        currentBlock = 'optics';
        opticsBlock.push(line);
      } else if (stripped.startsWith('data_') && currentBlock !== 'optics') {
        // This is the main data block (data_micrographs, data_particles, data_, etc.)
        currentBlock = 'data';
        dataBlockName = stripped;
        inLoop = false;
        readingHeaders = false;
      } else if (stripped.startsWith('data_') && currentBlock === 'optics') {
        // Transitioning from optics to data block
        currentBlock = 'data';
        dataBlockName = stripped;
        inLoop = false;
        readingHeaders = false;
      } else if (currentBlock === 'optics') {
        opticsBlock.push(line);
      } else if (currentBlock === 'data') {
        if (stripped.startsWith('loop_')) {
          inLoop = true;
          readingHeaders = true;
          continue;
        }

        if (readingHeaders && stripped.startsWith('_rln')) {
          columnHeaders.push(line);
          // Parse column header like "_rlnMicrographName #1"
          if (stripped.includes('_rlnMicrographName')) {
            const parts = stripped.split(/\s+/);
            if (parts.length >= 2) {
              micrographNameCol = parseInt(parts[1].replace('#', '')) - 1;
            }
          }
        } else if (inLoop && stripped && !stripped.startsWith('_') && !stripped.startsWith('#')) {
          // First non-header line after column headers = data rows
          readingHeaders = false;
          const values = stripped.split(/\s+/);
          if (values.length > 0) {
            dataRows.push({ originalLine: line, values });
          }
        }
      }
    }

    return { opticsBlock, columnHeaders, dataRows, micrographNameCol, dataBlockName };
  } catch (error) {
    logger.error(`[Dashboard] Error parsing full STAR file: ${error.message}`);
    return { opticsBlock: null, columnHeaders: [], dataRows: [], micrographNameCol: null, dataBlockName: 'data_micrographs' };
  }
};

/**
 * Export CTF selection to STAR file (legacy endpoint)
 * POST /ctf/export-selection/
 *
 * Preserves full STAR format with optics block and all columns (matches Python behavior).
 */
exports.exportCtfSelection = async (req, res) => {
  try {
    const { job_id: jobId, micrograph_names: micrographNames, filename } = req.body;

    logger.info(`[CTF Export] Received export request - job_id: ${jobId}, filename: ${filename}, micrograph_count: ${micrographNames?.length}`);

    if (!jobId || !micrographNames || !Array.isArray(micrographNames)) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph_names are required' });
    }

    if (micrographNames.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No micrographs selected' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      logger.error(`[CTF Export] Job not found or access denied: ${jobId}`);
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    logger.info(`[CTF Export] Output directory: ${outputDir}`);

    const starPath = path.join(outputDir, 'micrographs_ctf.star');

    if (!fs.existsSync(starPath)) {
      return res.status(404).json({ status: 'error', message: 'CTF results not found' });
    }

    // Parse the original file preserving structure
    const { opticsBlock, columnHeaders, dataRows, micrographNameCol, dataBlockName } = parseFullStarFile(starPath);

    if (micrographNameCol === null) {
      return res.status(500).json({ status: 'error', message: 'Could not find micrograph name column' });
    }

    // Convert selected micrographs to a set for fast lookup (handle both full paths and basenames)
    const selectedSet = new Set();
    for (const mic of micrographNames) {
      selectedSet.add(mic);
      selectedSet.add(path.basename(mic));
    }

    // Filter data rows to selected micrographs
    const selectedRows = [];
    for (const row of dataRows) {
      if (row.values.length > micrographNameCol) {
        const micName = row.values[micrographNameCol];
        const micBasename = path.basename(micName);
        if (selectedSet.has(micName) || selectedSet.has(micBasename)) {
          selectedRows.push(row.originalLine);
        }
      }
    }

    if (selectedRows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No matching micrographs found in star file' });
    }

    // Generate unique filename with timestamp
    const timestamp = Math.floor(Date.now() / 1000);
    const baseFilename = path.basename(filename || 'selected_micrographs_ctf.star', '.star');
    const exportFilename = `${baseFilename}_${timestamp}.star`;
    const exportPath = path.join(outputDir, exportFilename);

    // Write the new STAR file (keep same format as original)
    let starContent = '';

    // Write optics block if present (preserves original header format)
    if (opticsBlock && opticsBlock.length > 0) {
      for (const line of opticsBlock) {
        starContent += line + '\n';
      }
      starContent += '\n';
    }

    // Write data block using original block name
    starContent += (dataBlockName || 'data_micrographs') + '\n\n';
    starContent += 'loop_\n';
    for (const header of columnHeaders) {
      starContent += header + '\n';
    }

    // Write selected data rows
    for (const row of selectedRows) {
      starContent += row + '\n';
    }

    fs.writeFileSync(exportPath, starContent);

    // Verify the file was created
    if (fs.existsSync(exportPath)) {
      const fileSize = fs.statSync(exportPath).size;
      logger.info(`[CTF Export] SUCCESS - Saved ${selectedRows.length} micrographs to ${exportPath} (size: ${fileSize} bytes)`);

      // Store filter file details in the database
      try {
        const currentFiles = job.output_files || [];

        // Remove any previous entry for this filename
        const updatedFiles = currentFiles.filter(f => {
          if (typeof f === 'string') return f !== exportFilename;
          return (f?.fileName || f?.filename) !== exportFilename;
        });

        // Store structured info about the filtered file (matching catalogOutputFiles format)
        updatedFiles.push({
          role: 'micrographsCtfStar',
          fileType: 'star',
          fileName: exportFilename,
          relativePath: path.join(outputDir, exportFilename),
          entryCount: selectedRows.length,
        });

        await Job.findOneAndUpdate({ id: job.id }, { output_files: updatedFiles });
        logger.info(`[CTF Export] Stored filter file in database: ${exportFilename} (${selectedRows.length}/${dataRows.length} micrographs)`);
      } catch (dbError) {
        // Log but don't fail the export - file was still created
        logger.warn(`[CTF Export] Could not update database: ${dbError.message}`);
      }
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        filename: exportFilename,
        filepath: exportPath,
        selected_count: selectedRows.length,
        total_available: dataRows.length,
        download_url: `/ctf/download-selection/?job_id=${jobId}&filename=${exportFilename}`
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF export error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to export selection' });
  }
};

/**
 * Download exported CTF selection STAR file
 * GET /ctf/download-selection/?job_id=xxx&filename=xxx
 */
exports.downloadCtfSelection = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const filename = req.query.filename;

    if (!jobId || !filename) {
      return res.status(400).json({ status: 'error', message: 'job_id and filename are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const exportPath = path.join(job.output_file_path, filename);

    if (!fs.existsSync(exportPath)) {
      return res.status(404).json({ status: 'error', message: 'Export file not found' });
    }

    // Security check - ensure file is within expected directory
    const realExportPath = fs.realpathSync(exportPath);
    const realJobDir = fs.realpathSync(job.output_file_path);
    if (!realExportPath.startsWith(realJobDir)) {
      return res.status(403).json({ status: 'error', message: 'Invalid file path' });
    }

    res.download(exportPath, filename, (err) => {
      if (err) {
        logger.error(`[CTF Download] Error sending file: ${err.message}`);
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] CTF download error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to download file' });
  }
};

/**
 * Generate thumbnails for a job
 * POST /dashboard/thumbnails/:jobId/generate
 */
exports.generateThumbnails = async (req, res) => {
  try {
    const { jobId } = req.params;

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const { generateThumbnailsForJob } = require('../services/thumbnailGenerator');

    // Run thumbnail generation asynchronously
    res.json({
      success: true,
      status: 'success',
      message: 'Thumbnail generation started',
      id: job.id
    });

    // Generate in background
    setImmediate(async () => {
      try {
        const genResult = await generateThumbnailsForJob(job);
        logger.info(`[Dashboard] Thumbnails for ${job.id}: ${genResult.generated} generated, ${genResult.errors} errors`);
      } catch (error) {
        logger.error(`[Dashboard] Thumbnail generation failed for ${job.id}: ${error.message}`);
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Generate thumbnails error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to start thumbnail generation' });
  }
};

// ============================================
// AUTOPICK LEGACY ENDPOINTS
// ============================================

/**
 * AutoPick results (legacy endpoint using query params)
 * GET /autopick/results/?job_id=xxx
 *
 * Parses the main autopick.star file which lists micrographs and their coordinate files.
 * RELION creates coordinate files in subdirectories mirroring input structure.
 */
exports.getAutopickResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectRoot = path.dirname(path.dirname(outputDir)); // Go up from AutoPick/JobXXX

    // Build command from parameters
    let command = job.command;
    if (!command && job.parameters) {
      const params = job.parameters;
      const cmdParts = ['relion_autopick'];
      if (params.inputMicrographs) cmdParts.push('--i', params.inputMicrographs);
      if (params.laplacianGaussian === 'Yes') {
        cmdParts.push('--LoG');
        if (params.minDiameter) cmdParts.push('--LoG_diam_min', String(params.minDiameter));
        if (params.maxDiameter) cmdParts.push('--LoG_diam_max', String(params.maxDiameter));
      }
      command = cmdParts.join(' ');
    }

    // Parse main autopick.star file (contains list of micrographs and coordinate files)
    const mainStarPath = path.join(outputDir, 'autopick.star');
    const micrographs = [];
    let totalParticles = 0;

    console.log(`[AutoPick] Looking for: ${mainStarPath}, exists: ${fs.existsSync(mainStarPath)}`);
    if (fs.existsSync(mainStarPath)) {
      try {
        const starData = await parseStarFile(mainStarPath);
        console.log(`[AutoPick] Parsed star data keys: ${Object.keys(starData)}`);
        // The parser returns blocks as { columns: [], rows: [] }
        // For data_coordinate_files block, access .rows to get the array
        const coordBlock = starData.coordinate_files || starData[''];
        const coordList = coordBlock?.rows || coordBlock || [];

        console.log(`[AutoPick] Parsed ${coordList.length} micrographs from autopick.star`);
        logger.info(`[AutoPick] Parsed ${coordList.length} micrographs from autopick.star`);

        for (const entry of coordList) {
          const micrographPath = entry.rlnMicrographName || '';
          const coordFilePath = entry.rlnMicrographCoordinates || '';
          const micrographName = path.basename(micrographPath).replace(/\.[^.]+$/, '');

          // Parse individual coordinate file to get particle count
          let particleCount = 0;
          let avgFom = 0;

          if (coordFilePath) {
            const fullCoordPath = path.join(projectRoot, coordFilePath);
            if (fs.existsSync(fullCoordPath)) {
              try {
                const coordData = await parseStarFile(fullCoordPath);
                // Individual coord files have data_ block (empty name after "data_")
                const coordBlock = coordData[''] || coordData.data_;
                const coords = coordBlock?.rows || coordBlock || [];
                particleCount = Array.isArray(coords) ? coords.length : 0;

                // Calculate average FOM
                if (particleCount > 0) {
                  const fomSum = coords.reduce((sum, c) => {
                    return sum + (parseFloat(c.rlnAutopickFigureOfMerit) || 0);
                  }, 0);
                  avgFom = fomSum / particleCount;
                }
              } catch (e) {
                logger.warn(`[AutoPick] Could not parse coordinate file ${coordFilePath}: ${e.message}`);
              }
            }
          }

          micrographs.push({
            micrograph_name: micrographName,
            micrograph_path: micrographPath,
            coord_file: coordFilePath,
            particle_count: particleCount,
            fom_avg: Math.round(avgFom * 1000) / 1000
          });
          totalParticles += particleCount;
        }
      } catch (e) {
        logger.error(`[AutoPick] Error parsing main star file: ${e.message}`);
      }
    }

    // Sort by particle count descending
    micrographs.sort((a, b) => b.particle_count - a.particle_count);

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: command,
      summary_stats: {
        processed: micrographs.length,
        total: micrographs.length,
        total_micrographs: micrographs.length,
        total_particles: totalParticles,
        avg_particles_per_micrograph: micrographs.length > 0 ? Math.round(totalParticles / micrographs.length) : 0
      },
      micrographs: micrographs.slice(0, 50) // Limit to 50 for display
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] AutoPick results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get autopick results' });
  }
};

/**
 * AutoPick image with picks overlay (legacy endpoint)
 * GET /autopick/image/?job_id=xxx&micrograph=xxx&show_picks=true&radius=50
 *
 * Finds the coordinate file by parsing the main autopick.star file.
 */
exports.getAutopickImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph;
    const showPicks = req.query.show_picks !== 'false';
    const radius = parseInt(req.query.radius) || 50;

    if (!jobId || !micrograph) {
      return res.status(400).json({ status: 'error', message: 'job_id and micrograph are required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectRoot = path.dirname(path.dirname(outputDir));
    const baseName = path.basename(micrograph).replace(/\.[^.]+$/, '');

    // Find the micrograph image (from motion correction job usually)
    const thumbnailPatterns = [
      path.join(outputDir, 'thumbnails', `${baseName}.png`),
      path.join(outputDir, '.thumbnails', `${baseName}.png`),
    ];

    // Also check motion correction directories
    const motionDirs = fs.existsSync(path.join(projectRoot, 'MotionCorr'))
      ? fs.readdirSync(path.join(projectRoot, 'MotionCorr')).filter(f => f.startsWith('Job'))
      : [];

    for (const motionDir of motionDirs) {
      thumbnailPatterns.push(
        path.join(projectRoot, 'MotionCorr', motionDir, 'thumbnails', `${baseName}.png`),
        path.join(projectRoot, 'MotionCorr', motionDir, '.thumbnails', `${baseName}.png`),
        path.join(projectRoot, 'MotionCorr', motionDir, 'Movies', `${baseName}.png`)
      );
    }

    let imagePath = null;
    for (const p of thumbnailPatterns) {
      if (fs.existsSync(p)) {
        imagePath = p;
        break;
      }
    }

    if (!imagePath) {
      return res.status(404).json({
        status: 'error',
        message: 'Micrograph image not found'
      });
    }

    // Read image and optionally overlay picks
    const imgData = fs.readFileSync(imagePath);
    const base64 = imgData.toString('base64');

    // Get coordinates and original MRC dimensions if showing picks
    let coordinates = [];
    let micrographPath = null;
    let originalWidth = 0;
    let originalHeight = 0;

    if (showPicks) {
      // First, parse main autopick.star to find the coordinate file path and micrograph path
      const mainStarPath = path.join(outputDir, 'autopick.star');
      let coordFilePath = null;

      if (fs.existsSync(mainStarPath)) {
        try {
          const starData = await parseStarFile(mainStarPath);
          // Access .rows from the block object
          const coordBlock = starData.coordinate_files || starData[''];
          const coordList = coordBlock?.rows || coordBlock || [];

          // Find matching micrograph
          for (const entry of coordList) {
            const micName = path.basename(entry.rlnMicrographName || '').replace(/\.[^.]+$/, '');
            if (micName === baseName) {
              coordFilePath = entry.rlnMicrographCoordinates;
              micrographPath = entry.rlnMicrographName;
              break;
            }
          }
        } catch (e) {
          logger.warn(`[AutoPick] Could not parse main star file: ${e.message}`);
        }
      }

      // Parse the coordinate file
      if (coordFilePath) {
        const fullCoordPath = path.join(projectRoot, coordFilePath);
        if (fs.existsSync(fullCoordPath)) {
          try {
            const coordData = await parseStarFile(fullCoordPath);
            // Access .rows from the block object
            const coordBlock = coordData[''] || coordData.data_;
            const coords = coordBlock?.rows || coordBlock || [];
            coordinates = coords.map(c => ({
              x: parseFloat(c.rlnCoordinateX) || 0,
              y: parseFloat(c.rlnCoordinateY) || 0,
              fom: parseFloat(c.rlnAutopickFigureOfMerit) || 0
            }));
          } catch (e) {
            logger.warn(`[AutoPick] Could not parse coordinates: ${e.message}`);
          }
        }
      }

      // Read original MRC dimensions from header (nx, ny, nz are first 12 bytes as int32)
      if (micrographPath) {
        const fullMrcPath = path.join(projectRoot, micrographPath);
        if (fs.existsSync(fullMrcPath)) {
          try {
            const fd = fs.openSync(fullMrcPath, 'r');
            const headerBuf = Buffer.alloc(12);
            fs.readSync(fd, headerBuf, 0, 12, 0);
            fs.closeSync(fd);
            originalWidth = headerBuf.readInt32LE(0);
            originalHeight = headerBuf.readInt32LE(4);
            logger.debug(`[AutoPick] MRC dimensions: ${originalWidth}x${originalHeight}`);
          } catch (e) {
            logger.warn(`[AutoPick] Could not read MRC header: ${e.message}`);
          }
        }
      }
    }

    // Get pixel size for Å→pixel conversion (micrograph pixel size used for picking)
    const pixelSize = job.pipeline_stats?.pixel_size || null;

    res.json({
      success: true,
      status: 'success',
      data: {
        micrograph: baseName,
        image: `data:image/png;base64,${base64}`,
        coordinates: coordinates,
        particle_count: coordinates.length,
        original_width: originalWidth,
        original_height: originalHeight,
        pixel_size: pixelSize
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] AutoPick image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get autopick image' });
  }
};

/**
 * AutoPick live stats (legacy endpoint)
 * GET /autopick/live-stats/?job_id=xxx
 *
 * Parses the main autopick.star file to get processed count and particle totals.
 */
exports.getAutopickLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectRoot = path.dirname(path.dirname(outputDir));

    let totalParticles = 0;
    let processedCount = 0;
    const recentCounts = [];
    const latestMicrographs = [];

    // Parse main autopick.star file
    const mainStarPath = path.join(outputDir, 'autopick.star');
    if (fs.existsSync(mainStarPath)) {
      try {
        const starData = await parseStarFile(mainStarPath);
        // Access .rows from the block object
        const coordBlock = starData.coordinate_files || starData[''];
        const coordList = coordBlock?.rows || coordBlock || [];
        processedCount = coordList.length;

        // Get particle counts for recent micrographs (last 5)
        const recentEntries = coordList.slice(-5);
        for (const entry of recentEntries) {
          const coordFilePath = entry.rlnMicrographCoordinates;
          const micName = path.basename(entry.rlnMicrographName || '').replace(/\.[^.]+$/, '');

          if (coordFilePath) {
            const fullCoordPath = path.join(projectRoot, coordFilePath);
            if (fs.existsSync(fullCoordPath)) {
              try {
                const coordData = await parseStarFile(fullCoordPath);
                // Access .rows from the block object
                const innerBlock = coordData[''] || coordData.data_;
                const coords = innerBlock?.rows || innerBlock || [];
                const count = Array.isArray(coords) ? coords.length : 0;
                recentCounts.push(count);
                totalParticles += count;
                latestMicrographs.push({ name: micName, particle_count: count });
              } catch (e) {
                recentCounts.push(0);
              }
            }
          }
        }

        // Count total particles from all files (sample first 20 for speed)
        const sampleEntries = coordList.slice(0, Math.min(20, coordList.length));
        for (const entry of sampleEntries) {
          if (recentEntries.includes(entry)) continue; // Already counted

          const coordFilePath = entry.rlnMicrographCoordinates;
          if (coordFilePath) {
            const fullCoordPath = path.join(projectRoot, coordFilePath);
            if (fs.existsSync(fullCoordPath)) {
              try {
                const coordData = await parseStarFile(fullCoordPath);
                // Access .rows from the block object
                const innerBlock = coordData[''] || coordData.data_;
                const coords = innerBlock?.rows || innerBlock || [];
                totalParticles += Array.isArray(coords) ? coords.length : 0;
              } catch (e) {
                // Skip
              }
            }
          }
        }

        // Estimate total if we only sampled
        if (coordList.length > 25) {
          const avgPerMic = totalParticles / Math.min(25, coordList.length);
          totalParticles = Math.round(avgPerMic * coordList.length);
        }
      } catch (e) {
        logger.error(`[AutoPick] Error parsing main star file for live stats: ${e.message}`);
      }
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: job.id,
        job_status: job.status,
        processed: processedCount,
        total_particles: totalParticles,
        avg_particles: processedCount > 0 ? Math.round(totalParticles / processedCount) : 0,
        recent_counts: recentCounts,
        latest_micrographs: latestMicrographs,
        progress_percent: job.status === JOB_STATUS.SUCCESS ? 100 : (job.status === JOB_STATUS.RUNNING ? 50 : 0)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] AutoPick live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get autopick live stats' });
  }
};

// ============================================
// EXTRACT (PARTICLE EXTRACTION) LEGACY ENDPOINTS
// ============================================

/**
 * Extract results (legacy endpoint)
 * GET /extract/results/?job_id=xxx
 */
exports.getExtractResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'particles.star');

    let command = job.command;
    if (!command && job.parameters) {
      const params = job.parameters;
      const cmdParts = ['relion_preprocess'];
      if (params.inputCoordinates) cmdParts.push('--coord_dir', params.inputCoordinates);
      if (params.boxSize) cmdParts.push('--extract_size', String(params.boxSize));
      command = cmdParts.join(' ');
    }

    const eps = job.pipeline_stats || {};
    const totalParticles = eps.particle_count || job.particle_count || 0;
    const numMicrographs = eps.micrograph_count || job.micrograph_count || 0;

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: command,
      total_particles: totalParticles,
      num_micrographs: numMicrographs,
      box_size: eps.box_size || job.parameters?.boxSize || 0,
      pixel_size: eps.pixel_size || job.parameters?.angpix || 0
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] Extract results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get extract results' });
  }
};

/**
 * Extract particles image (legacy endpoint)
 * GET /extract/particles-image/?job_id=xxx&micrograph=xxx&max=100
 */
exports.getExtractParticlesImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const micrograph = req.query.micrograph || '';
    const maxParticles = parseInt(req.query.max) || 100;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    if (!fs.existsSync(outputDir)) {
      return res.json({
        success: true,
      status: 'success',
        data: { image: null, message: 'Output directory not found' }
      });
    }

    // Find particle stack file
    let stackFile = null;
    const micrographsDir = path.join(outputDir, 'Micrographs');

    if (micrograph && fs.existsSync(micrographsDir)) {
      // Look for specific micrograph stack
      const potentialPaths = [
        path.join(micrographsDir, `${micrograph}.mrcs`),
        path.join(outputDir, `${micrograph}.mrcs`)
      ];
      for (const p of potentialPaths) {
        if (fs.existsSync(p)) {
          stackFile = p;
          break;
        }
      }
    }

    // If no specific micrograph or not found, find any .mrcs file
    if (!stackFile) {
      const searchDirs = [micrographsDir, outputDir];
      for (const dir of searchDirs) {
        if (!fs.existsSync(dir)) continue;
        const files = fs.readdirSync(dir).filter(f => f.endsWith('.mrcs'));
        if (files.length > 0) {
          stackFile = path.join(dir, files[0]);
          break;
        }
      }
    }

    if (!stackFile || !fs.existsSync(stackFile)) {
      return res.json({
        success: true,
      status: 'success',
        data: { image: null, message: 'No particle stacks found yet' }
      });
    }

    // Import stack-to-grid function
    const { stackToGridPng, getMrcInfo } = require('../utils/mrcParser');

    // Get info about the stack
    const info = getMrcInfo(stackFile);

    // Generate grid image
    const gridResult = await stackToGridPng(stackFile, maxParticles, 10, 1200);
    if (!gridResult) {
      return res.json({
        success: true,
      status: 'success',
        data: { image: null, message: 'Could not read particle stack' }
      });
    }

    const base64 = gridResult.buffer.toString('base64');

    res.json({
      success: true,
      status: 'success',
      data: {
        image: `data:image/png;base64,${base64}`,
        num_particles: gridResult.numImages,
        box_size: info ? info.width : 0,
        grid_cols: gridResult.cols,
        grid_rows: gridResult.rows,
        micrograph: micrograph || path.basename(stackFile, '.mrcs')
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Extract particles image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get particles image' });
  }
};

/**
 * Extract live stats (legacy endpoint)
 * GET /extract/live-stats/?job_id=xxx
 */
exports.getExtractLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'particles.star');

    let totalParticles = 0;
    if (fs.existsSync(starPath)) {
      const starData = await parseStarWithCache(job, starPath);
      const particles = starData.particles || starData.data_particles || [];
      totalParticles = particles.length;
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: job.id,
        job_status: job.status,
        total_particles: totalParticles,
        progress_percent: job.status === JOB_STATUS.SUCCESS ? 100 : (job.status === JOB_STATUS.RUNNING ? 50 : 0)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Extract live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get extract live stats' });
  }
};

// ============================================
// CLASS2D LEGACY ENDPOINTS
// ============================================

/**
 * Class2D results (legacy endpoint)
 * GET /class2d/results/?job_id=xxx
 */
exports.getClass2dResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find all iteration files (classes.mrcs files)
    const iterations = [];
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      // Match patterns like run_it005_classes.mrcs or _it005_classes.mrcs
      for (const f of files) {
        const match = f.match(/_it(\d+)_classes\.mrcs$/);
        if (match) {
          iterations.push({
            iteration: parseInt(match[1]),
            filename: f
          });
        }
      }
      iterations.sort((a, b) => a.iteration - b.iteration);
    }

    // Find latest iteration from model files
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    const latestModel = modelFiles.length > 0 ? modelFiles[modelFiles.length - 1] : null;
    const iterMatch = latestModel ? latestModel.match(/_it(\d+)_model\.star/) : null;
    const latestIteration = iterMatch ? parseInt(iterMatch[1]) : (iterations.length > 0 ? iterations[iterations.length - 1].iteration : 0);

    // Get number of classes from latest MRCS file
    let numClasses = job.parameters?.numberOfClasses || 0;
    if (iterations.length > 0) {
      const latestMrcs = path.join(outputDir, iterations[iterations.length - 1].filename);
      if (fs.existsSync(latestMrcs)) {
        try {
          const { getMrcInfo } = require('../utils/mrcParser');
          const info = getMrcInfo(latestMrcs);
          if (info && info.num_frames > 0) {
            numClasses = info.num_frames;
          }
        } catch (e) {
          logger.warn(`[Class2D] Could not read MRCS info: ${e.message}`);
        }
      }
    }

    let command = job.command;
    if (!command && job.parameters) {
      const params = job.parameters;
      const cmdParts = ['relion_refine', '--o', `${job.job_name}/run`];
      if (params.inputParticles) cmdParts.push('--i', params.inputParticles);
      if (params.numberOfClasses) cmdParts.push('--K', String(params.numberOfClasses));
      command = cmdParts.join(' ');
    }

    // Get box size and particle count from upstream Extract job or input particles STAR file
    let boxSize = null;
    let numParticles = 0;
    const inputStarFile = job.parameters?.inputStarFile || job.parameters?.inputParticles;
    if (inputStarFile) {
      // outputDir is like /project/Class2D/Job009, need to go up 2 levels to project root
      const projectDir = path.dirname(path.dirname(outputDir));
      const inputPath = path.join(projectDir, inputStarFile);
      logger.debug(`[Class2D] Looking for input STAR file: ${inputPath}`);
      if (fs.existsSync(inputPath)) {
        try {
          const starData = await parseStarFile(inputPath);
          // Get image size from optics table
          const optics = starData.optics || starData.data_optics || {};
          const opticsRows = optics.rows || (Array.isArray(optics) ? optics : []);
          if (opticsRows.length > 0) {
            boxSize = parseInt(opticsRows[0].rlnImageSize) || null;
            logger.debug(`[Class2D] Found box size from input STAR: ${boxSize}`);
          }
          // Get particle count from particles table
          const particles = starData.particles || starData.data_particles || {};
          const particleRows = particles.rows || (Array.isArray(particles) ? particles : []);
          numParticles = particleRows.length;
          logger.debug(`[Class2D] Found ${numParticles} particles from input STAR`);
        } catch (e) {
          logger.debug(`[Class2D] Could not read from input STAR: ${e.message}`);
        }
      } else {
        logger.debug(`[Class2D] Input STAR file not found: ${inputPath}`);
      }
    }

    const response = {
      job_id: jobId,
      job_name: job.job_name,
      job_status: job.status,
      output_dir: outputDir,
      command: command,
      total_iterations: iterations.length,
      latest_iteration: latestIteration,
      num_classes: numClasses,
      iterations: iterations,
      box_size: boxSize,
      num_particles: numParticles,
      mask_diameter: job.parameters?.maskDiameter,
      num_classes_param: job.parameters?.numberOfClasses,
      num_iterations_param: job.parameters?.useVDAM === 'Yes'
        ? (parseInt(job.parameters?.vdamMiniBatches) || 200)
        : (parseInt(job.parameters?.numberOfIterations) || parseInt(job.parameters?.numberEMIterations) || 25),
      classes: []
    };

    // Parse model file for class stats if available
    if (latestModel && fs.existsSync(path.join(outputDir, latestModel))) {
      const starData = await parseStarFile(path.join(outputDir, latestModel));
      // STAR file structure: { model_classes: { columns: [...], rows: [...] } }
      const classesBlock = starData.model_classes || starData.data_model_classes || {};
      const classes = classesBlock.rows || (Array.isArray(classesBlock) ? classesBlock : []);

      response.classes = classes.map((c, i) => ({
        class_number: i + 1,
        distribution: parseFloat(c.rlnClassDistribution) || 0,
        resolution: parseFloat(c.rlnEstimatedResolution) || 0,
        reference_image: c.rlnReferenceImage || null
      }));
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] Class2D results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Class2D results' });
  }
};

/**
 * Class2D classes image (legacy endpoint)
 * GET /class2d/classes-image/?job_id=xxx&iteration=xxx
 */
exports.getClass2dClassesImage = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const iteration = req.query.iteration;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({ status: 'error', message: 'Output directory not found' });
    }

    // Find the classes MRC file - support multiple naming patterns
    let classesMrc = null;
    let iterationNum = null;

    if (iteration && iteration !== 'latest') {
      // Specific iteration requested
      iterationNum = parseInt(iteration);
      const padded = String(iterationNum).padStart(3, '0');
      const patterns = [
        `run_it${padded}_classes.mrcs`,
        `_it${padded}_classes.mrcs`
      ];
      for (const pattern of patterns) {
        const testPath = path.join(outputDir, pattern);
        if (fs.existsSync(testPath)) {
          classesMrc = testPath;
          break;
        }
      }
    } else {
      // Find latest iteration
      const files = fs.readdirSync(outputDir);
      const classFiles = files.filter(f => f.match(/_it\d+_classes\.mrcs$/)).sort();
      if (classFiles.length > 0) {
        classesMrc = path.join(outputDir, classFiles[classFiles.length - 1]);
        // Extract iteration number
        const match = classFiles[classFiles.length - 1].match(/_it(\d+)_classes\.mrcs$/);
        if (match) {
          iterationNum = parseInt(match[1]);
        }
      }
    }

    if (!classesMrc || !fs.existsSync(classesMrc)) {
      return res.status(404).json({ status: 'error', message: 'Classes image not found' });
    }

    // Import stack-to-grid function
    const { stackToGridPng, getMrcInfo } = require('../utils/mrcParser');

    // Get info about the stack
    const info = getMrcInfo(classesMrc);

    // Always use 10 columns (or fewer if less than 10 classes)
    // Empty cells in last row will be transparent
    const numClasses = info ? info.num_frames : 25;
    const cols = Math.min(10, numClasses);

    // Generate grid image of all classes
    const gridResult = await stackToGridPng(classesMrc, 200, cols, 1200);
    if (!gridResult) {
      return res.status(500).json({ status: 'error', message: 'Could not generate classes image' });
    }

    const base64 = gridResult.buffer.toString('base64');

    res.json({
      success: true,
      status: 'success',
      data: {
        job_id: jobId,
        iteration: iterationNum,
        filename: path.basename(classesMrc),
        num_classes: gridResult.numImages,
        width: info ? info.width : 0,
        height: info ? info.height : 0,
        image: `data:image/png;base64,${base64}`
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Class2D classes image error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get classes image' });
  }
};

/**
 * Class2D live stats (legacy endpoint)
 * GET /class2d/live-stats/?job_id=xxx
 */
exports.getClass2dLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Match both run_it*_model.star and _it*_model.star patterns
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    // Extract iteration number from latest model file
    let currentIteration = 0;
    if (modelFiles.length > 0) {
      const match = modelFiles[modelFiles.length - 1].match(/_it(\d+)_model\.star$/);
      if (match) {
        currentIteration = parseInt(match[1]);
      }
    }
    const totalIterations = job.parameters?.useVDAM === 'Yes'
      ? (parseInt(job.parameters?.vdamMiniBatches) || 200)
      : (parseInt(job.parameters?.numberOfIterations) || parseInt(job.parameters?.numberEMIterations) || 25);

    // Update pipeline_stats.iteration_count in DB so stats cards stay current
    if (currentIteration > 0 && currentIteration !== (job.pipeline_stats?.iteration_count || 0)) {
      Job.updateOne({ id: job.id }, { 'pipeline_stats.iteration_count': currentIteration }).catch(() => {});
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: job.id,
        job_status: job.status,
        current_iteration: currentIteration,
        total_iterations: totalIterations,
        progress_percent: Math.round((currentIteration / totalIterations) * 100)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Class2D live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Class2D live stats' });
  }
};

// ============================================
// MANUAL SELECT LEGACY ENDPOINTS
// ============================================

/**
 * ManualSelect results (legacy endpoint)
 * GET /manualselect/results/?job_id=xxx
 */
exports.getManualSelectResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;

    // Get project to resolve path
    const Project = require('../models/Project');
    const project = await Project.findOne({ id: job.project_id }).lean();
    const projectPath = project
      ? path.join(process.env.ROOT_PATH || '/shared/data', project.folder_name || project.project_name)
      : '';
    const outputDir = path.isAbsolute(job.output_file_path)
      ? job.output_file_path
      : path.join(projectPath, job.output_file_path);
    const starPath = path.join(outputDir, 'particles.star');

    const selectedClasses = job.parameters?.selected_classes || job.parameters?.selectedClasses || [];

    // Get input particle count from source job
    let particlesBefore = 0;
    if (job.input_job_ids && job.input_job_ids.length > 0) {
      try {
        const sourceJob = await Job.findOne({ id: job.input_job_ids[0] }).lean();
        if (sourceJob) {
          particlesBefore = sourceJob.pipeline_stats?.particle_count || sourceJob.particle_count || 0;
        }
      } catch (e) {
        logger.warn(`[ManualSelect] Could not get source job particle count: ${e.message}`);
      }
    }

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      particle_count: job.pipeline_stats?.particle_count || job.particle_count || 0,
      particles_before: particlesBefore,
      // Include both field names for frontend compatibility
      selected_classes: selectedClasses,
      classes_selected: selectedClasses,
      num_classes_selected: selectedClasses.length,
      total_classes: job.parameters?.num_classes_selected || selectedClasses.length || 0,
      source_star_file: job.parameters?.source_star_file || null,
      source_job_name: job.parameters?.source_job_name || null
    };

    // Try to read particle count from file if not in job record
    if (response.particle_count === 0 && fs.existsSync(starPath)) {
      try {
        const starData = await parseStarWithCache(job, starPath);
        const particles = starData.particles || starData.data_particles || [];
        response.particle_count = Array.isArray(particles.rows) ? particles.rows.length : particles.length;
      } catch (e) {
        logger.warn(`[ManualSelect] Could not read particle count from ${starPath}`);
      }
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] ManualSelect results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get ManualSelect results' });
  }
};

// ============================================
// 3D INITIAL MODEL LEGACY ENDPOINTS
// ============================================

/**
 * InitialModel results (legacy endpoint)
 * GET /initialmodel/results/?job_id=xxx
 */
exports.getInitialModelResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find iteration files with detailed parsing - match both run_it* and _it* patterns
    const iterations = [];
    if (fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const f of files) {
        // Match patterns like run_it005_class001.mrc or _it005_class001.mrc
        const match = f.match(/_it(\d+)_class(\d+)\.mrc$/);
        if (match && !f.includes('half')) {
          iterations.push({
            iteration: parseInt(match[1]),
            class: parseInt(match[2]),
            filename: f,
            file_path: path.join(outputDir, f)
          });
        }
      }
      iterations.sort((a, b) => a.iteration - b.iteration || a.class - b.class);
    }

    // Get unique iterations
    const uniqueIterations = [...new Set(iterations.map(it => it.iteration))].sort((a, b) => a - b);
    const latestIteration = uniqueIterations.length > 0 ? uniqueIterations[uniqueIterations.length - 1] : 0;
    const numClasses = iterations.filter(it => it.iteration === latestIteration).length;

    // Get latest MRC file path for Molstar viewer
    let latestMrcPath = null;
    const latestIterFiles = iterations.filter(it => it.iteration === latestIteration);
    if (latestIterFiles.length > 0) {
      latestMrcPath = latestIterFiles[0].file_path;
    }

    const params = job.parameters || {};

    // Get pipeline stats (box_size, pixel_size)
    let boxSize = null;
    let pixelSize = null;
    let originalPixelSize = null;
    let boxSizeAngstrom = null;

    // Try to get from pipeline_stats first
    const ips = job.pipeline_stats || {};
    boxSize = ips.box_size || null;
    pixelSize = ips.pixel_size || null;
    originalPixelSize = job.parameters?.angpix ? parseFloat(job.parameters.angpix) : null;

    // Try to read from input STAR file if not in parameters
    if (!boxSize || !pixelSize) {
      const inputStarFile = params.inputParticles || params.inputStarFile;
      if (inputStarFile) {
        try {
          const Project = require('../models/Project');
          const project = await Project.findOne({ id: job.project_id }).lean();
          const projectDir = project
            ? path.join(process.env.ROOT_PATH || '/shared/data', project.folder_name || project.project_name)
            : path.dirname(path.dirname(outputDir));

          const inputPath = path.isAbsolute(inputStarFile)
            ? inputStarFile
            : path.join(projectDir, inputStarFile);

          if (fs.existsSync(inputPath)) {
            const starData = await parseStarFile(inputPath, 1);
            if (starData.optics && starData.optics.rows && starData.optics.rows.length > 0) {
              const optics = starData.optics.rows[0];
              boxSize = boxSize || parseInt(optics.rlnImageSize || optics._rlnImageSize) || null;
              pixelSize = pixelSize || parseFloat(optics.rlnImagePixelSize || optics._rlnImagePixelSize) || null;
              originalPixelSize = originalPixelSize || pixelSize;
            }
          }
        } catch (e) {
          logger.warn(`[InitialModel] Could not read pipeline metadata: ${e.message}`);
        }
      }
    }

    if (boxSize && pixelSize) {
      boxSizeAngstrom = boxSize * pixelSize;
    }

    const response = {
      job_id: jobId,
      job_name: job.job_name,
      job_status: job.status,
      output_dir: outputDir,
      command: job.command,
      total_iterations: uniqueIterations.length,
      latest_iteration: latestIteration,
      num_classes: numClasses || params.numberOfClasses || 1,
      symmetry: params.symmetry || 'C1',
      mask_diameter: params.maskDiameter || params.particleDiameter || 200,
      latest_mrc_path: latestMrcPath,
      has_output: iterations.length > 0,
      iterations: iterations,
      unique_iterations: uniqueIterations,
      // Pipeline metadata
      box_size: boxSize,
      pixel_size: pixelSize,
      original_pixel_size: originalPixelSize,
      box_size_angstrom: boxSizeAngstrom
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] InitialModel results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get InitialModel results' });
  }
};

/**
 * InitialModel MRC (legacy endpoint)
 * GET /initialmodel/mrc/?job_id=xxx&iteration=xxx&class=xxx
 * Also supports direct file_path parameter
 */
exports.getInitialModelMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const filePath = req.query.file_path;
    const iteration = req.query.iteration || 'latest';
    const classNum = parseInt(req.query.class) || 1;

    // Direct file path mode
    if (filePath) {
      if (!filePath.endsWith('.mrc')) {
        return res.status(400).json({ status: 'error', message: 'Invalid file type' });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'error', message: 'MRC file not found' });
      }
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${path.basename(filePath)}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return fs.createReadStream(filePath).pipe(res);
    }

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find all MRC files matching both run_it* and _it* patterns
    let mrcPath = null;
    if (fs.existsSync(outputDir)) {
      const allFiles = fs.readdirSync(outputDir);
      // Match both run_it* and _it* patterns, exclude half volumes
      const mrcFiles = allFiles.filter(f =>
        f.match(/_it\d+_class\d+\.mrc$/) && !f.includes('half')
      );

      if (iteration === 'latest') {
        // Find latest iteration for the specified class
        const classFiles = mrcFiles.filter(f =>
          f.match(new RegExp(`_class0*${classNum}\\.mrc$`))
        ).sort();
        if (classFiles.length > 0) {
          mrcPath = path.join(outputDir, classFiles[classFiles.length - 1]);
        } else if (mrcFiles.length > 0) {
          // Fallback to any file if specific class not found
          mrcPath = path.join(outputDir, mrcFiles[mrcFiles.length - 1]);
        }
      } else {
        // Find specific iteration and class
        const iterStr = String(iteration).padStart(3, '0');
        const classStr = String(classNum).padStart(3, '0');
        const exactMatch = mrcFiles.find(f =>
          f.includes(`_it${iterStr}_class${classStr}.mrc`)
        );
        if (exactMatch) {
          mrcPath = path.join(outputDir, exactMatch);
        } else {
          // Try without padding
          const altMatch = mrcFiles.find(f =>
            f.match(new RegExp(`_it0*${iteration}_class0*${classNum}\\.mrc$`))
          );
          if (altMatch) {
            mrcPath = path.join(outputDir, altMatch);
          }
        }
      }
    }

    if (!mrcPath || !fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: 'MRC file not found' });
    }

    // Send MRC file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(mrcPath)}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] InitialModel MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get MRC file' });
  }
};

/**
 * InitialModel live stats (legacy endpoint)
 * GET /initialmodel/live-stats/?job_id=xxx
 */
exports.getInitialModelLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find model files - match both run_it* and _it* patterns
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    // Find current iteration from model files
    let currentIteration = 0;
    if (modelFiles.length > 0) {
      const match = modelFiles[modelFiles.length - 1].match(/_it(\d+)_model\.star$/);
      if (match) {
        currentIteration = parseInt(match[1]);
      }
    }

    // Also check for MRC files to determine has_model
    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_class\d+\.mrc$/) && !f.includes('half'))
      : [];

    const totalIterations = job.parameters?.numberOfIterations || job.parameters?.numberIterations || 200;

    // Get unique iterations from MRC files
    const iterationsCompleted = [...new Set(
      mrcFiles.map(f => {
        const match = f.match(/_it(\d+)_class/);
        return match ? parseInt(match[1]) : null;
      }).filter(Boolean)
    )].sort((a, b) => a - b);

    // Update pipeline_stats.iteration_count in DB so stats cards stay current
    if (currentIteration > 0 && currentIteration !== (job.pipeline_stats?.iteration_count || 0)) {
      Job.updateOne({ id: job.id }, { 'pipeline_stats.iteration_count': currentIteration }).catch(() => {});
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job_id: job.id,
        job_status: job.status,
        current_iteration: currentIteration,
        total_iterations: totalIterations,
        has_model: mrcFiles.length > 0,
        iterations_completed: iterationsCompleted,
        progress_percent: Math.round((currentIteration / totalIterations) * 100)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] InitialModel live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get InitialModel live stats' });
  }
};

// ============================================
// CLASS3D LEGACY ENDPOINTS
// ============================================

/**
 * Class3D results (legacy endpoint)
 * GET /class3d/results/?job_id=xxx
 */
exports.getClass3dResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Support both run_it* and _it* patterns (like Python reference)
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    // Support both run_it*_class*.mrc and _it*_class*.mrc patterns
    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_class\d+\.mrc$/)).sort()
      : [];

    // Extract latest iteration from model files
    let latestIteration = 0;
    if (modelFiles.length > 0) {
      const match = modelFiles[modelFiles.length - 1].match(/_it(\d+)_model\.star$/);
      if (match) {
        latestIteration = parseInt(match[1]);
      }
    }

    // Build iterations array with { iteration, class, file, filename } for MolstarViewer
    // Include FULL FILE PATH like Python reference
    const iterations = mrcFiles.map(f => {
      const match = f.match(/_it(\d+)_class(\d+)\.mrc$/);
      if (match) {
        return {
          iteration: parseInt(match[1]),
          class: parseInt(match[2]),
          filename: f,
          file: path.join(outputDir, f)  // Full path for MolstarViewer
        };
      }
      return null;
    }).filter(Boolean);

    // Sort by iteration then class
    iterations.sort((a, b) => a.iteration - b.iteration || a.class - b.class);

    // Get unique iteration numbers
    const uniqueIterations = [...new Set(iterations.map(it => it.iteration))].sort((a, b) => a - b);

    // Get latest MRC path for class 1 (full path)
    const latestClass1File = iterations
      .filter(it => it.iteration === latestIteration && it.class === 1)
      .pop();
    const latestMrcPath = latestClass1File ? latestClass1File.file : null;

    // Count classes in latest iteration
    const numClassesInLatest = iterations.filter(it => it.iteration === latestIteration).length;

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      output_dir: outputDir,
      latest_iteration: latestIteration,
      total_iterations: job.parameters?.useVDAM === 'Yes'
        ? (parseInt(job.parameters?.vdamMiniBatches) || 200)
        : (parseInt(job.parameters?.numberOfIterations) || parseInt(job.parameters?.numberIterations) || 25),
      num_classes: numClassesInLatest || job.parameters?.numberOfClasses || job.parameters?.numberClasses || 1,
      symmetry: job.parameters?.symmetry || job.parameters?.Symmetry || 'C1',
      mask_diameter: job.parameters?.maskDiameter || job.parameters?.particleDiameter || 200,
      has_output: mrcFiles.length > 0,
      iterations: iterations,
      unique_iterations: uniqueIterations,
      latest_mrc_path: latestMrcPath,
      classes_per_iteration: uniqueIterations.reduce((acc, it) => {
        acc[it] = iterations.filter(x => x.iteration === it).length;
        return acc;
      }, {}),
      classes: []
    };

    // Parse model file for class info
    if (modelFiles.length > 0) {
      const latestModel = modelFiles[modelFiles.length - 1];
      const starData = await parseStarFile(path.join(outputDir, latestModel));
      // STAR file structure: { model_classes: { columns: [...], rows: [...] } }
      const classesBlock = starData.model_classes || starData.data_model_classes || {};
      const classes = classesBlock.rows || (Array.isArray(classesBlock) ? classesBlock : []);

      response.classes = classes.map((c, i) => ({
        class_number: i + 1,
        distribution: parseFloat(c.rlnClassDistribution) || 0,
        resolution: parseFloat(c.rlnEstimatedResolution) || 0
      }));
    }

    res.json({ success: true, status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] Class3D results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Class3D results' });
  }
};

/**
 * Class3D MRC (legacy endpoint)
 * GET /class3d/mrc/?job_id=xxx&iteration=xxx&class=xxx
 * GET /class3d/mrc/?file_path=xxx&token=xxx (for Molstar direct loading)
 */
exports.getClass3dMrc = async (req, res) => {
  try {
    // Support direct file path loading (for Molstar)
    const filePath = req.query.file_path;
    if (filePath) {
      // Security: Ensure the file exists and is an MRC file
      if (!filePath.endsWith('.mrc')) {
        return res.status(400).json({ status: 'error', message: 'Invalid file type' });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'error', message: 'MRC file not found' });
      }
      const filename = path.basename(filePath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return fs.createReadStream(filePath).pipe(res);
    }

    const jobId = req.query.job_id;
    const iteration = req.query.iteration || 'latest';
    const classNum = req.query.class || 1;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    let mrcPath;
    if (iteration === 'latest') {
      // Support both run_it* and _it* patterns
      const mrcFiles = fs.existsSync(outputDir)
        ? fs.readdirSync(outputDir).filter(f => f.match(new RegExp(`_it\\d+_class0*${classNum}\\.mrc$`))).sort()
        : [];
      mrcPath = mrcFiles.length > 0 ? path.join(outputDir, mrcFiles[mrcFiles.length - 1]) : null;
    } else {
      // Try both patterns
      const paddedIter = String(iteration).padStart(3, '0');
      const paddedClass = String(classNum).padStart(3, '0');
      const runPath = path.join(outputDir, `run_it${paddedIter}_class${paddedClass}.mrc`);
      const altPath = path.join(outputDir, `_it${paddedIter}_class${paddedClass}.mrc`);
      mrcPath = fs.existsSync(runPath) ? runPath : (fs.existsSync(altPath) ? altPath : null);
    }

    if (!mrcPath || !fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: 'MRC file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(mrcPath)}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] Class3D MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get MRC file' });
  }
};

/**
 * Class3D live stats (legacy endpoint)
 * GET /class3d/live-stats/?job_id=xxx
 */
exports.getClass3dLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Match both run_it*_model.star and _it*_model.star patterns
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    // Extract iteration number from latest model file
    let currentIteration = 0;
    if (modelFiles.length > 0) {
      const match = modelFiles[modelFiles.length - 1].match(/_it(\d+)_model\.star$/);
      if (match) {
        currentIteration = parseInt(match[1]);
      }
    }
    const totalIterations = job.parameters?.useVDAM === 'Yes'
      ? (parseInt(job.parameters?.vdamMiniBatches) || 200)
      : (parseInt(job.parameters?.numberOfIterations) || parseInt(job.parameters?.numberEMIterations) || 25);

    // Update pipeline_stats.iteration_count in DB so stats cards stay current
    if (currentIteration > 0 && currentIteration !== (job.pipeline_stats?.iteration_count || 0)) {
      Job.updateOne({ id: job.id }, { 'pipeline_stats.iteration_count': currentIteration }).catch(() => {});
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: job.id,
        job_status: job.status,
        current_iteration: currentIteration,
        total_iterations: totalIterations,
        progress_percent: Math.round((currentIteration / totalIterations) * 100)
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Class3D live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Class3D live stats' });
  }
};

// ============================================
// AUTOREFINE LEGACY ENDPOINTS
// ============================================

/**
 * AutoRefine results (legacy endpoint)
 * GET /autorefine/results/?job_id=xxx
 */
exports.getAutoRefineResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Support both run_it* and _it* patterns (like Python reference)
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/) || f.match(/run_model\.star$/)).sort()
      : [];

    // Find all MRC files including half maps
    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+.*\.mrc$/) || f.match(/_half\d+.*\.mrc$/)).sort()
      : [];

    // Build iterations array with file info for MolstarViewer
    const allIterations = mrcFiles.map(f => {
      const iterMatch = f.match(/_it(\d+)_/);
      const classMatch = f.match(/_class(\d+)\.mrc$/);
      const halfMatch = f.match(/_half(\d+)_/);

      if (iterMatch) {
        return {
          iteration: parseInt(iterMatch[1]),
          class: classMatch ? parseInt(classMatch[1]) : 1,
          half: halfMatch ? parseInt(halfMatch[1]) : 0,
          filename: f,
          file: path.join(outputDir, f),  // Full path for MolstarViewer
          is_half: !!halfMatch
        };
      }
      return null;
    }).filter(Boolean);

    // Sort by iteration, class, half
    allIterations.sort((a, b) => a.iteration - b.iteration || a.class - b.class || a.half - b.half);

    // Get unique iterations
    const uniqueIterations = [...new Set(allIterations.map(it => it.iteration))].sort((a, b) => a - b);
    const latestIteration = uniqueIterations.length > 0 ? Math.max(...uniqueIterations) : 0;

    // Only keep the latest iteration files for display (not all intermediate iterations)
    const iterations = allIterations.filter(it => it.iteration === latestIteration);

    // Parse final resolution from model file
    let finalResolution = null;
    if (modelFiles.length > 0) {
      try {
        const starData = await parseStarFile(path.join(outputDir, modelFiles[modelFiles.length - 1]));
        const general = starData.model_general || starData.data_model_general || [];
        if (general.length > 0 && general[0].rlnCurrentResolution) {
          finalResolution = parseFloat(general[0].rlnCurrentResolution);
        }
      } catch (e) {
        // Skip
      }
    }

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      output_dir: outputDir,
      total_iterations: uniqueIterations.length,
      latest_iteration: latestIteration,
      symmetry: job.parameters?.symmetry || job.parameters?.Symmetry || 'C1',
      mask_diameter: job.parameters?.maskDiameter || job.parameters?.particleDiameter || 200,
      final_resolution: finalResolution,
      // Only provide iteration numbers for dropdown, not full file list
      unique_iterations: uniqueIterations,
      has_half_maps: allIterations.some(it => it.is_half),
      has_output: modelFiles.length > 0
    };

    res.json({ success: true, status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] AutoRefine results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get AutoRefine results' });
  }
};

/**
 * AutoRefine MRC (legacy endpoint)
 * GET /autorefine/mrc/?job_id=xxx&iteration=xxx&type=half1|half2|full&token=xxx
 * GET /autorefine/mrc/?file_path=xxx&token=xxx (for Molstar direct loading)
 */
exports.getAutoRefineMrc = async (req, res) => {
  try {
    // Support direct file path loading (for Molstar)
    const filePath = req.query.file_path;
    if (filePath) {
      if (!filePath.endsWith('.mrc')) {
        return res.status(400).json({ status: 'error', message: 'Invalid file type' });
      }
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ status: 'error', message: 'MRC file not found' });
      }
      const filename = path.basename(filePath);
      res.setHeader('Content-Type', 'application/octet-stream');
      res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
      res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
      return fs.createReadStream(filePath).pipe(res);
    }

    const jobId = req.query.job_id;
    const iteration = req.query.iteration || 'latest';
    const mapType = req.query.type || 'full';

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find all MRC files
    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+.*\.mrc$/) || f.match(/_half\d+.*\.mrc$/))
      : [];

    // Parse iteration info from files
    const iterations = mrcFiles.map(f => {
      const iterMatch = f.match(/_it(\d+)_/);
      const halfMatch = f.match(/_half(\d+)_/);
      if (iterMatch) {
        return {
          iteration: parseInt(iterMatch[1]),
          half: halfMatch ? parseInt(halfMatch[1]) : 0,
          filename: f,
          is_half: !!halfMatch
        };
      }
      return null;
    }).filter(Boolean);

    if (iterations.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No MRC files found' });
    }

    // Select target iteration
    let targetIter;
    if (iteration === 'latest') {
      targetIter = Math.max(...iterations.map(it => it.iteration));
    } else {
      targetIter = parseInt(iteration);
    }

    // Select map based on type
    let selected;
    if (mapType === 'half1') {
      selected = iterations.find(it => it.iteration === targetIter && it.half === 1);
    } else if (mapType === 'half2') {
      selected = iterations.find(it => it.iteration === targetIter && it.half === 2);
    } else {
      // Full map (non-half)
      selected = iterations.find(it => it.iteration === targetIter && !it.is_half);
    }

    // Fallback to any file from target iteration
    if (!selected) {
      selected = iterations.find(it => it.iteration === targetIter);
    }

    if (!selected) {
      return res.status(404).json({ status: 'error', message: `Iteration ${targetIter} not found` });
    }

    const mrcPath = path.join(outputDir, selected.filename);
    if (!fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: 'MRC file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${selected.filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] AutoRefine MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get MRC file' });
  }
};

/**
 * AutoRefine live stats (legacy endpoint)
 * GET /autorefine/live-stats/?job_id=xxx
 */
exports.getAutoRefineLiveStats = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Support both run_it* and _it* patterns
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    // Extract iteration numbers
    const iterNums = modelFiles.map(f => {
      const match = f.match(/_it(\d+)_model\.star$/);
      return match ? parseInt(match[1]) : 0;
    }).filter(n => n > 0);

    const currentIteration = iterNums.length > 0 ? Math.max(...iterNums) : 0;

    // Parse final resolution from latest model file
    let finalResolution = null;
    if (modelFiles.length > 0) {
      try {
        const starData = await parseStarFile(path.join(outputDir, modelFiles[modelFiles.length - 1]));
        const general = starData.model_general || starData.data_model_general || [];
        if (general.length > 0 && general[0].rlnCurrentResolution) {
          finalResolution = parseFloat(general[0].rlnCurrentResolution);
        }
      } catch (e) {
        // Skip
      }
    }

    // Update pipeline_stats.iteration_count in DB so stats cards stay current
    if (currentIteration > 0 && currentIteration !== (job.pipeline_stats?.iteration_count || 0)) {
      Job.updateOne({ id: job.id }, { 'pipeline_stats.iteration_count': currentIteration }).catch(() => {});
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: job.id,
        job_status: job.status,
        current_iteration: currentIteration,
        total_iterations: iterNums.length,
        has_model: modelFiles.length > 0,
        iterations_completed: iterNums,
        final_resolution: finalResolution
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] AutoRefine live stats error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get AutoRefine live stats' });
  }
};

/**
 * AutoRefine FSC curve
 * GET /autorefine/fsc/?job_id=xxx&iteration=latest
 *
 * Extracts gold-standard FSC from the model.star file's data_model_class_1 block.
 */
exports.getAutoRefineFsc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find model files
    const modelFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.match(/_it\d+_model\.star$/)).sort()
      : [];

    if (modelFiles.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No model files found' });
    }

    // Use requested iteration or latest
    const reqIter = req.query.iteration;
    let modelFile;
    if (reqIter && reqIter !== 'latest') {
      const padded = String(reqIter).padStart(3, '0');
      modelFile = modelFiles.find(f => f.includes(`_it${padded}_`));
    }
    if (!modelFile) {
      modelFile = modelFiles[modelFiles.length - 1];
    }

    const modelPath = path.join(outputDir, modelFile);
    const starData = await parseStarFile(modelPath);

    // FSC data lives in model_class_1 block (for single-class AutoRefine)
    const fscBlock = starData.model_class_1 || starData.data_model_class_1 || {};
    const fscRows = fscBlock.rows || (Array.isArray(fscBlock) ? fscBlock : []);

    if (fscRows.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No FSC data in model file' });
    }

    const fscCurve = fscRows
      .filter(row => row.rlnResolution && parseFloat(row.rlnResolution) > 0)
      .map(row => ({
        resolution: parseFloat(row.rlnResolution) || 0,
        fsc_corrected: parseFloat(row.rlnGoldStandardFsc) || 0,
      }));

    // Get resolution from model_general block
    const general = starData.model_general || starData.data_model_general || [];
    const goldStdResolution = general.length > 0 && general[0].rlnCurrentResolution
      ? parseFloat(general[0].rlnCurrentResolution) : null;

    // Extract iteration number from filename
    const iterMatch = modelFile.match(/_it(\d+)_/);
    const iteration = iterMatch ? parseInt(iterMatch[1]) : 0;

    res.json({
      success: true,
      status: 'success',
      data: {
        fsc_curve: fscCurve,
        iteration,
        gold_standard_resolution: goldStdResolution
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] AutoRefine FSC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get FSC data' });
  }
};

// ============================================
// MASKCREATE LEGACY ENDPOINTS
// ============================================

/**
 * MaskCreate results (legacy endpoint)
 * GET /maskcreate/results/?job_id=xxx
 */
exports.getMaskCreateResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const maskFile = path.join(outputDir, 'mask.mrc');
    const hasMask = fs.existsSync(maskFile);

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      has_mask: hasMask,
      initial_threshold: job.parameters?.initialThreshold || 0.02,
      extend_binary_mask: job.parameters?.extendBinaryMask || 3,
      soft_edge_width: job.parameters?.softEdgeWidth || 6,
      lowpass_filter: job.parameters?.lowpassFilter || 15,
      input_map: job.parameters?.inputMap || null
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] MaskCreate results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get MaskCreate results' });
  }
};

/**
 * MaskCreate MRC (legacy endpoint)
 * GET /maskcreate/mrc/?job_id=xxx
 */
exports.getMaskCreateMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const filePath = req.query.file_path;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;

    let mrcPath;
    let filename = 'mask.mrc';

    if (filePath) {
      // Serve upstream source map (e.g., from PostProcess/Refine3D)
      // Resolve relative paths against the project root (2 levels up from output_file_path)
      if (path.isAbsolute(filePath)) {
        mrcPath = filePath;
      } else {
        const projectRoot = path.resolve(job.output_file_path, '..', '..');
        mrcPath = path.join(projectRoot, filePath);
      }
      // Security: ensure resolved path is within the project root
      const projectRoot = path.resolve(job.output_file_path, '..', '..');
      const resolvedMrc = path.resolve(mrcPath);
      if (!resolvedMrc.startsWith(projectRoot)) {
        return res.status(403).json({ status: 'error', message: 'Access denied' });
      }
      filename = path.basename(mrcPath);
    } else {
      // Default: serve the mask file
      mrcPath = path.join(job.output_file_path, 'mask.mrc');
    }

    if (!fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: `MRC file not found: ${filename}` });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] MaskCreate MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get mask file' });
  }
};

// ============================================
// CTFREFINE LEGACY ENDPOINTS
// ============================================

/**
 * CTFRefine results (legacy endpoint)
 * GET /ctfrefine/results/?job_id=xxx
 */
exports.getCtfRefineResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'particles_ctf_refine.star');
    const params = job.parameters || {};

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      particle_count: 0,
      beam_tilt_x: null,
      beam_tilt_y: null,
      defocus_mean: null,
      defocus_min: null,
      defocus_max: null,
      defocus_std: null,
      astigmatism_mean: null,
      odd_zernike: [],
      even_zernike: [],
      defocus_histogram: null,
      astigmatism_histogram: null,
      has_output: fs.existsSync(starPath),
      has_pdf: fs.existsSync(path.join(outputDir, 'logfile.pdf')),
      has_aberration_plots: false,
      // Refinement settings from job parameters
      do_defocus_refine: params.ctfParameter === 'Yes' || params.doDefocusRefine === 'Yes' || params.ctfParameter === true,
      do_beam_tilt: params.estimateBeamtilt === 'Yes' || params.doBeamTilt === 'Yes' || params.estimateBeamtilt === true,
      do_trefoil: params.estimateTreFoil === 'Yes' || params.treFoil === 'Yes' || params.doTrefoil === 'Yes',
      do_4th_order: params.aberrations === 'Yes' || params.do4thOrder === 'Yes' || params.aberrations === true,
      min_res_defocus: parseFloat(params.minResolutionFits) || parseFloat(params.minResDefocus) || 30,
      fit_defocus: params.fitDefocus || 'No',
      fit_astigmatism: params.fitAstigmatism || 'No',
      fit_bfactor: params.fitBFactor || 'No',
      fit_phase_shift: params.fitPhaseShift || params.phaseShift || 'No',
      // Microscope parameters (from upstream Import)
      voltage: null,
      spherical_aberration: null,
      pixel_size: job.pipeline_stats?.pixel_size || null
    };

    if (fs.existsSync(starPath)) {
      const starData = await parseStarWithCache(job, starPath);
      const particlesBlock = starData.particles || starData.data_particles || {};
      const particles = particlesBlock.rows || particlesBlock || [];
      response.particle_count = particles.length;

      // Extract Zernike polynomials from data_optics block
      const opticsBlock = starData.optics || starData.data_optics || {};
      const opticsRows = opticsBlock.rows || opticsBlock || [];
      if (opticsRows.length > 0) {
        const optics = opticsRows[0];
        if (optics.rlnOddZernike) {
          response.odd_zernike = optics.rlnOddZernike.split(',').map(Number).filter(n => !isNaN(n));
        }
        if (optics.rlnEvenZernike) {
          response.even_zernike = optics.rlnEvenZernike.split(',').map(Number).filter(n => !isNaN(n));
        }
      }
      response.has_aberration_plots = response.odd_zernike.length > 0 || response.even_zernike.length > 0;

      // Calculate defocus/astigmatism statistics and beam tilt
      if (particles.length > 0) {
        let defocusSum = 0;
        let astigSum = 0;
        let beamTiltXSum = 0;
        let beamTiltYSum = 0;
        let defocusMin = Infinity;
        let defocusMax = -Infinity;
        const defocusValues = [];
        const astigValues = [];

        for (const p of particles) {
          const defU = parseFloat(p.rlnDefocusU) || 0;
          const defV = parseFloat(p.rlnDefocusV) || 0;
          const avgDefocus = (defU + defV) / 2;
          const astig = Math.abs(defU - defV);
          defocusSum += avgDefocus;
          astigSum += astig;
          defocusValues.push(avgDefocus);
          astigValues.push(astig);
          if (avgDefocus < defocusMin) defocusMin = avgDefocus;
          if (avgDefocus > defocusMax) defocusMax = avgDefocus;
          beamTiltXSum += parseFloat(p.rlnBeamTiltX) || 0;
          beamTiltYSum += parseFloat(p.rlnBeamTiltY) || 0;
        }

        response.defocus_mean = defocusSum / particles.length;
        response.defocus_min = defocusMin;
        response.defocus_max = defocusMax;
        response.astigmatism_mean = astigSum / particles.length;
        response.beam_tilt_x = beamTiltXSum / particles.length;
        response.beam_tilt_y = beamTiltYSum / particles.length;

        // Standard deviation
        const mean = response.defocus_mean;
        const sqDiffSum = defocusValues.reduce((sum, val) => sum + (val - mean) ** 2, 0);
        response.defocus_std = Math.sqrt(sqDiffSum / particles.length);

        // Build histograms (20 bins) for defocus and astigmatism distributions
        const buildHistogram = (values, numBins = 20) => {
          if (values.length === 0) return null;
          const vMin = Math.min(...values);
          const vMax = Math.max(...values);
          const binWidth = (vMax - vMin) / numBins || 1;
          const counts = Array(numBins).fill(0);
          const labels = [];
          for (let i = 0; i < numBins; i++) {
            labels.push(vMin + binWidth * (i + 0.5));
          }
          for (const v of values) {
            const idx = Math.min(Math.floor((v - vMin) / binWidth), numBins - 1);
            counts[idx]++;
          }
          return { labels, counts, min: vMin, max: vMax };
        };

        response.defocus_histogram = buildHistogram(defocusValues);
        response.astigmatism_histogram = buildHistogram(astigValues);
      }
    }

    // Get microscope parameters from Import job (traverse upstream)
    try {
      let currentJob = job;
      const visited = new Set();
      while (currentJob) {
        if (visited.has(currentJob.id)) break;
        visited.add(currentJob.id);
        if (currentJob.job_type === 'Import') {
          const importParams = currentJob.parameters || {};
          response.voltage = parseFloat(importParams.kV) || null;
          response.spherical_aberration = parseFloat(importParams.spherical) || null;
          break;
        }
        if (currentJob.input_job_ids && currentJob.input_job_ids.length > 0) {
          currentJob = await Job.findOne({ id: currentJob.input_job_ids[0] }).lean();
        } else {
          break;
        }
      }
    } catch (e) {
      logger.warn(`[CTFRefine] Could not get Import parameters: ${e.message}`);
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] CTFRefine results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get CTFRefine results' });
  }
};

// ============================================
// POLISH LEGACY ENDPOINTS
// ============================================

/**
 * Polish results (legacy endpoint)
 * GET /polish/results/?job_id=xxx
 */
exports.getPolishResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'shiny.star');
    const params = job.parameters || {};

    const trainOptimal = params.trainOptimalBfactors === 'Yes' || params.trainOptimalBfactors === true;

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      particle_count: 0,
      has_output: fs.existsSync(starPath),
      // Motion sigma parameters from job settings
      sigma_velocity: parseFloat(params.sigmaVelocity) || 0.2,
      sigma_divergence: parseFloat(params.sigmaDivergence) || 5000,
      sigma_acceleration: parseFloat(params.sigmaAcceleration) || 2,
      train_optimal: trainOptimal,
      // Frame range
      first_frame: parseInt(params.firstMovieFrame) || parseInt(params.firstFrame) || 1,
      last_frame: parseInt(params.lastMovieFrame) || parseInt(params.lastFrame) || -1,
      // B-factor weighting
      perform_bfac_weighting: params.performBfactorWeighting !== 'No' && params.performBfactorWeighting !== false,
      min_res_bfac: parseFloat(params.minResolutionBfac) || 20,
      // Upstream data
      micrographs_processed: 0
    };

    if (fs.existsSync(starPath)) {
      const starData = await parseStarWithCache(job, starPath);
      const particles = starData.particles || starData.data_particles || [];
      response.particle_count = particles.length;
    }

    // Get micrograph count from upstream job
    if (job.input_job_ids && job.input_job_ids.length > 0) {
      try {
        const sourceJob = await Job.findOne({ id: job.input_job_ids[0] }).lean();
        if (sourceJob) {
          response.micrographs_processed = sourceJob.pipeline_stats?.micrograph_count || sourceJob.micrograph_count || 0;
        }
      } catch (e) {
        logger.warn(`[Polish] Could not get upstream micrograph count: ${e.message}`);
      }
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] Polish results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Polish results' });
  }
};

// ============================================
// SUBTRACT ENDPOINTS
// ============================================

/**
 * Subtract results
 * GET /subtract/results/?job_id=xxx
 */
exports.getSubtractResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const starPath = path.join(outputDir, 'particles_subtracted.star');
    const params = job.parameters || {};

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      particle_count: 0,
      particles_before: 0,
      has_output: fs.existsSync(starPath),
      // Operation details from parameters
      is_revert: params.revertToOriginal === 'Yes' || params.revertToOriginal === true,
      new_box_size: parseInt(params.newBoxSize) > 0 ? parseInt(params.newBoxSize) : null,
      output_float16: params.outputInFloat16 === 'Yes' || params.outputInFloat16 === true,
      recenter_on_mask: params.subtracted_images === 'Yes' || params.subtracted_images === true,
      center_coordinates: params.centerCoordinates === 'Yes' || params.centerCoordinates === true
    };

    if (fs.existsSync(starPath)) {
      try {
        const starData = await parseStarWithCache(job, starPath);
        const particles = starData.particles || starData.data_particles || [];
        response.particle_count = particles.length;
      } catch (e) {
        logger.warn(`[Subtract] Could not read particle count from ${starPath}: ${e.message}`);
      }
    }

    // Get input particle count from source job
    if (job.input_job_ids && job.input_job_ids.length > 0) {
      try {
        const sourceJob = await Job.findOne({ id: job.input_job_ids[0] }).lean();
        if (sourceJob) {
          response.particles_before = sourceJob.pipeline_stats?.particle_count || sourceJob.particle_count || 0;
        }
      } catch (e) {
        logger.warn(`[Subtract] Could not get source job particle count: ${e.message}`);
      }
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] Subtract results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get Subtract results' });
  }
};

// ============================================
// JOINSTAR ENDPOINTS
// ============================================

/**
 * JoinStar results
 * GET /joinstar/results/?job_id=xxx
 */
exports.getJoinStarResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const params = job.parameters || {};

    const particlesStarPath = path.join(outputDir, 'join_particles.star');
    const micrographsStarPath = path.join(outputDir, 'join_micrographs.star');
    const moviesStarPath = path.join(outputDir, 'join_movies.star');

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      // Combining types
      combine_particles: params.combineParticles === 'Yes' || params.combineParticles === true,
      combine_micrographs: params.combineMicrographs === 'Yes' || params.combineMicrographs === true,
      combine_movies: params.combineMovies === 'Yes' || params.combineMovies === true,
      // Output counts
      particle_count: 0,
      micrograph_count: 0,
      movie_count: 0,
      has_particles_output: fs.existsSync(particlesStarPath),
      has_micrographs_output: fs.existsSync(micrographsStarPath),
      has_movies_output: fs.existsSync(moviesStarPath)
    };

    // Count particles from join_particles.star
    if (fs.existsSync(particlesStarPath)) {
      try {
        const starData = await parseStarWithCache(job, particlesStarPath);
        const particles = starData.particles || starData.data_particles || [];
        response.particle_count = particles.length;
      } catch (e) {
        logger.warn(`[JoinStar] Could not read particle count: ${e.message}`);
      }
    }

    // Count micrographs from join_micrographs.star
    if (fs.existsSync(micrographsStarPath)) {
      try {
        const { countStarFileEntries } = require('../utils/pipelineMetadata');
        response.micrograph_count = await countStarFileEntries(micrographsStarPath);
      } catch (e) {
        logger.warn(`[JoinStar] Could not read micrograph count: ${e.message}`);
      }
    }

    // Count movies from join_movies.star
    if (fs.existsSync(moviesStarPath)) {
      try {
        const { countStarFileEntries } = require('../utils/pipelineMetadata');
        response.movie_count = await countStarFileEntries(moviesStarPath);
      } catch (e) {
        logger.warn(`[JoinStar] Could not read movie count: ${e.message}`);
      }
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] JoinStar results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get JoinStar results' });
  }
};

// ============================================
// POSTPROCESS LEGACY ENDPOINTS
// ============================================

/**
 * PostProcess results (legacy endpoint)
 * GET /postprocess/results/?job_id=xxx
 */
exports.getPostProcessResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const postprocessStar = path.join(outputDir, 'postprocess.star');
    const maskedMap = path.join(outputDir, 'postprocess_masked.mrc');
    const unmaskedMap = path.join(outputDir, 'postprocess.mrc');
    const fscData = path.join(outputDir, 'postprocess_fsc.star');

    let finalResolution = null;
    let bfactor = null;

    if (fs.existsSync(postprocessStar)) {
      try {
        const starData = await parseStarFile(postprocessStar);
        const generalBlock = starData.general || starData.data_general;
        const generalRows = generalBlock?.rows || generalBlock || [];
        if (generalRows.length > 0) {
          finalResolution = parseFloat(generalRows[0].rlnFinalResolution) || null;
          bfactor = parseFloat(generalRows[0].rlnBfactorUsedForSharpening) || null;
        }
      } catch (e) {
        // Skip
      }
    }

    // Get job parameters for display
    const params = job.parameters || {};

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      final_resolution: finalResolution,
      bfactor: bfactor,
      has_masked_map: fs.existsSync(maskedMap),
      has_unmasked_map: fs.existsSync(unmaskedMap),
      has_fsc: fs.existsSync(fscData),
      angpix: params.calibratedPixelSize || params.angpix || params.pixelSize || 1.0,
      auto_mask: params.autoMask ? 'Yes' : 'No',
      auto_bfactor: params.autoB !== false ? 'Yes' : 'No'
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] PostProcess results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get PostProcess results' });
  }
};

/**
 * PostProcess MRC (legacy endpoint)
 * GET /postprocess/mrc/?job_id=xxx&type=masked|unmasked
 */
exports.getPostProcessMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const mapType = req.query.type || 'masked';

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const mrcPath = mapType === 'masked'
      ? path.join(job.output_file_path, 'postprocess_masked.mrc')
      : path.join(job.output_file_path, 'postprocess.mrc');

    if (!fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: 'Map file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(mrcPath)}"`);
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] PostProcess MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get map file' });
  }
};

/**
 * PostProcess FSC (legacy endpoint)
 * GET /postprocess/fsc/?job_id=xxx
 */
exports.getPostProcessFsc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const fscPath = path.join(job.output_file_path, 'postprocess_fsc.star');

    if (!fs.existsSync(fscPath)) {
      return res.status(404).json({ status: 'error', message: 'FSC data not found' });
    }

    const starData = await parseStarFile(fscPath);
    const fscData = starData.fsc || starData.data_fsc || [];

    const fscCurve = fscData.map(row => ({
      resolution: parseFloat(row.rlnAngstromResolution) || 0,
      fsc_unmasked: parseFloat(row.rlnFourierShellCorrelationUnmaskedMaps) || 0,
      fsc_masked: parseFloat(row.rlnFourierShellCorrelationMaskedMaps) || 0,
      fsc_corrected: parseFloat(row.rlnFourierShellCorrelationCorrected) || 0
    }));

    res.json({
      success: true,
      status: 'success',
      data: {
        fsc_curve: fscCurve
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] PostProcess FSC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get FSC data' });
  }
};

// ============================================
// LOCALRES LEGACY ENDPOINTS
// ============================================

/**
 * LocalRes results (legacy endpoint)
 * GET /localres/results/?job_id=xxx
 */
exports.getLocalResResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const localResMap = path.join(outputDir, 'relion_locres.mrc');
    const filteredMap = path.join(outputDir, 'relion_locres_filtered.mrc');

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      has_locres_map: fs.existsSync(localResMap),
      has_locres_filtered: fs.existsSync(filteredMap)
    };

    // Parse resolution statistics from run.out
    const runOutPath = path.join(outputDir, 'run.out');
    if (fs.existsSync(runOutPath)) {
      try {
        const runOut = fs.readFileSync(runOutPath, 'utf-8');
        // Parse: "Min: 3.30115 Q1: 3.79917 Median: 4.02245 Q3: 4.28752 Max: 5.59916"
        const statsMatch = runOut.match(/Min:\s+([\d.]+)\s+Q1:\s+[\d.]+\s+Median:\s+[\d.]+\s+Q3:\s+[\d.]+\s+Max:\s+([\d.]+)/);
        if (statsMatch) {
          response.min_resolution = parseFloat(statsMatch[1]);
          response.max_resolution = parseFloat(statsMatch[2]);
        }
        // Parse: "Mean: 4.05659 Std: 0.348411"
        const meanMatch = runOut.match(/Mean:\s+([\d.]+)/);
        if (meanMatch) {
          response.mean_resolution = parseFloat(meanMatch[1]);
        }
      } catch (parseErr) {
        logger.debug(`[Dashboard] Could not parse LocalRes run.out: ${parseErr.message}`);
      }
    }

    // Extract b-factor and pixel size from job parameters (user-supplied values)
    const params = job.parameters || {};
    response.b_factor = params.bFactor || params.b_factor || null;
    response.pixel_size = params.calibratedPixelSize || params.angpix || null;

    // Fall back to parsing from command if not in parameters
    if (response.b_factor == null || response.pixel_size == null) {
      const cmd = job.command || '';
      if (response.b_factor == null) {
        const bfacMatch = cmd.match(/--adhoc_bfac\s+(-?[\d.]+)/);
        if (bfacMatch) response.b_factor = parseFloat(bfacMatch[1]);
      }
      if (response.pixel_size == null) {
        const angpixMatch = cmd.match(/--angpix\s+([\d.]+)/);
        if (angpixMatch) response.pixel_size = parseFloat(angpixMatch[1]);
      }
    }

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] LocalRes results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get LocalRes results' });
  }
};

/**
 * LocalRes MRC (legacy endpoint)
 * GET /localres/mrc/?job_id=xxx&type=localres|filtered
 */
exports.getLocalResMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const mapType = req.query.type || 'localres';

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const mrcPath = mapType === 'filtered'
      ? path.join(job.output_file_path, 'relion_locres_filtered.mrc')
      : path.join(job.output_file_path, 'relion_locres.mrc');

    if (!fs.existsSync(mrcPath)) {
      return res.status(404).json({ status: 'error', message: 'Map file not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(mrcPath)}"`);
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] LocalRes MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get map file' });
  }
};

// ============================================
// MODELANGELO LEGACY ENDPOINTS
// ============================================

/**
 * ModelAngelo results (legacy endpoint)
 * GET /modelangelo/results/?job_id=xxx
 */
exports.getModelAngeloResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Look for output files
    const pdbFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.pdb'))
      : [];
    const cifFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.cif'))
      : [];

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      has_pdb: pdbFiles.length > 0,
      has_cif: cifFiles.length > 0,
      num_chains: 0,
      num_residues: 0,
      has_protein_fasta: !!job.parameters?.proteinFasta,
      has_dna_fasta: !!job.parameters?.dnaFasta,
      has_rna_fasta: !!job.parameters?.rnaFasta,
      perform_hmmer: job.parameters?.performHmmer || 'No',
      has_hmmer_results: false
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] ModelAngelo results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get ModelAngelo results' });
  }
};

/**
 * ModelAngelo PDB download (legacy endpoint)
 * GET /modelangelo/pdb/?job_id=xxx
 */
exports.getModelAngeloPdb = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const pdbFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.pdb'))
      : [];

    if (pdbFiles.length === 0) {
      return res.status(404).json({ status: 'error', message: 'PDB file not found' });
    }

    const pdbPath = path.join(outputDir, pdbFiles[0]);
    res.setHeader('Content-Type', 'chemical/x-pdb');
    res.setHeader('Content-Disposition', `attachment; filename="${pdbFiles[0]}"`);
    fs.createReadStream(pdbPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] ModelAngelo PDB error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get PDB file' });
  }
};

// ============================================
// DYNAMIGHT LEGACY ENDPOINTS
// ============================================

/**
 * DynaMight results (legacy endpoint)
 * GET /dynamight/results/?job_id=xxx
 */
exports.getDynamightResults = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.mrc'))
      : [];

    const movieFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.mp4') || f.endsWith('.gif'))
      : [];

    const response = {
      id: job.id,
      job_name: job.job_name,
      job_status: job.status,
      command: job.command,
      latest_iteration: 0,
      num_iterations: job.parameters?.numberOfIterations || 0,
      num_particles: 0,
      has_output: mrcFiles.length > 0,
      has_movies: movieFiles.length > 0,
      mrc_files: mrcFiles
    };

    res.json({ success: true,
      status: 'success', data: response });
  } catch (error) {
    logger.error(`[Dashboard] DynaMight results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get DynaMight results' });
  }
};

/**
 * DynaMight MRC (legacy endpoint)
 * GET /dynamight/mrc/?job_id=xxx&iteration=xxx&class=xxx
 */
exports.getDynamightMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    const mrcFiles = fs.existsSync(outputDir)
      ? fs.readdirSync(outputDir).filter(f => f.endsWith('.mrc')).sort()
      : [];

    if (mrcFiles.length === 0) {
      return res.status(404).json({ status: 'error', message: 'MRC file not found' });
    }

    const mrcPath = path.join(outputDir, mrcFiles[mrcFiles.length - 1]);
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${path.basename(mrcPath)}"`);
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error(`[Dashboard] DynaMight MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get MRC file' });
  }
};

// ============================================
// IMPORT LEGACY ENDPOINTS
// ============================================

/**
 * Import results (legacy endpoint)
 * GET /api/import/results/:jobId/
 *
 * Handles both movies/micrographs import and other node types (3D ref, mask, coords, etc.)
 */
exports.getImportResults = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectPath = path.dirname(path.dirname(outputDir));

    // Node type info for "other" imports
    const nodeTypeInfo = {
      ref3d: { label: '3D Reference', output_file: 'ref3d.mrc' },
      mask: { label: '3D Mask', output_file: 'mask.mrc' },
      halfmap: { label: 'Unfiltered Half-map', output_file: 'halfmap.mrc' },
      refs2d: { label: '2D References', output_file: 'class_averages.star' },
      coords: { label: 'Particle Coordinates', output_file: 'coords_suffix_autopick.star' }
    };

    // Detect import mode from command
    const command = job.command || '';
    let importMode = 'movies';

    if (command.includes('--do_other')) {
      importMode = 'other';
    } else {
      // Check for other node type output files
      for (const [nodeType, info] of Object.entries(nodeTypeInfo)) {
        const outputFile = path.join(outputDir, info.output_file);
        if (fs.existsSync(outputFile) && !['movies.star', 'micrographs.star'].includes(info.output_file)) {
          importMode = 'other';
          break;
        }
      }
    }

    // Handle "other" node type imports (3D ref, mask, coords, etc.)
    if (importMode === 'other') {
      let nodeType = null;
      let nodeLabel = 'Unknown';
      let importedFile = null;

      // Parse node type from command
      const nodeTypeMatch = command.match(/--node_type\s+(\w+)/);
      if (nodeTypeMatch) {
        nodeType = nodeTypeMatch[1];
        if (nodeTypeInfo[nodeType]) {
          nodeLabel = nodeTypeInfo[nodeType].label;
          const outputFile = path.join(outputDir, nodeTypeInfo[nodeType].output_file);
          if (fs.existsSync(outputFile)) {
            importedFile = outputFile;
          }
        }
      }

      // Search for expected output files
      if (!importedFile) {
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

      // Final fallback: find ANY .mrc file in the directory
      if (!importedFile && fs.existsSync(outputDir)) {
        const files = fs.readdirSync(outputDir);
        for (const fname of files) {
          if (fname.endsWith('.mrc')) {
            importedFile = path.join(outputDir, fname);
            if (!nodeType) {
              nodeType = 'ref3d';
              nodeLabel = '3D Reference';
            }
            break;
          }
        }
      }

      // Get file info
      let fileInfo = {};
      if (importedFile && fs.existsSync(importedFile)) {
        const stats = fs.statSync(importedFile);
        fileInfo = {
          name: path.basename(importedFile),
          path: importedFile,
          relative_path: path.relative(projectPath, importedFile),
          size: stats.size,
          exists: true
        };

        // For MRC files, try to get volume dimensions
        if (importedFile.endsWith('.mrc')) {
          try {
            const { getMrcInfo } = require('../utils/mrcParser');
            const mrcInfo = getMrcInfo(importedFile);
            if (mrcInfo) {
              fileInfo.dimensions = {
                nx: mrcInfo.width,
                ny: mrcInfo.height,
                nz: mrcInfo.num_frames
              };
              fileInfo.voxel_size = mrcInfo.pixelSize;
            }
          } catch (e) {
            logger.warn(`[Import] Could not read MRC header: ${e.message}`);
          }
        }
      }

      return res.json({
        success: true,
      status: 'success',
        data: {
          job_id: job.id,
          job_name: job.job_name,
          job_status: job.status,
          command: command,
          output_dir: outputDir,
          import_mode: 'other',
          node_type: nodeType,
          node_label: nodeLabel,
          imported_file: fileInfo,
          summary: {
            total_imported: importedFile ? 1 : 0,
            displayed: importedFile ? 1 : 0,
            type: nodeType || 'unknown',
            label: nodeLabel
          }
        }
      });
    }

    // Handle movies/micrographs import
    let starFile = null;
    for (const filename of ['movies.star', 'micrographs.star']) {
      const potentialPath = path.join(outputDir, filename);
      if (fs.existsSync(potentialPath)) {
        starFile = potentialPath;
        break;
      }
    }

    let importedFiles = [];
    let totalFiles = 0;

    if (starFile) {
      const starData = await parseStarWithCache(job, starFile);

      // Get files from the appropriate block
      const movies = starData.movies?.rows || starData.movies ||
                     starData.micrographs?.rows || starData.micrographs ||
                     starData.data_movies || [];

      totalFiles = movies.length;
      importedFiles = movies.slice(0, 10).map(m => ({
        movie_name: m.rlnMicrographMovieName || m._rlnMicrographMovieName,
        micrograph_name: m.rlnMicrographName || m._rlnMicrographName,
        name: path.basename(m.rlnMicrographMovieName || m.rlnMicrographName || m._rlnMicrographMovieName || m._rlnMicrographName || ''),
        optics_group: m.rlnOpticsGroup || m._rlnOpticsGroup
      }));
    }

    // Detect import type
    const importType = starFile && starFile.includes('movies') ? 'movies' : 'micrographs';

    // Check for existing thumbnails
    const thumbnailsDir = path.join(outputDir, 'thumbnails');
    let thumbnailsCount = 0;
    if (fs.existsSync(thumbnailsDir)) {
      thumbnailsCount = fs.readdirSync(thumbnailsDir).filter(f => f.endsWith('.png')).length;
    }

    // Get import parameters from job parameters
    const params = job.parameters || {};
    const angpix = params.angpix;
    const kV = params.kV;
    const cs = params.spherical || params.cs;

    res.json({
      success: true,
      status: 'success',
      data: {
        job_id: job.id,
        job_name: job.job_name,
        job_status: job.status,
        command: command,
        import_mode: importType,
        import_type: importType,
        star_file: starFile,
        imported_count: importedFiles.length,
        imported_files: importedFiles,
        thumbnails_count: thumbnailsCount,
        max_display: 10,
        summary: {
          total_imported: totalFiles,
          displayed: importedFiles.length,
          type: importType
        },
        angpix: angpix,
        kV: kV,
        cs: cs
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Import results error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get import results' });
  }
};

/**
 * Get individual 2D class images with metadata
 * GET /class2d/individual-images/?job_id=<id>&iteration=<iter>
 */
exports.getClass2dIndividualImages = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.query.job_id;
    const projectId = req.query.project_id;
    const jobPath = req.query.job_path;
    const iteration = req.query.iteration || 'latest';

    let job = null;
    let outputDir = null;

    // Method 1: Look up by job_id
    if (jobId) {
      const result = await getJobWithAccess(jobId, req.user.id);
      if (result.error) {
        return res.status(result.status).json({ status: 'error', message: result.error });
      }
      job = result.job;
      outputDir = job.output_file_path;
    }
    // Method 2: Look up by project_id + job_path
    else if (projectId && jobPath) {
      const Project = require('../models/Project');
      const project = await Project.findOne({ id: projectId });
      if (!project) {
        return res.status(404).json({ status: 'error', message: 'Project not found' });
      }
      const projectPath = path.join(process.env.ROOT_PATH || '/shared/data', project.folder_name || project.project_name);
      const pathParts = jobPath.split('/');
      if (pathParts.length >= 2) {
        outputDir = path.join(projectPath, pathParts[0], pathParts[1]);

        // Try to find job in database
        const Job = require('../models/Job');
        job = await Job.findOne({ project_id: projectId, job_name: pathParts[1] });
      }
    } else {
      return res.status(400).json({ status: 'error', message: 'Either job_id or (project_id + job_path) is required' });
    }

    if (!outputDir || !fs.existsSync(outputDir)) {
      return res.status(404).json({ status: 'error', message: 'Output directory not found' });
    }

    // Find iteration files (2D: mrcs stacks)
    const patterns2d = [
      path.join(outputDir, '*_it*_classes.mrcs'),
      path.join(outputDir, '_it*_classes.mrcs'),
    ];

    let matches = [];
    for (const pattern of patterns2d) {
      matches.push(...glob.sync(pattern));
    }

    let iterations = [];
    let is3d = false;

    // Parse 2D iterations
    for (const match of matches) {
      const basename = path.basename(match);
      const iterMatch = basename.match(/_it(\d+)_classes\.mrcs$/);
      if (iterMatch) {
        const iterNum = parseInt(iterMatch[1], 10);
        iterations.push({
          iteration: iterNum,
          classesFile: match,
          modelFile: match.replace('_classes.mrcs', '_model.star'),
          dataFile: match.replace('_classes.mrcs', '_data.star'),
          is3d: false,
        });
      }
    }

    // If no 2D files, try 3D class files
    if (iterations.length === 0) {
      const patterns3d = [
        path.join(outputDir, 'run_it*_class*.mrc'),
        path.join(outputDir, '_it*_class*.mrc'),
        path.join(outputDir, '*_it*_class*.mrc'),
      ];

      const matches3dSet = new Set();
      for (const pattern of patterns3d) {
        const found = glob.sync(pattern);
        found.filter(f => !f.includes('half')).forEach(f => matches3dSet.add(f));
      }
      const matches3d = [...matches3dSet];

      // Group by iteration
      const iterClasses = {};
      for (const match of matches3d) {
        const basename = path.basename(match);
        const iterMatch = basename.match(/_it(\d+)_class(\d+)\.mrc$/);
        if (iterMatch) {
          const iterNum = parseInt(iterMatch[1], 10);
          const classNum = parseInt(iterMatch[2], 10);
          if (!iterClasses[iterNum]) iterClasses[iterNum] = [];
          iterClasses[iterNum].push({ classNum, filePath: match });
        }
      }

      for (const [iterNum, classFiles] of Object.entries(iterClasses)) {
        const modelPattern = path.join(outputDir, `*_it${String(iterNum).padStart(3, '0')}_model.star`);
        const dataPattern = path.join(outputDir, `*_it${String(iterNum).padStart(3, '0')}_data.star`);
        const modelFiles = glob.sync(modelPattern);
        const dataFiles = glob.sync(dataPattern);

        iterations.push({
          iteration: parseInt(iterNum),
          classFiles: classFiles.sort((a, b) => a.classNum - b.classNum),
          modelFile: modelFiles[0] || null,
          dataFile: dataFiles[0] || null,
          is3d: true,
        });
      }
      is3d = true;
    }

    iterations.sort((a, b) => a.iteration - b.iteration);

    if (iterations.length === 0) {
      return res.status(404).json({ status: 'error', message: 'No class files found' });
    }

    // Select iteration
    let selected;
    if (iteration === 'latest') {
      selected = iterations[iterations.length - 1];
    } else {
      const iterNum = parseInt(iteration, 10);
      selected = iterations.find(it => it.iteration === iterNum);
      if (!selected) {
        return res.status(404).json({ status: 'error', message: `Iteration ${iterNum} not found` });
      }
    }

    // Parse model.star for class metadata
    const parseModelStar = (modelPath) => {
      const classes = [];
      if (!modelPath || !fs.existsSync(modelPath)) return classes;

      const content = fs.readFileSync(modelPath, 'utf8');
      if (!content.includes('data_model_classes')) return classes;

      const blocks = content.split(/\n(?=data_)/);
      for (const block of blocks) {
        if (!block.includes('data_model_classes')) continue;

        const lines = block.trim().split('\n');
        const headers = {};
        let headerIdx = 0;

        for (let i = 0; i < lines.length; i++) {
          const line = lines[i];
          if (line.startsWith('_rln')) {
            const colMatch = line.match(/(_rln\w+)\s+#(\d+)/);
            if (colMatch) {
              headers[colMatch[1]] = parseInt(colMatch[2], 10) - 1;
              headerIdx = i;
            }
          }
        }

        for (let i = headerIdx + 1; i < lines.length; i++) {
          const line = lines[i].trim();
          if (!line || line.startsWith('#') || line.startsWith('_') || line.startsWith('loop')) continue;

          const parts = line.split(/\s+/);
          if (parts.length < 2) continue;

          const refImage = parts[headers['_rlnReferenceImage'] || 0];
          const classDistIdx = headers['_rlnClassDistribution'] || 3;
          const estResIdx = headers['_rlnEstimatedResolution'] || 6;

          let classDist = classDistIdx < parts.length ? parseFloat(parts[classDistIdx]) : 0;
          let estRes = '_rlnEstimatedResolution' in headers && estResIdx < parts.length ? parseFloat(parts[estResIdx]) : 999;

          // Handle NaN
          if (isNaN(classDist)) classDist = 0;
          if (isNaN(estRes)) estRes = 999;

          // Parse class number from reference image path
          let classNum = null;
          const match2d = refImage.match(/^(\d+)@/);
          const match3d = refImage.match(/_class(\d+)\.mrc$/);
          if (match2d) classNum = parseInt(match2d[1], 10);
          else if (match3d) classNum = parseInt(match3d[1], 10);

          if (classNum !== null) {
            classes.push({
              classNumber: classNum,
              distribution: classDist,
              estimatedResolution: estRes,
              particleFraction: Math.round(classDist * 10000) / 100,
            });
          }
        }
        break;
      }
      return classes;
    };

    const classInfo = parseModelStar(selected.modelFile);
    logger.info(`[Class2D] Model file: ${selected.modelFile}, exists: ${fs.existsSync(selected.modelFile)}, parsed classes: ${classInfo.length}`);
    if (classInfo.length > 0) {
      logger.info(`[Class2D] First class info: ${JSON.stringify(classInfo[0])}`);
    }
    const { readMrcFrame, normalizeWithPercentile, getOrthogonalSlices } = require('../utils/mrcParser');
    const sharp = require('sharp');

    const classesData = [];

    // Helper to convert a slice/projection to base64 PNG thumbnail
    // blurSigma: Gaussian low-pass filter for 3D projections (smooths noise)
    const sliceToPngBase64 = async (sliceData, width, height, maxSize = 128, blurSigma = 0) => {
      const uint8Data = normalizeWithPercentile(sliceData, 1, 99);
      let image = sharp(uint8Data, { raw: { width, height, channels: 1 } });
      if (blurSigma > 0) {
        image = image.blur(blurSigma);
      }
      if (width > maxSize || height > maxSize) {
        image = image.resize(maxSize, maxSize, { fit: 'inside' });
      }
      const pngBuffer = await image.png().toBuffer();
      return `data:image/png;base64,${pngBuffer.toString('base64')}`;
    };

    if (selected.is3d) {
      // 3D: Extract 3 orthogonal central slices (XY, XZ, YZ) per class
      for (const classFile of selected.classFiles) {
        try {
          const slices = getOrthogonalSlices(classFile.filePath);
          if (!slices) continue;

          // Apply Gaussian low-pass filter (sigma ~1.5) for smooth, clean projections
          const blur = 1.5;
          const [imageXY, imageXZ, imageYZ] = await Promise.all([
            sliceToPngBase64(slices.xy.data, slices.xy.width, slices.xy.height, 128, blur),
            sliceToPngBase64(slices.xz.data, slices.xz.width, slices.xz.height, 128, blur),
            sliceToPngBase64(slices.yz.data, slices.yz.width, slices.yz.height, 128, blur),
          ]);

          const info2 = classInfo.find(c => c.classNumber === classFile.classNum);
          classesData.push({
            class_number: classFile.classNum,
            image: imageXY,
            image_xz: imageXZ,
            image_yz: imageYZ,
            mrc_path: classFile.filePath,
            particle_fraction: info2?.particleFraction || 0,
            estimated_resolution: info2?.estimatedResolution || 999,
            distribution: info2?.distribution || 0,
          });
        } catch (e) {
          logger.warn(`[Class2D] Error reading 3D class ${classFile.classNum}: ${e.message}`);
        }
      }
    } else {
      // 2D: Read MRCS stack
      const mrcsPath = selected.classesFile;
      const { getMrcInfo } = require('../utils/mrcParser');
      const info = getMrcInfo(mrcsPath);
      if (!info) {
        return res.status(500).json({ status: 'error', message: 'Could not read class file' });
      }

      const numClasses = info.num_frames;
      for (let i = 0; i < numClasses; i++) {
        try {
          const frame = readMrcFrame(mrcsPath, i);
          if (!frame) continue;

          const uint8Data = normalizeWithPercentile(frame.data, 1, 99);
          let image = sharp(uint8Data, { raw: { width: frame.width, height: frame.height, channels: 1 } });

          // Resize to thumbnail
          const maxSize = 128;
          if (frame.width > maxSize || frame.height > maxSize) {
            image = image.resize(maxSize, maxSize, { fit: 'inside' });
          }

          const pngBuffer = await image.png().toBuffer();
          const base64 = pngBuffer.toString('base64');

          const info2 = classInfo.find(c => c.classNumber === i + 1);
          classesData.push({
            class_number: i + 1,
            image: `data:image/png;base64,${base64}`,
            particle_fraction: info2?.particleFraction || 0,
            estimated_resolution: info2?.estimatedResolution || 999,
            distribution: info2?.distribution || 0,
          });
        } catch (e) {
          logger.warn(`[Class2D] Error reading class ${i + 1}: ${e.message}`);
        }
      }
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job_id: job ? job.id : null,
        job_name: job ? job.job_name : jobPath,
        iteration: selected.iteration,
        data_star_path: selected.dataFile,
        num_classes: classesData.length,
        is_3d: selected.is3d,
        classes: classesData,
        available_iterations: iterations.map(it => it.iteration),
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Class2D individual images error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get class images' });
  }
};

/**
 * Save particles from selected classes to a new star file
 * POST /class2d/save-selection/
 */
exports.saveSelectedClasses = async (req, res) => {
  try {
    const { project_id, data_star_path, selected_classes, output_job_name } = req.body;

    if (!project_id) {
      return res.status(400).json({ status: 'error', message: 'project_id is required' });
    }
    if (!data_star_path) {
      return res.status(400).json({ status: 'error', message: 'data_star_path is required' });
    }
    if (!selected_classes || selected_classes.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No classes selected' });
    }

    const Project = require('../models/Project');
    const project = await Project.findOne({ id: project_id });
    if (!project) {
      return res.status(404).json({ status: 'error', message: 'Project not found' });
    }

    const projectPath = path.join(process.env.ROOT_PATH || '/shared/data', project.folder_name || project.project_name);

    // Resolve data_star_path
    const fullDataPath = path.isAbsolute(data_star_path) ? data_star_path : path.join(projectPath, data_star_path);

    if (!fs.existsSync(fullDataPath)) {
      return res.status(404).json({ status: 'error', message: `Data file not found: ${data_star_path}` });
    }

    // Parse input star file
    const { parseStarFile, writeStarFile } = require('../utils/starParser');
    const starData = await parseStarFile(fullDataPath);

    // Get particles block
    const particles = starData.particles || starData.data_particles;
    if (!particles || !particles.rows || particles.rows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No particles table found in star file' });
    }

    // Find rlnClassNumber column
    const classCol = particles.columns?.find(c => c.includes('rlnClassNumber'));
    if (!classCol) {
      return res.status(400).json({ status: 'error', message: 'No rlnClassNumber column found' });
    }

    // Filter particles by selected classes
    const selectedSet = new Set(selected_classes.map(c => parseInt(c, 10)));
    const filteredRows = particles.rows.filter(row => {
      const classNum = parseInt(row.rlnClassNumber || row._rlnClassNumber, 10);
      return selectedSet.has(classNum);
    });

    if (filteredRows.length === 0) {
      return res.status(400).json({ status: 'error', message: 'No particles found in selected classes' });
    }

    // Create output directory
    const selectDir = path.join(projectPath, 'Select');
    fs.mkdirSync(selectDir, { recursive: true });

    // Find next job number
    const allJobs = glob.sync(path.join(projectPath, '**/Job*'));
    const jobNumbers = allJobs.map(j => {
      const match = path.basename(j).match(/Job(\d+)/);
      return match ? parseInt(match[1], 10) : 0;
    });
    const nextJobNum = Math.max(0, ...jobNumbers) + 1;
    const outputDirName = `Job${String(nextJobNum).padStart(3, '0')}`;
    const outputDir = path.join(selectDir, outputDirName);
    fs.mkdirSync(outputDir, { recursive: true });

    const outputFile = path.join(outputDir, 'particles.star');

    // Build output star data
    const outputStarData = {};

    // Copy optics block if present
    if (starData.optics) {
      outputStarData.optics = {
        columns: starData.optics.columns || Object.keys(starData.optics.rows?.[0] || {}),
        data: (starData.optics.rows || [starData.optics]).map(row =>
          (outputStarData.optics?.columns || Object.keys(row)).map(col => row[col.replace(/^_?rln/, 'rln').replace(/^_/, '')] ?? '')
        )
      };
    }

    // Build particles output
    const particleCols = particles.columns || Object.keys(filteredRows[0] || {});
    outputStarData.particles = {
      columns: particleCols.map(c => c.startsWith('_') ? c : `_${c}`),
      data: filteredRows.map(row =>
        particleCols.map(col => {
          const key = col.replace(/^_/, '');
          return row[key] ?? row[col] ?? '';
        })
      )
    };

    writeStarFile(outputFile, outputStarData);

    // Get relative path
    const relOutputPath = path.relative(projectPath, outputFile);

    // Extract source job info
    let sourceJobName = null;
    const relDataPath = path.isAbsolute(data_star_path) ? path.relative(projectPath, data_star_path) : data_star_path;
    const pathParts = relDataPath.split('/');
    if (pathParts.length >= 2) {
      sourceJobName = pathParts[1];
    }

    // Create job record
    const Job = require('../models/Job');
    const { v4: uuidv4 } = require('uuid');
    const now = new Date();

    // Inherit pipeline_stats from source job
    let inheritedPixelSize = null;
    let inheritedBoxSize = null;
    let inheritedMicrographCount = 0;
    let sourceJob = null;
    if (sourceJobName) {
      sourceJob = await Job.findOne({ project_id, job_name: sourceJobName }).lean();
      if (sourceJob) {
        const ss = sourceJob.pipeline_stats || {};
        inheritedPixelSize = ss.pixel_size || sourceJob.pixel_size || null;
        inheritedBoxSize = ss.box_size || sourceJob.box_size ||
          sourceJob.parameters?.particleBoxSize || null;
        inheritedMicrographCount = ss.micrograph_count || sourceJob.micrograph_count || 0;

        // If box_size not found, look at upstream jobs (Extract job has it)
        if (!inheritedBoxSize && sourceJob.input_job_ids?.length > 0) {
          for (const upstreamId of sourceJob.input_job_ids) {
            const upstreamJob = await Job.findOne({ id: upstreamId }).lean();
            if (upstreamJob) {
              const us = upstreamJob.pipeline_stats || {};
              inheritedBoxSize = us.box_size || upstreamJob.box_size ||
                upstreamJob.parameters?.particleBoxSize || null;
              if (!inheritedPixelSize) {
                inheritedPixelSize = us.pixel_size || upstreamJob.pixel_size || null;
              }
              if (!inheritedMicrographCount) {
                inheritedMicrographCount = us.micrograph_count || upstreamJob.micrograph_count || 0;
              }
              if (inheritedBoxSize) break;
            }
          }
        }
      }
    }

    const newJob = new Job({
      id: uuidv4(),
      project_id: project_id,
      user_id: req.user.id,
      job_name: outputDirName,
      job_type: 'ManualSelect',
      status: JOB_STATUS.SUCCESS,
      output_file_path: path.join('Select', outputDirName),
      input_job_ids: sourceJob ? [sourceJob.id] : [],
      parameters: {
        source_star_file: data_star_path,
        selected_classes: Array.from(selected_classes),
        num_classes_selected: selected_classes.length,
        source_job_name: sourceJobName,
      },
      output_files: [{
        role: 'particlesStar',
        fileType: 'star',
        fileName: 'particles.star',
        relativePath: relOutputPath,
        entryCount: filteredRows.length,
      }],
      pipeline_stats: {
        pixel_size: inheritedPixelSize,
        micrograph_count: inheritedMicrographCount,
        particle_count: filteredRows.length,
        box_size: inheritedBoxSize,
        resolution: null,
        class_count: 0,
        iteration_count: 0
      },
      start_time: now,
      end_time: now,
      created_at: now,
      updated_at: now
    });

    await newJob.save();

    res.json({
      success: true,
      status: 'success',
      message: `Saved ${filteredRows.length} particles from ${selected_classes.length} classes`,
      data: {
        job_id: newJob.id,
        job_name: outputDirName,
        output_file: relOutputPath,
        num_particles: filteredRows.length,
        selected_classes: Array.from(selected_classes),
        source_job: sourceJobName,
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Save selection error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to save selection' });
  }
};

/**
 * Get 2D slices of 3D initial model
 * GET /initialmodel/slices/?job_id=<id>&iteration=<iter>&axis=<x|y|z>
 */
exports.getInitialModelSlices = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.query.job_id;
    const iteration = req.query.iteration || 'latest';
    const axis = req.query.axis || 'z';

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find iteration MRC files
    const patterns = [
      path.join(outputDir, 'run_it*_class*.mrc'),
      path.join(outputDir, '*_it*_class*.mrc'),
      path.join(outputDir, '_it*_class*.mrc'),
    ];

    let matches = [];
    for (const pattern of patterns) {
      matches.push(...glob.sync(pattern));
    }

    // Parse iteration numbers
    const iterations = [];
    const seen = new Set();
    for (const match of matches) {
      if (seen.has(match)) continue;
      seen.add(match);

      const basename = path.basename(match);
      const iterMatch = basename.match(/_it(\d+)_class(\d+)\.mrc$/);
      if (iterMatch) {
        iterations.push({
          iteration: parseInt(iterMatch[1], 10),
          classNum: parseInt(iterMatch[2], 10),
          file: match,
        });
      }
    }

    if (iterations.length === 0) {
      return res.json({ success: true,
      status: 'success', data: { image: null, message: 'No MRC files found yet' } });
    }

    iterations.sort((a, b) => a.iteration - b.iteration || a.classNum - b.classNum);

    // Select iteration
    let targetIter;
    if (iteration === 'latest') {
      targetIter = Math.max(...iterations.map(it => it.iteration));
    } else {
      targetIter = parseInt(iteration, 10);
      if (isNaN(targetIter)) {
        targetIter = Math.max(...iterations.map(it => it.iteration));
      }
    }

    const selected = iterations.find(it => it.iteration === targetIter);
    if (!selected) {
      return res.json({ success: true,
      status: 'success', data: { image: null, message: `Iteration ${targetIter} not found` } });
    }

    // Read MRC volume and extract slice
    const { getMrcInfo, readMrcVolume, normalizeWithPercentile } = require('../utils/mrcParser');
    const sharp = require('sharp');

    const info = getMrcInfo(selected.file);
    if (!info) {
      return res.status(500).json({ status: 'error', message: 'Could not read MRC file' });
    }

    const volume = readMrcVolume(selected.file);
    if (!volume) {
      return res.status(500).json({ status: 'error', message: 'Could not read MRC volume' });
    }

    const { data, width, height, depth } = volume;

    // Extract slice based on axis
    let sliceData, sliceWidth, sliceHeight;

    if (axis === 'x') {
      // YZ plane (middle X)
      const midX = Math.floor(width / 2);
      sliceWidth = depth;
      sliceHeight = height;
      sliceData = new Float32Array(sliceWidth * sliceHeight);
      for (let z = 0; z < depth; z++) {
        for (let y = 0; y < height; y++) {
          const srcIdx = z * width * height + y * width + midX;
          const dstIdx = z * sliceHeight + y;
          sliceData[dstIdx] = data[srcIdx];
        }
      }
    } else if (axis === 'y') {
      // XZ plane (middle Y)
      const midY = Math.floor(height / 2);
      sliceWidth = width;
      sliceHeight = depth;
      sliceData = new Float32Array(sliceWidth * sliceHeight);
      for (let z = 0; z < depth; z++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = z * width * height + midY * width + x;
          const dstIdx = z * sliceWidth + x;
          sliceData[dstIdx] = data[srcIdx];
        }
      }
    } else {
      // XY plane (middle Z) - default
      const midZ = Math.floor(depth / 2);
      sliceWidth = width;
      sliceHeight = height;
      sliceData = new Float32Array(sliceWidth * sliceHeight);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const srcIdx = midZ * width * height + y * width + x;
          const dstIdx = y * sliceWidth + x;
          sliceData[dstIdx] = data[srcIdx];
        }
      }
    }

    // Normalize and convert to PNG
    const uint8Data = normalizeWithPercentile(sliceData, 2, 98);
    let image = sharp(uint8Data, { raw: { width: sliceWidth, height: sliceHeight, channels: 1 } });

    // Resize if too large
    const maxSize = 400;
    let finalWidth = sliceWidth;
    let finalHeight = sliceHeight;
    if (Math.max(sliceWidth, sliceHeight) > maxSize) {
      const ratio = maxSize / Math.max(sliceWidth, sliceHeight);
      finalWidth = Math.round(sliceWidth * ratio);
      finalHeight = Math.round(sliceHeight * ratio);
      image = image.resize(finalWidth, finalHeight, { fit: 'inside' });
    }

    const pngBuffer = await image.png().toBuffer();
    const base64 = pngBuffer.toString('base64');

    res.json({
      success: true,
      status: 'success',
      data: {
        image: `data:image/png;base64,${base64}`,
        iteration: selected.iteration,
        class: selected.classNum,
        axis: axis,
        shape: [depth, height, width],
        width: finalWidth,
        height: finalHeight,
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Initial model slices error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get slice image' });
  }
};

/**
 * Get CTF refinement logfile.pdf
 * GET /ctfrefine/pdf/?job_id=<id>
 */
exports.getCtfRefinePdf = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const pdfPath = path.join(outputDir, 'logfile.pdf');

    if (!fs.existsSync(pdfPath)) {
      return res.status(404).json({ status: 'error', message: 'Logfile PDF not found' });
    }

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', 'inline; filename="logfile.pdf"');
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.sendFile(pdfPath);
  } catch (error) {
    logger.error(`[Dashboard] CTF refine PDF error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get PDF' });
  }
};

/**
 * Get Bayesian polishing output files
 * GET /polish/output/?job_id=<id>
 */
exports.getPolishOutput = async (req, res) => {
  try {
    const jobId = req.params.jobId || req.query.job_id;
    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    // Find output files
    const outputFiles = [];
    const patterns = ['*.star', '*.pdf', '*.eps'];

    for (const pattern of patterns) {
      const matches = glob.sync(path.join(outputDir, pattern));
      for (const match of matches) {
        try {
          const stats = fs.statSync(match);
          outputFiles.push({
            name: path.basename(match),
            path: match,
            size: stats.size,
          });
        } catch (e) {
          // Skip files that can't be accessed
        }
      }
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        job_id: jobId,
        output_files: outputFiles,
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Polish output error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get output files' });
  }
};

/**
 * Get import job logs (legacy endpoint)
 * GET /import/logs?job_id=<id>&project_id=<pid>
 */
exports.getImportLogs = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const projectId = req.query.project_id;

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    // Check for log files
    let outputFile = '/run.out';
    const pdfFiles = fs.readdirSync(outputDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 0) {
      outputFile = `/${pdfFiles[0]}`;
    } else if (!fs.existsSync(path.join(outputDir, 'run.out'))) {
      outputFile = '/movies.star';
    }

    const logFilePath = path.join(outputDir, outputFile);

    // Return log file info
    res.json({
      status: 'monitoring',
      log_path: logFilePath,
      message: 'Log file location provided'
    });
  } catch (error) {
    logger.error(`[Dashboard] Import logs error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get logs' });
  }
};

/**
 * Get motion job logs (legacy endpoint)
 * GET /motion/logs?job_id=<id>&project_id=<pid>
 */
exports.getMotionLogs = async (req, res) => {
  try {
    const jobId = req.query.job_id;

    if (!jobId) {
      return res.status(400).json({ error: 'Job ID is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ error: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;

    if (!fs.existsSync(outputDir)) {
      return res.status(404).json({ error: 'Folder not found' });
    }

    const logFilePath = path.join(outputDir, 'run.out');

    res.json({
      status: 'monitoring',
      log_path: logFilePath,
      message: 'Log file location provided'
    });
  } catch (error) {
    logger.error(`[Dashboard] Motion logs error: ${error.message}`);
    res.status(500).json({ error: 'Failed to get logs' });
  }
};

/**
 * Get movie frame image for import dashboard
 * GET /api/import/movie-frame/?job_id=<id>&movie=<path>&frame=<n>
 */
exports.getMovieFrame = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const moviePath = req.query.movie;
    const frameIndex = parseInt(req.query.frame || '0', 10);

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }
    if (!moviePath) {
      return res.status(400).json({ status: 'error', message: 'movie path is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectPath = path.dirname(path.dirname(outputDir));

    // Resolve movie path
    let fullMoviePath = moviePath;
    if (!path.isAbsolute(moviePath)) {
      fullMoviePath = path.join(projectPath, moviePath);
    }

    if (!fs.existsSync(fullMoviePath)) {
      return res.status(404).json({ status: 'error', message: 'Movie file not found' });
    }

    // Read frame
    const { readMrcFrame, normalizeWithPercentile } = require('../utils/mrcParser');
    const sharp = require('sharp');

    const frame = readMrcFrame(fullMoviePath, frameIndex);
    if (!frame) {
      return res.status(500).json({ status: 'error', message: 'Could not read frame' });
    }

    const uint8Data = normalizeWithPercentile(frame.data, 1, 99);
    let image = sharp(uint8Data, { raw: { width: frame.width, height: frame.height, channels: 1 } });

    // Resize if too large
    const maxSize = 512;
    if (frame.width > maxSize || frame.height > maxSize) {
      image = image.resize(maxSize, maxSize, { fit: 'inside' });
    }

    const pngBuffer = await image.png().toBuffer();
    const base64 = pngBuffer.toString('base64');

    res.json({
      success: true,
      status: 'success',
      data: {
        image: `data:image/png;base64,${base64}`,
        frame_index: frameIndex,
        width: frame.width,
        height: frame.height,
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Movie frame error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get movie frame' });
  }
};

/**
 * Serve MRC file for import dashboard
 * GET /api/import/mrc/?job_id=<id>&file=<path>
 */
exports.getImportMrc = async (req, res) => {
  try {
    const jobId = req.query.job_id;
    const filePath = req.query.file || req.query.file_path;

    if (!jobId) {
      return res.status(400).json({ status: 'error', message: 'job_id is required' });
    }
    if (!filePath) {
      return res.status(400).json({ status: 'error', message: 'file path is required' });
    }

    const result = await getJobWithAccess(jobId, req.user.id);
    if (result.error) {
      return res.status(result.status).json({ status: 'error', message: result.error });
    }

    const { job } = result;
    const outputDir = job.output_file_path;
    const projectPath = path.dirname(path.dirname(outputDir));

    // Resolve file path
    let fullPath = filePath;
    if (!path.isAbsolute(filePath)) {
      fullPath = path.join(projectPath, filePath);
    }

    // Security check - ensure file is within project
    const resolvedPath = path.resolve(fullPath);
    const resolvedProject = path.resolve(projectPath);
    if (!resolvedPath.startsWith(resolvedProject)) {
      return res.status(403).json({ status: 'error', message: 'Access denied' });
    }

    if (!fs.existsSync(fullPath)) {
      return res.status(404).json({ status: 'error', message: 'File not found' });
    }

    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(fullPath)}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    res.sendFile(fullPath);
  } catch (error) {
    logger.error(`[Dashboard] Import MRC error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to serve MRC file' });
  }
};

/**
 * Get particle metadata for smart defaults.
 * Looks up the job that produced the given star file and returns
 * particle count, pixel size, and box size.
 *
 * GET /api/particle-metadata/?project_id=...&star_file=...
 */
exports.getParticleMetadata = async (req, res) => {
  try {
    const { project_id, star_file } = req.query;
    if (!project_id || !star_file) {
      return res.status(400).json({ status: 'error', message: 'project_id and star_file are required' });
    }

    // Find the job that produced this star file by matching output_files or job_name
    // star_file is typically like "Extract/job005/particles.star" or just "job005"
    const jobNameMatch = star_file.match(/(job\d+)/i);
    let sourceJob = null;

    if (jobNameMatch) {
      sourceJob = await Job.findOne({ project_id, job_name: jobNameMatch[1] }).lean();
    }

    if (!sourceJob) {
      // Try finding by matching output_files path
      sourceJob = await Job.findOne({
        project_id,
        'output_files.relativePath': { $regex: star_file.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') }
      }).lean();
    }

    if (!sourceJob) {
      return res.json({
        success: true,
        status: 'success',
        data: { metadata: null, hint: 'Could not find source job for this file' }
      });
    }

    const ps = sourceJob.pipeline_stats || {};
    const particleCount = ps.particle_count || 0;
    const pixelSize = ps.pixel_size || null;
    const boxSize = ps.box_size || null;

    res.json({
      success: true,
      status: 'success',
      data: {
        metadata: {
          particle_count: particleCount,
          pixel_size: pixelSize,
          box_size: boxSize,
        },
        hint: ''
      }
    });
  } catch (error) {
    logger.error(`[Dashboard] Particle metadata error: ${error.message}`);
    res.status(500).json({ status: 'error', message: 'Failed to get particle metadata' });
  }
};
