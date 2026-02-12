/**
 * Path Utilities
 *
 * Security-focused path validation and resolution.
 */

const fs = require('fs');
const path = require('path');
const settings = require('../config/settings');
const logger = require('./logger');

/**
 * Validate path for security issues
 * @param {string} inputPath - Path to validate
 * @param {string} jobId - Optional job ID for context
 * @returns {{valid: boolean, error: string|null}}
 */
const validatePathSecurity = (inputPath, jobId = null) => {
  if (!inputPath) {
    return { valid: false, error: 'Path is required' };
  }

  // Block path traversal attempts
  if (inputPath.includes('..')) {
    logger.warn(`[Security] Path traversal attempt blocked: ${inputPath}`);
    return { valid: false, error: 'Invalid path: traversal not allowed' };
  }

  // Block absolute paths from user input without job context
  if (inputPath.startsWith('/') && !jobId) {
    logger.warn(`[Security] Absolute path without job context blocked: ${inputPath}`);
    return { valid: false, error: 'Invalid path: absolute paths require job context' };
  }

  // Validate file extension
  const ext = path.extname(inputPath).toLowerCase();
  if (ext && !settings.ALLOWED_EXTENSIONS.includes(ext)) {
    logger.warn(`[Security] Disallowed file extension: ${ext}`);
    return { valid: false, error: `Invalid file type: ${ext}` };
  }

  return { valid: true, error: null };
};

/**
 * Validate that resolved path is within allowed directories
 * @param {string} resolvedPath - Resolved absolute path
 * @param {string} projectPath - Project directory path
 * @returns {{valid: boolean, error: string|null}}
 */
const validateResolvedPath = (resolvedPath, projectPath) => {
  if (!fs.existsSync(resolvedPath)) {
    return { valid: false, error: 'File not found' };
  }

  // Check file size
  try {
    const stats = fs.statSync(resolvedPath);
    const maxSize = settings.MAX_FILE_SIZE_MB * 1024 * 1024;
    if (stats.size > maxSize) {
      logger.warn(`[Security] File too large: ${stats.size} bytes`);
      return { valid: false, error: `File too large (max ${settings.MAX_FILE_SIZE_MB}MB)` };
    }
  } catch (err) {
    return { valid: false, error: 'Cannot access file' };
  }

  // Verify path is within project directory
  if (projectPath) {
    const resolvedReal = fs.realpathSync(resolvedPath);
    const projectReal = fs.realpathSync(projectPath);

    if (!resolvedReal.startsWith(projectReal + path.sep)) {
      logger.warn(`[Security] Path outside project: ${resolvedPath}`);
      return { valid: false, error: 'Access denied: path outside project' };
    }
  }

  return { valid: true, error: null };
};

/**
 * Get project path from settings and project
 * @param {Object} project - Project object
 * @returns {string} Full project path
 */
const getProjectPath = (project) => {
  const folderName = project.folder_name || project.project_name.replace(/ /g, '_');
  return path.join(settings.ROOT_PATH, folderName);
};

/**
 * Resolve relative movie path to absolute path
 * @param {string} relativePath - Relative path from STAR file
 * @param {string} projectPath - Project directory path
 * @returns {string|null} Resolved path or null if not found
 */
const resolveMoviePath = (relativePath, projectPath) => {
  const { valid, error } = validatePathSecurity(relativePath, 'internal');
  if (!valid) {
    logger.warn(`[Path] Invalid path: ${error}`);
    return null;
  }

  const fullPath = path.join(projectPath, relativePath);

  // Verify resolved path stays within project
  try {
    const fullPathReal = fs.realpathSync(fullPath);
    const projectPathReal = fs.realpathSync(projectPath);

    if (fullPathReal.startsWith(projectPathReal + path.sep)) {
      if (fs.existsSync(fullPath)) {
        return fullPath;
      }
    }
  } catch (err) {
    // Path doesn't exist or can't be resolved
  }

  return null;
};

/**
 * Get project path in the archive location
 * @param {Object} project - Project object
 * @returns {string} Full archive path
 */
const getArchivedProjectPath = (project) => {
  const folderName = project.folder_name || project.project_name.replace(/ /g, '_');
  return path.join(settings.ARCHIVE_PATH, folderName);
};

/**
 * Rewrite output_file_path for all jobs in a project.
 * Replaces oldPrefix with newPrefix at the start of each path.
 * @param {string} projectId
 * @param {string} oldPrefix
 * @param {string} newPrefix
 * @returns {Promise<number>} Number of jobs updated
 */
const rewriteJobPaths = async (projectId, oldPrefix, newPrefix) => {
  const Job = require('../models/Job');
  const jobs = await Job.find({ project_id: projectId }).select('id output_file_path');

  const ops = [];
  for (const job of jobs) {
    if (job.output_file_path && job.output_file_path.startsWith(oldPrefix)) {
      const newPath = newPrefix + job.output_file_path.slice(oldPrefix.length);
      ops.push({
        updateOne: {
          filter: { id: job.id },
          update: { output_file_path: newPath }
        }
      });
    }
  }

  if (ops.length > 0) {
    await Job.bulkWrite(ops);
  }
  return ops.length;
};

/**
 * Sanitize filename for safe file operations
 * @param {string} filename - Filename to sanitize
 * @returns {string} Sanitized filename
 */
const sanitizeFilename = (filename) => {
  if (!filename) return '';

  // Get basename to prevent directory traversal
  const basename = path.basename(filename);

  // Only allow alphanumeric, dash, underscore, dot
  return basename.replace(/[^a-zA-Z0-9\-_.]/g, '');
};

module.exports = {
  validatePathSecurity,
  validateResolvedPath,
  getProjectPath,
  getArchivedProjectPath,
  rewriteJobPaths,
  resolveMoviePath,
  sanitizeFilename
};
