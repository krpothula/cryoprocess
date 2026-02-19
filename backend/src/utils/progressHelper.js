/**
 * Progress Helper
 *
 * Provides on-demand job progress detection by counting output files.
 * Only called when dashboard is open - no background watchers.
 *
 * Includes server-side caching (3 seconds) to avoid redundant directory
 * reads when multiple users watch the same job simultaneously.
 */

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const logger = require('./logger');

// Cache for progress results - avoids redundant readdir when multiple users watch same job
const progressCache = new Map();
const CACHE_TTL_MS = 3000; // 3 seconds

// Job-type specific progress detection configuration
// RELION mirrors the input path structure in the output directory.
// MotionCorr outputs directly to JobXXX/Movies/, but downstream jobs like
// CTF and AutoPick nest outputs at e.g. JobXXX/MotionCorr/Job003/Movies/.
// New jobs store the resolved subdir in job.progress_subdir (fast flat readdir).
// Jobs marked `recursive: true` use recursive search as fallback for older jobs.
const PROGRESS_CONFIG = {
  Import: {
    // Import creates movies.star or micrographs.star when done
    pattern: /(movies|micrographs)\.star$/,
    type: 'boolean',
    description: 'import'
  },
  MotionCorr: {
    // MotionCorr outputs to Movies/ subdirectory
    // Exclude .mrcs (movie stacks) and _PS.mrc (power spectra)
    subdir: 'Movies',
    pattern: /\.mrc$/,
    exclude: /(\.mrcs$|_PS\.mrc$)/,
    description: 'micrographs'
  },
  CtfFind: {
    // CtfFind mirrors input path: CtfFind/JobXXX/MotionCorr/JobYYY/Movies/*.ctf
    recursive: true,
    pattern: /\.ctf$/,
    description: 'CTF estimates'
  },
  AutoPick: {
    // AutoPick mirrors input path: AutoPick/JobXXX/MotionCorr/JobYYY/Movies/*_autopick.star
    recursive: true,
    pattern: /_autopick\.star$/,
    description: 'micrographs picked'
  },
  Extract: {
    // Extract mirrors input path structure
    recursive: true,
    pattern: /\.mrcs$/,
    description: 'particle stacks'
  },
  Class2D: {
    // Count iteration files to track progress (run_ prefix or _ prefix depending on --o flag)
    pattern: /(?:run_)?_?it(\d+)_classes\.mrcs$/,
    type: 'iteration',
    description: 'iterations'
  },
  Class3D: {
    pattern: /(?:run_)?_?it(\d+)_class\d+\.mrc$/,
    type: 'iteration',
    description: 'iterations'
  },
  Refine3D: {
    pattern: /(?:run_)?_?it(\d+)_half1_class001\.mrc$/,
    type: 'iteration',
    description: 'iterations'
  },
  AutoRefine: {
    pattern: /(?:run_)?_?it(\d+)_half1_class001\.mrc$/,
    type: 'iteration',
    description: 'iterations'
  },
  Polish: {
    pattern: /shiny_(\d+)\.mrcs$/,
    description: 'particles polished'
  },
  InitialModel: {
    pattern: /(?:run_)?_?it(\d+)_class\d+\.mrc$/,
    type: 'iteration',
    description: 'iterations'
  },
  CtfRefine: {
    pattern: /particles_ctf_refine\.star$/,
    type: 'boolean',
    description: 'CTF refinement'
  }
};

/**
 * Recursively collect file names matching a pattern from a directory tree.
 * Used for RELION jobs that mirror the input path structure (CTF, AutoPick, Extract).
 * Limits depth to 5 to avoid runaway traversal.
 */
async function findFilesRecursive(dir, pattern, exclude, depth = 0) {
  if (depth > 5) return [];
  let entries;
  try { entries = await fsp.readdir(dir, { withFileTypes: true }); } catch { return []; }

  const results = [];
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sub = await findFilesRecursive(path.join(dir, entry.name), pattern, exclude, depth + 1);
      results.push(...sub);
    } else if (pattern.test(entry.name)) {
      if (exclude && exclude.test(entry.name)) continue;
      results.push(entry.name);
    }
  }
  return results;
}

/**
 * Get job progress by counting output files (async — does not block event loop)
 * @param {string} outputDir - Job output directory
 * @param {string} jobType - Job type (MotionCorr, CtfFind, etc.)
 * @param {number|null} totalExpected - Expected total count (from input)
 * @param {string|null} progressSubdir - Pre-computed subdirectory for per-micrograph outputs
 * @returns {Promise<Object|null>} Progress object or null if not supported
 */
