/**
 * Import Controller
 *
 * Handles import job results, movie frames, and thumbnails.
 */

const fs = require('fs');
const path = require('path');
const sharp = require('sharp');
const logger = require('../utils/logger');
const Job = require('../models/Job');
const Project = require('../models/Project');
const settings = require('../config/settings');
const { DEFAULTS, IMPORT_NODE_TYPES } = require('../config/constants');
const { parseStarFile, parseOpticsTable } = require('../utils/starParser');
const { validatePathSecurity, validateResolvedPath, resolveMoviePath, sanitizeFilename, getProjectPath } = require('../utils/pathUtils');
const { getMrcInfo, frameToPng, averagedFrameToPng } = require('../utils/mrcParser');
const response = require('../utils/responseHelper');

const NODE_TYPE_INFO = IMPORT_NODE_TYPES;

/**
 * Verify job ownership
 */
const verifyJobOwnership = async (jobId, userId) => {
  const job = await Job.findOne({ id: jobId }).lean();
  if (!job) {
    return { job: null, error: 'Job not found' };
  }
  if (job.user_id !== userId) {
    logger.warn(`[Security] Job ownership check failed | job_id: ${jobId} | owner: ${job.user_id} | requester: ${userId}`);
    return { job: null, error: 'Access denied' };
  }
  return { job, error: null };
};

/**
 * Detect import mode from command
 */
const detectImportMode = (command, outputDir) => {
  if (command && (command.includes('--do_other') || command.includes('--do_coordinates') || command.includes('--do_halfmaps'))) {
    return 'other';
  }

  // Check for other node type output files
  for (const [nodeType, info] of Object.entries(NODE_TYPE_INFO)) {
    const outputFile = path.join(outputDir, info.outputFile);
    if (fs.existsSync(outputFile) && !['movies.star', 'micrographs.star'].includes(info.outputFile)) {
      return 'other';
    }
  }

  return 'movies';
};

/**
 * Get import job results
 * GET /api/import/results/:jobId
 */
exports.getResults = async (req, res) => {
  try {
    const { jobId } = req.params;
    const userId = req.user.id;

    // Verify ownership
    const { job, error } = await verifyJobOwnership(jobId, userId);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    const outputDir = job.output_file_path;
    const projectPath = path.dirname(path.dirname(outputDir));
    const command = job.command || '';
    const importMode = detectImportMode(command, outputDir);

    logger.info(`[Import] Detected import mode: ${importMode}`);

    if (importMode === 'other') {
      return getOtherNodeResults(job, outputDir, projectPath, res);
    } else {
      return getMoviesResults(job, outputDir, projectPath, req, res);
    }
  } catch (error) {
    logger.error('[Import] getResults error:', error);
    return response.serverError(res, 'Error fetching results');
  }
};

/**
 * Get results for other node type imports
 */
