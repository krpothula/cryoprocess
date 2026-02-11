/**
 * Security Utilities
 *
 * Functions for input sanitization and security validation.
 */

const logger = require('./logger');

/**
 * Validate and sanitize a SLURM partition name.
 * Partition names can only contain alphanumeric characters, underscores, and hyphens.
 *
 * @param {string} partition - The partition name to validate
 * @returns {string|null} - Sanitized partition name or null if invalid
 */
function sanitizePartition(partition) {
  if (!partition || typeof partition !== 'string') {
    return null;
  }

  // SLURM partition names: alphanumeric, underscore, hyphen only
  const sanitized = partition.trim();
  if (!/^[a-zA-Z0-9_-]+$/.test(sanitized)) {
    logger.warn(`[Security] Invalid partition name rejected: ${partition}`);
    return null;
  }

  // Max reasonable length for partition name
  if (sanitized.length > 64) {
    logger.warn(`[Security] Partition name too long: ${partition.length} chars`);
    return null;
  }

  return sanitized;
}

/**
 * Validate and sanitize a SLURM username.
 * Usernames can only contain alphanumeric characters, underscores, and hyphens.
 *
 * @param {string} username - The username to validate
 * @returns {string|null} - Sanitized username or null if invalid
 */
function sanitizeUsername(username) {
  if (!username || typeof username !== 'string') {
    return null;
  }

  // UNIX usernames: alphanumeric, underscore, hyphen, dot
  const sanitized = username.trim();
  if (!/^[a-zA-Z0-9_.-]+$/.test(sanitized)) {
    logger.warn(`[Security] Invalid username rejected: ${username}`);
    return null;
  }

  // Max reasonable length for username
  if (sanitized.length > 64) {
    logger.warn(`[Security] Username too long: ${username.length} chars`);
    return null;
  }

  return sanitized;
}

/**
 * Validate and sanitize a SLURM job ID.
 * Job IDs are numeric only.
 *
 * @param {string|number} jobId - The job ID to validate
 * @returns {string|null} - Sanitized job ID or null if invalid
 */
function sanitizeSlurmJobId(jobId) {
  if (jobId === undefined || jobId === null) {
    return null;
  }

  // Convert to string and validate
  const jobIdStr = String(jobId).trim();

  // SLURM job IDs: numeric only (may include underscore for array jobs)
  if (!/^[0-9]+(_[0-9]+)?$/.test(jobIdStr)) {
    logger.warn(`[Security] Invalid SLURM job ID rejected: ${jobId}`);
    return null;
  }

  // Max reasonable length for job ID
  if (jobIdStr.length > 20) {
    logger.warn(`[Security] SLURM job ID too long: ${jobIdStr.length} chars`);
    return null;
  }

  return jobIdStr;
}

/**
 * Validate and sanitize a GPU ID string.
 * GPU IDs can be numbers separated by commas or colons.
 *
 * @param {string} gpuIds - The GPU ID string to validate
 * @returns {string|null} - Sanitized GPU IDs or null if invalid
 */
function sanitizeGpuIds(gpuIds) {
  if (!gpuIds || typeof gpuIds !== 'string') {
    return null;
  }

  const sanitized = gpuIds.trim();

  // GPU IDs: numbers separated by commas or colons
  if (!/^[0-9,:]+$/.test(sanitized)) {
    logger.warn(`[Security] Invalid GPU IDs rejected: ${gpuIds}`);
    return null;
  }

  if (sanitized.length > 64) {
    logger.warn(`[Security] GPU IDs string too long: ${sanitized.length} chars`);
    return null;
  }

  return sanitized;
}

/**
 * Escape a string for safe use in shell commands.
 * Use this only when execFile() with argument arrays isn't possible.
 *
 * @param {string} str - The string to escape
 * @returns {string} - Escaped string safe for shell
 */
function escapeShellArg(str) {
  if (!str || typeof str !== 'string') {
    return '';
  }

  // Replace single quotes with escaped version and wrap in single quotes
  return "'" + str.replace(/'/g, "'\\''") + "'";
}

/**
 * Validate a file path doesn't contain shell metacharacters.
 *
 * @param {string} filepath - The file path to validate
 * @returns {boolean} - True if path is safe
 */
function isPathSafe(filepath) {
  if (!filepath || typeof filepath !== 'string') {
    return false;
  }

  // Reject common shell metacharacters
  const dangerousChars = /[;&|`$(){}[\]<>!\\*?"']/;
  if (dangerousChars.test(filepath)) {
    return false;
  }

  // Reject null bytes
  if (filepath.includes('\0')) {
    return false;
  }

  return true;
}

/**
 * Validate email format
 *
 * @param {string} email - Email to validate
 * @returns {boolean} - True if valid email format
 */
function isValidEmail(email) {
  if (!email || typeof email !== 'string') {
    return false;
  }

  // Basic email regex - not exhaustive but catches most issues
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email) && email.length <= 254;
}

/**
 * Validate password meets security requirements
 *
 * @param {string} password - Password to validate
 * @returns {{valid: boolean, errors: string[]}} - Validation result
 */
function validatePassword(password) {
  const errors = [];

  if (!password || typeof password !== 'string') {
    return { valid: false, errors: ['Password is required'] };
  }

  if (password.length < 8) {
    errors.push('Password must be at least 8 characters');
  }

  if (password.length > 128) {
    errors.push('Password must be less than 128 characters');
  }

  // Check for complexity (optional but recommended)
  // if (!/[A-Z]/.test(password)) {
  //   errors.push('Password must contain at least one uppercase letter');
  // }
  // if (!/[a-z]/.test(password)) {
  //   errors.push('Password must contain at least one lowercase letter');
  // }
  // if (!/[0-9]/.test(password)) {
  //   errors.push('Password must contain at least one number');
  // }

  return { valid: errors.length === 0, errors };
}

module.exports = {
  sanitizePartition,
  sanitizeUsername,
  sanitizeSlurmJobId,
  sanitizeGpuIds,
  escapeShellArg,
  isPathSafe,
  isValidEmail,
  validatePassword
};