async function getJobProgress(outputDir, jobType, totalExpected = null, progressSubdir = null) {
  if (!outputDir) return null;
  try { await fsp.access(outputDir); } catch { return null; }

  const config = PROGRESS_CONFIG[jobType];
  if (!config) {
    // Unsupported job type - return null
    return null;
  }

  // Check cache first - avoids redundant readdir when multiple users watch same job
  const cacheKey = `${outputDir}:${jobType}`;
  const cached = progressCache.get(cacheKey);
  if (cached && (Date.now() - cached.timestamp) < CACHE_TTL_MS) {
    // Return cached result with updated totalExpected (may differ per request)
    return {
      ...cached.data,
      total: totalExpected,
      percentage: totalExpected ? Math.round((cached.data.processed / totalExpected) * 100) : null
    };
  }

  try {
    // Determine search directory and file list.
    // Priority: stored progress_subdir > config.subdir > recursive fallback
    let files;
    let preFiltered = false; // true when files are already filtered by pattern
    const resolvedSubdir = progressSubdir || config.subdir;

    if (resolvedSubdir) {
      // Fast flat search in the known subdirectory
      const searchDir = path.join(outputDir, resolvedSubdir);

      try { await fsp.access(searchDir); } catch {
        // Subdir doesn't exist yet - job hasn't started outputting
        return {
          processed: 0,
          total: totalExpected,
          percentage: 0,
          description: config.description,
          type: config.type || 'count'
        };
      }

      files = await fsp.readdir(searchDir);
    } else if (config.recursive) {
      // Fallback: recursive search for older jobs without progress_subdir
      files = await findFilesRecursive(outputDir, config.pattern, config.exclude);
      preFiltered = true; // findFilesRecursive already applies pattern + exclude
    } else {
      // Search in the output dir root
      files = await fsp.readdir(outputDir);
    }

    let result;

    if (config.type === 'iteration') {
      // For iterative jobs, find the highest iteration number
      let maxIteration = 0;
      for (const file of files) {
        const match = file.match(config.pattern);
        if (match && match[1]) {
          const iter = parseInt(match[1], 10);
          if (iter > maxIteration) {
            maxIteration = iter;
          }
        }
      }

      result = {
        processed: maxIteration,
        total: totalExpected,
        percentage: totalExpected ? Math.round((maxIteration / totalExpected) * 100) : null,
        description: config.description,
        type: 'iteration'
      };
    } else if (config.type === 'boolean') {
      // For boolean jobs (done or not done)
      const found = files.some(f => config.pattern.test(f));
      result = {
        processed: found ? 1 : 0,
        total: 1,
        percentage: found ? 100 : 0,
        description: config.description,
        type: 'boolean'
      };
    } else {
      // Default: count matching files
      let matchingFiles;

      if (preFiltered) {
        // Already filtered by findFilesRecursive
        matchingFiles = files;
      } else {
        matchingFiles = [];
        for (const file of files) {
          if (config.pattern.test(file)) {
            if (config.exclude && config.exclude.test(file)) continue;
            matchingFiles.push(file);
          }
        }
      }

      // Sort files alphabetically for consistent ordering
      matchingFiles.sort();

      result = {
        processed: matchingFiles.length,
        total: totalExpected,
        percentage: totalExpected ? Math.round((matchingFiles.length / totalExpected) * 100) : null,
        description: config.description,
        type: 'count',
        files: matchingFiles
      };
    }

    // Cache the result (without totalExpected as that may vary per request)
    progressCache.set(cacheKey, {
      data: { processed: result.processed, description: result.description, type: result.type, files: result.files || [] },
      timestamp: Date.now()
    });

    return result;
  } catch (error) {
    logger.error(`[Progress] Error reading output dir: ${error.message}`);
    return null;
  }
}

/**
 * Get total expected count from input job
 * @param {Object} job - Job object with parameters
 * @returns {number|null} Total expected count or null
 */
function getTotalExpected(job) {
  // Try to get from job parameters or input job metadata
  const params = job.parameters || {};

  // Check various parameter names
  const totalFields = [
    'totalMicrographs',
    'total_micrographs',
    'nr_movies',
    'nr_micrographs',
    'nr_particles',
    'nr_iter',
    'nr_classes'
  ];

  for (const field of totalFields) {
    if (params[field] && typeof params[field] === 'number') {
      return params[field];
    }
  }

  return null;
}

/**
 * Clear progress cache for a specific job or all jobs
 * @param {string|null} outputDir - Output directory to clear, or null for all
 */
function clearProgressCache(outputDir = null) {
  if (outputDir) {
    // Clear specific job
    for (const key of progressCache.keys()) {
      if (key.startsWith(outputDir)) {
        progressCache.delete(key);
      }
    }
  } else {
    // Clear all
    progressCache.clear();
  }
}

// Periodic cache cleanup to prevent memory leaks (every 60 seconds)
setInterval(() => {
  const now = Date.now();
  for (const [key, value] of progressCache.entries()) {
    if (now - value.timestamp > CACHE_TTL_MS * 10) {
      progressCache.delete(key);
    }
  }
}, 60000);

module.exports = {
  getJobProgress,
  getTotalExpected,
  clearProgressCache,
  PROGRESS_CONFIG
};