const getOtherNodeResults = async (job, outputDir, projectPath, res) => {
  let nodeType = null;
  let importedFile = null;
  let nodeLabel = 'Unknown';
  const command = job.command || '';

  // Parse node type from command
  const match = command.match(/--node_type\s+(\w+)/);
  if (match) {
    nodeType = match[1];
    if (NODE_TYPE_INFO[nodeType]) {
      nodeLabel = NODE_TYPE_INFO[nodeType].label;
      const outputFile = NODE_TYPE_INFO[nodeType].outputFile;
      importedFile = path.join(outputDir, outputFile);
      if (!fs.existsSync(importedFile)) {
        importedFile = null;
      }
    }
  }

  // Fallback: search for expected output files
  if (!importedFile) {
    for (const [nt, info] of Object.entries(NODE_TYPE_INFO)) {
      const potentialFile = path.join(outputDir, info.outputFile);
      if (fs.existsSync(potentialFile)) {
        nodeType = nt;
        nodeLabel = info.label;
        importedFile = potentialFile;
        break;
      }
    }
  }

  // Final fallback: find data files in output dir by extension
  if (!importedFile && fs.existsSync(outputDir)) {
    const files = fs.readdirSync(outputDir).filter(f => !f.startsWith('run.') && !f.startsWith('RELION_'));
    const expectedExt = nodeType && NODE_TYPE_INFO[nodeType] ? NODE_TYPE_INFO[nodeType].extension : null;
    // First try matching the expected extension for this node type
    if (expectedExt) {
      for (const fname of files) {
        if (fname.endsWith(expectedExt)) {
          importedFile = path.join(outputDir, fname);
          logger.info(`[Import] Found file by expected extension (${expectedExt}): ${fname}`);
          break;
        }
      }
    }
    // Then try common data extensions: .mrc, .mrcs, .star
    if (!importedFile) {
      for (const ext of ['.mrc', '.mrcs', '.star']) {
        for (const fname of files) {
          if (fname.endsWith(ext)) {
            importedFile = path.join(outputDir, fname);
            if (!nodeType) {
              if (ext === '.star') { nodeType = 'coords'; nodeLabel = 'Particle Coordinates'; }
              else if (ext === '.mrcs') { nodeType = 'refs2d'; nodeLabel = '2D References'; }
              else { nodeType = 'ref3d'; nodeLabel = '3D Reference'; }
            }
            logger.info(`[Import] Found file by extension (${ext}): ${fname}`);
            break;
          }
        }
        if (importedFile) break;
      }
    }
  }

  // Get file info
  const fileInfo = {};
  let entryCount = 0;
  if (importedFile && fs.existsSync(importedFile)) {
    const stats = fs.statSync(importedFile);
    fileInfo.name = path.basename(importedFile);
    fileInfo.path = importedFile;
    fileInfo.relativePath = projectPath ? path.relative(projectPath, importedFile) : importedFile;
    fileInfo.size = stats.size;
    fileInfo.exists = true;

    // For MRC/MRCS files, get actual dimensions
    if (importedFile.endsWith('.mrc') || importedFile.endsWith('.mrcs')) {
      const mrcInfo = getMrcInfo(importedFile);
      if (mrcInfo) {
        fileInfo.dimensions = {
          nx: mrcInfo.width,
          ny: mrcInfo.height,
          nz: mrcInfo.num_frames
        };
        fileInfo.voxelSize = mrcInfo.pixelSize;
        // For .mrcs stacks (2D references), nz = number of class images
        if (importedFile.endsWith('.mrcs') && mrcInfo.num_frames > 1) {
          entryCount = mrcInfo.num_frames;
          fileInfo.entryCount = entryCount;
        }
      } else {
        fileInfo.dimensions = { nx: 0, ny: 0, nz: 0 };
      }
    }

    // For STAR files, count data entries (particles, micrographs, etc.)
    if (importedFile.endsWith('.star')) {
      try {
        const parsed = await parseStarFile(importedFile);
        // Check common block names: particles, micrographs, or use total count
        if (parsed?.particles?.rows?.length) {
          entryCount = parsed.particles.rows.length;
        } else if (parsed?.micrographs?.rows?.length) {
          entryCount = parsed.micrographs.rows.length;
        } else if (parsed?.total) {
          entryCount = parsed.total;
        }
        fileInfo.entryCount = entryCount;
      } catch (e) {
        logger.warn(`[Import] Could not count STAR entries: ${e.message}`);
      }
    }
  }

  logger.info(`[Import] Results: job_id=${job.id} | mode=other | node_type=${nodeType} | entries=${entryCount}`);

  return response.successData(res, {
    id: job.id,
    jobName: job.job_name,
    jobStatus: job.status,
    command,
    outputDir: outputDir,
    importMode: 'other',
    nodeType: nodeType,
    nodeLabel: nodeLabel,
    importedFile: fileInfo,
    entryCount: entryCount,
    summary: {
      totalImported: entryCount || (importedFile ? 1 : 0),
      displayed: entryCount || (importedFile ? 1 : 0),
      type: nodeType || 'unknown',
      label: nodeLabel
    }
  });
};

// Cache version - increment to invalidate all old caches
const STAR_CACHE_VERSION = 2;

/**
 * Get results for movies/micrographs import
 */
const getMoviesResults = async (job, outputDir, projectPath, req, res) => {
  let importedFiles = [];
  let totalFiles = 0;

  // Get authoritative total from job metadata (set by pipelineMetadata.js on completion)
  // This is more reliable than star_cache which may be stale
  const authoritativeTotal = job.pipeline_stats?.micrograph_count ?? job.micrograph_count ?? 0;

  // Find STAR file
  let starFile = null;
  for (const filename of ['movies.star', 'micrographs.star']) {
    const potentialPath = path.join(outputDir, filename);
    if (fs.existsSync(potentialPath)) {
      starFile = potentialPath;
      break;
    }
  }

  if (starFile) {
    try {
      // Check cache first
      const starCache = job.star_cache;
      const starMtime = fs.statSync(starFile).mtimeMs;

      // Cache is valid only if: same file, same mtime, correct version, and has enough files cached
      const cacheFilesCount = starCache?.files?.length || 0;
      const expectedCacheCount = Math.min(DEFAULTS.FILE_LIST_DISPLAY_LIMIT, starCache?.total_count || 0);
      const cacheVersionValid = starCache?.version === STAR_CACHE_VERSION;
      const cacheValid = starCache &&
        cacheVersionValid &&
        starCache.star_file === starFile &&
        starCache.mtime === starMtime &&
        cacheFilesCount >= expectedCacheCount;

      if (cacheValid) {
        // Cache hit
        importedFiles = starCache.files || [];
        // Use authoritative total if available, otherwise fall back to cache
        totalFiles = authoritativeTotal || starCache.total_count || importedFiles.length;
        logger.debug(`[Import] STAR cache hit: ${path.basename(starFile)} | total=${totalFiles}`);
      } else {
        // Cache miss - parse file
        const starData = await parseStarFile(starFile, DEFAULTS.FILE_LIST_DISPLAY_LIMIT);
        importedFiles = starData.files;
        // Use authoritative total if available, otherwise use parsed total
        totalFiles = authoritativeTotal || starData.total;

        // Update cache with version
        const cacheData = {
          version: STAR_CACHE_VERSION,
          star_file: starFile,
          mtime: starMtime,
          files: importedFiles,
          total_count: totalFiles,
          columns: starData.columns,
          cached_at: new Date().toISOString()
        };

        await Job.findOneAndUpdate(
          { id: job.id },
          { star_cache: cacheData }
        );

        logger.info(`[Import] STAR parsed & cached: ${path.basename(starFile)} | total=${totalFiles}`);
      }
    } catch (error) {
      logger.error(`[Import] Failed to parse STAR file: ${error.message}`);
    }
  } else {
    logger.warn(`[Import] No STAR file found in ${outputDir}`);
  }

  // Check for thumbnails
  const thumbnailsDir = path.join(outputDir, 'thumbnails');
  let existingThumbnails = [];

  for (const fileInfo of importedFiles) {
    const movieRelPath = fileInfo.movie_name || fileInfo.micrograph_name;
    if (movieRelPath) {
      const baseName = path.basename(movieRelPath, path.extname(movieRelPath));
      const thumbnailName = `${baseName}.png`;
      const thumbnailPath = path.join(thumbnailsDir, thumbnailName);

      if (fs.existsSync(thumbnailPath)) {
        fileInfo.thumbnailUrl = `/api/import/thumbnail/${job.id}/${thumbnailName}`;
      }
    }
  }

  if (fs.existsSync(thumbnailsDir)) {
    existingThumbnails = fs.readdirSync(thumbnailsDir).filter(f => f.endsWith('.png'));
  }

  // Get import type and parameters
  const params = job.parameters || {};
  let importType = 'micrographs';
  if (params.rawMovies === 'Yes' || params.rawMovies === true) {
    importType = 'movies';
  } else if (params.multiFrameMovies === 'Yes' || params.multiFrameMovies === true) {
    importType = 'movies';
  } else if (starFile && starFile.includes('movies')) {
    importType = 'movies';
  }

  const angpix = params.angpix;
  const kv = params.kV;
  const cs = params.spherical;

  logger.info(`[Import] Results: job_id=${job.id} | import_type=${importType} | files=${totalFiles}`);

  return response.successData(res, {
    id: job.id,
    jobName: job.job_name,
    jobStatus: job.status,
    command: job.command,
    importMode: importType,
    importType: importType,
    starFile: starFile,
    importedCount: importedFiles.length,
    importedFiles: importedFiles,
    thumbnailsCount: existingThumbnails.length,
    maxDisplay: DEFAULTS.FILE_LIST_DISPLAY_LIMIT,
    summary: {
      totalImported: totalFiles,
      displayed: importedFiles.length,
      type: importType
    },
    angpix,
    kV: kv,
    cs
  });
};

/**
 * Get single movie frame
 * GET /api/import/movie-frame
 */
exports.getMovieFrame = async (req, res) => {
  try {
    const { path: moviePath, jobId, frame, info, average } = req.query;

    if (!jobId) {
      return response.badRequest(res, 'jobId is required');
    }

    // Verify ownership
    const { job, error } = await verifyJobOwnership(jobId, req.user.id);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    // Validate path
    const { valid, error: pathError } = validatePathSecurity(moviePath, jobId);
    if (!valid) {
      return response.badRequest(res, pathError);
    }

    const projectPath = path.dirname(path.dirname(job.output_file_path));
    const resolvedPath = resolveMoviePath(moviePath, projectPath);

    if (!resolvedPath) {
      return response.notFound(res, 'Movie not found');
    }

    // Check file extension
    const ext = path.extname(resolvedPath).toLowerCase();

    // Return info only
    if (info === 'true') {
      if (ext === '.mrc' || ext === '.mrcs') {
        const mrcInfo = getMrcInfo(resolvedPath);
        if (mrcInfo) {
          return response.successData(res, {
            name: path.basename(resolvedPath),
            numFrames: mrcInfo.num_frames,
            width: mrcInfo.width,
            height: mrcInfo.height,
            pixelSize: mrcInfo.pixelSize
          });
        }
      }
      // Fallback for non-MRC or read error
      return response.successData(res, {
        name: path.basename(resolvedPath),
        numFrames: 1,
        width: 0,
        height: 0
      });
    }

    // For MRC files, extract and return frame as PNG
    if (ext === '.mrc' || ext === '.mrcs') {
      let pngBuffer;
      if (average === 'true') {
        pngBuffer = await averagedFrameToPng(resolvedPath, 10, 512);
      } else {
        const frameIndex = parseInt(frame, 10) || 0;
        pngBuffer = await frameToPng(resolvedPath, frameIndex, 512);
      }

      if (pngBuffer) {
        res.setHeader('Content-Type', 'image/png');
        return res.send(pngBuffer);
      }
    }

    return response.badRequest(res, 'Unable to read movie format');
  } catch (error) {
    logger.error('[Import] getMovieFrame error:', error);
    return response.serverError(res, 'Error processing movie');
  }
};

/**
 * Get all movie frames as base64
 * GET /api/import/movie-frames
 */
exports.getAllMovieFrames = async (req, res) => {
  try {
    const { path: moviePath, jobId, maxFrames = 50, size = 256 } = req.query;

    if (!jobId) {
      return response.badRequest(res, 'jobId is required');
    }

    // Verify ownership
    const { job, error } = await verifyJobOwnership(jobId, req.user.id);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    // Validate path
    const { valid, error: pathError } = validatePathSecurity(moviePath, jobId);
    if (!valid) {
      return response.badRequest(res, pathError);
    }

    const projectPath = path.dirname(path.dirname(job.output_file_path));
    const resolvedPath = resolveMoviePath(moviePath, projectPath);

    if (!resolvedPath) {
      return response.notFound(res, 'Movie not found');
    }

    const ext = path.extname(resolvedPath).toLowerCase();
    if (ext !== '.mrc' && ext !== '.mrcs') {
      return response.badRequest(res, 'Unsupported format');
    }

    // Get movie info
    const mrcInfo = getMrcInfo(resolvedPath);
    if (!mrcInfo) {
      return response.badRequest(res, 'Unable to read movie');
    }

    const numFrames = mrcInfo.num_frames;
    const maxFramesInt = Math.min(parseInt(maxFrames, 10) || 50, 100);
    const targetSize = Math.min(parseInt(size, 10) || 256, 512);

    // Calculate which frames to extract
    let frameIndices;
    if (numFrames <= maxFramesInt) {
      frameIndices = Array.from({ length: numFrames }, (_, i) => i);
    } else {
      const step = numFrames / maxFramesInt;
      frameIndices = Array.from({ length: maxFramesInt }, (_, i) => Math.floor(i * step));
    }

    // Extract frames as base64
    const framesBase64 = [];
    for (const frameIdx of frameIndices) {
      const pngBuffer = await frameToPng(resolvedPath, frameIdx, targetSize);
      if (pngBuffer) {
        framesBase64.push(pngBuffer.toString('base64'));
      }
    }

    return response.successData(res, {
      name: path.basename(resolvedPath),
      totalFrames: numFrames,
      returnedFrames: framesBase64.length,
      frames: framesBase64
    });
  } catch (error) {
    logger.error('[Import] getAllMovieFrames error:', error);
    return response.serverError(res, 'Error processing movie frames');
  }
};

/**
 * Get pre-generated thumbnail
 * GET /api/import/thumbnail/:jobId/:filename
 */
exports.getThumbnail = async (req, res) => {
  try {
    const { jobId, filename } = req.params;

    // Verify ownership
    const { job, error } = await verifyJobOwnership(jobId, req.user.id);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    // Sanitize filename
    const safeFilename = sanitizeFilename(filename);
    if (!safeFilename || safeFilename !== filename || filename.includes('..')) {
      logger.warn(`[Thumbnail] Path traversal blocked: ${filename}`);
      return response.badRequest(res, 'Invalid filename');
    }

    // Validate filename characters
    if (!/^[\w\-.]+$/.test(safeFilename)) {
      return response.badRequest(res, 'Invalid filename');
    }

    // Must be PNG
    if (!safeFilename.toLowerCase().endsWith('.png')) {
      return response.badRequest(res, 'Invalid file type');
    }

    const thumbnailsDir = path.join(job.output_file_path, 'thumbnails');
    let thumbnailPath = path.join(thumbnailsDir, safeFilename);

    // Security: verify resolved path is within thumbnails directory
    thumbnailPath = fs.realpathSync(thumbnailPath);
    const thumbnailsDirReal = fs.realpathSync(thumbnailsDir);
    if (!thumbnailPath.startsWith(thumbnailsDirReal + path.sep)) {
      logger.warn(`[Thumbnail] Path traversal blocked: ${thumbnailPath}`);
      return response.forbidden(res, 'Access denied');
    }

    if (!fs.existsSync(thumbnailPath)) {
      return response.notFound(res, 'Thumbnail not found');
    }

    // Send file
    res.setHeader('Content-Type', 'image/png');
    res.setHeader('Content-Disposition', `inline; filename="${safeFilename}"`);
    fs.createReadStream(thumbnailPath).pipe(res);
  } catch (error) {
    logger.error('[Import] getThumbnail error:', error);
    return response.serverError(res, 'Error reading thumbnail');
  }
};

/**
 * Get MRC volume file
 * GET /api/import/mrc
 */
exports.getMrcVolume = async (req, res) => {
  try {
    const { jobId } = req.query;

    if (!jobId) {
      return response.badRequest(res, 'jobId is required');
    }

    // Verify ownership
    const { job, error } = await verifyJobOwnership(jobId, req.user.id);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    const outputDir = job.output_file_path;
    let mrcPath = null;
    let filename = null;

    // Try to detect node type from command
    const command = job.command || '';
    const match = command.match(/--node_type\s+(\w+)/);
    if (match) {
      const nodeType = match[1];
      const nodeFiles = {
        'ref3d': 'ref3d.mrc',
        'mask': 'mask.mrc',
        'halfmap': 'halfmap.mrc'
      };
      if (nodeFiles[nodeType]) {
        const potentialPath = path.join(outputDir, nodeFiles[nodeType]);
        if (fs.existsSync(potentialPath)) {
          mrcPath = potentialPath;
          filename = nodeFiles[nodeType];
        }
      }
    }

    // Fallback: find any .mrc file
    if (!mrcPath && fs.existsSync(outputDir)) {
      const files = fs.readdirSync(outputDir);
      for (const fname of files) {
        if (fname.endsWith('.mrc')) {
          mrcPath = path.join(outputDir, fname);
          filename = fname;
          break;
        }
      }
    }

    if (!mrcPath || !fs.existsSync(mrcPath)) {
      logger.warn(`[Import] No MRC file found in ${outputDir}`);
      return response.notFound(res, 'No imported MRC file found');
    }

    // Stream the file
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
    res.setHeader('Access-Control-Expose-Headers', 'Content-Disposition');
    fs.createReadStream(mrcPath).pipe(res);
  } catch (error) {
    logger.error('[Import] getMrcVolume error:', error);
    return response.serverError(res, 'Error reading file');
  }
};

/**
 * Get import logs
 * GET /api/import/logs
 */
exports.getLogs = async (req, res) => {
  try {
    const { projectId, jobId } = req.query;

    if (!projectId || !jobId) {
      return response.badRequest(res, 'projectId and jobId are required');
    }

    // Verify job ownership
    const { job, error } = await verifyJobOwnership(jobId, req.user.id);
    if (error) {
      if (error === 'Job not found') {
        return response.notFound(res, error);
      }
      return response.forbidden(res, error);
    }

    const folderPath = job.output_file_path;
    if (!folderPath || !fs.existsSync(folderPath)) {
      // Return job info if no folder exists
      const content = [
        `Job: ${job.job_name || jobId}`,
        `Status: ${(job.status || 'unknown').toUpperCase()}`,
        `Type: ${job.job_type || 'unknown'}`,
        '',
        'No log files available yet.'
      ].join('\n');

      return response.success(res, {
        logPath: 'N/A',
        content
      });
    }

    // Find log file
    let logFile = 'run.out';
    const files = fs.readdirSync(folderPath);
    const pdfFiles = files.filter(f => f.toLowerCase().endsWith('.pdf'));
    if (pdfFiles.length > 0) {
      logFile = pdfFiles[0];
    } else if (!fs.existsSync(path.join(folderPath, 'run.out'))) {
      logFile = 'movies.star';
    }

    const logFilePath = path.join(folderPath, logFile);

    // Read log content
    let content = '';
    if (fs.existsSync(logFilePath)) {
      content = fs.readFileSync(logFilePath, 'utf8');
    } else {
      content = [
        `Job: ${job.job_name || jobId}`,
        `Status: ${(job.status || 'unknown').toUpperCase()}`,
        '',
        'No log file found.'
      ].join('\n');
    }

    return response.success(res, {
      logPath: logFilePath,
      content: content.substring(0, 50000) // Limit to 50KB
    });
  } catch (error) {
    logger.error('[Import] getLogs error:', error);
    return response.serverError(res, 'Error reading logs');
  }
};

/**
 * Parse STAR file
 * POST /api/import/parse-star
 */
exports.parseStar = async (req, res) => {
  try {
    const { starFile, limit = 100 } = req.body;

    if (!starFile) {
      return response.badRequest(res, 'starFile is required');
    }

    // Security: validate path
    if (starFile.includes('..') || !path.isAbsolute(starFile)) {
      return response.badRequest(res, 'Invalid path');
    }

    if (!fs.existsSync(starFile)) {
      return response.notFound(res, 'STAR file not found');
    }

    // Parse the STAR file
    const result = await parseStarFile(starFile, parseInt(limit, 10));

    // Also parse optics table
    const optics = await parseOpticsTable(starFile);

    return response.successData(res, {
      files: result.files,
      columns: result.columns,
      total: result.total,
      optics: optics
    });
  } catch (error) {
    logger.error('[Import] parseStar error:', error);
    return response.serverError(res, 'Error parsing STAR file');
  }
};

/**
 * Get MRC file info
 * POST /api/import/mrc-info
 */
exports.getMrcFileInfo = async (req, res) => {
  try {
    const { mrcFile } = req.body;

    if (!mrcFile) {
      return response.badRequest(res, 'mrcFile is required');
    }

    // Security: validate path
    if (mrcFile.includes('..') || !path.isAbsolute(mrcFile)) {
      return response.badRequest(res, 'Invalid path');
    }

    if (!fs.existsSync(mrcFile)) {
      return response.notFound(res, 'MRC file not found');
    }

    // Get MRC info
    const info = getMrcInfo(mrcFile);
    if (!info) {
      return response.badRequest(res, 'Unable to read MRC file');
    }

    return response.successData(res, info);
  } catch (error) {
    logger.error('[Import] getMrcFileInfo error:', error);
    return response.serverError(res, 'Error reading MRC file');
  }
};
