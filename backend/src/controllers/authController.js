/**
 * Auth Controller
 *
 * Handles user authentication.
 */

const jwt = require('jsonwebtoken');
const { Client } = require('ssh2');
const logger = require('../utils/logger');
const User = require('../models/User');
const settings = require('../config/settings');
const { validatePassword, isValidEmail } = require('../utils/security');
const { encryptField, decryptField } = require('../utils/crypto');
const response = require('../utils/responseHelper');
const { TIMING } = require('../config/constants');

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  maxAge: TIMING.SESSION_COOKIE_MAX_AGE,
  path: '/'
};

const setAuthCookie = (res, token) => {
  res.cookie('atoken', token, AUTH_COOKIE_OPTIONS);
};

/**
 * Register new user
 * POST /api/auth/register
 */
exports.register = async (req, res) => {
  try {
    const { username, email, password, first_name = '', last_name = '' } = req.body;

    if (!username || !email || !password) {
      return response.badRequest(res, 'Username, email, and password are required');
    }

    // Validate username: single word, no spaces, alphanumeric + underscore/dot/hyphen
    if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) {
      return response.badRequest(res, 'Username must be a single word with no spaces (letters, numbers, underscore, dot, or hyphen only)');
    }

    // Validate email format
    if (!isValidEmail(email)) {
      return response.badRequest(res, 'Invalid email format');
    }

    // Validate password strength
    const passwordValidation = validatePassword(password);
    if (!passwordValidation.valid) {
      return response.badRequest(res, passwordValidation.errors.join(', '));
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ username: username.toLowerCase() }, { email: email.toLowerCase() }]
    });

    if (existingUser) {
      return response.conflict(res, 'User with this username or email already exists');
    }

    // Get next user ID
    const userId = await User.getNextId();

    // Create user
    const user = await User.create({
      id: userId,
      username: username.toLowerCase(),
      email: email.toLowerCase(),
      password,
      first_name,
      last_name
    });

    // Generate token and set HttpOnly cookie
    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    logger.info(`[Auth] User registered: ${username}`);

    return response.created(res, {
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          first_name: user.first_name,
          last_name: user.last_name
        }
      }
    });
  } catch (error) {
    logger.error('[Auth] Register error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Login
 * POST /api/auth/login
 */
exports.login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return response.badRequest(res, 'Email and password are required');
    }

    // Find user by email (include password for comparison)
    const user = await User.findOne({ email: email.toLowerCase() }).select('+password');

    if (!user) {
      return response.unauthorized(res, 'Invalid credentials');
    }

    // Check password
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return response.unauthorized(res, 'Invalid credentials');
    }

    if (!user.is_active) {
      return response.unauthorized(res, 'Account is disabled');
    }

    // Update last login
    user.last_login = new Date();
    await user.save();

    // Generate token and set HttpOnly cookie
    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    logger.info(`[Auth] User logged in: ${user.email}`);

    return response.successData(res, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser
      }
    });
  } catch (error) {
    logger.error('[Auth] Login error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get current user
 * GET /api/auth/me
 */
exports.getCurrentUser = async (req, res) => {
  try {
    // User already attached by auth middleware
    const user = await User.findOne({ id: req.user.id }).lean();

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    return response.successData(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser,
      date_joined: user.date_joined,
      last_login: user.last_login,
      cluster_username: user.cluster_username || '',
      cluster_connected: user.cluster_connected || false,
      cluster_enabled: user.cluster_enabled || false,
      cluster_ssh_key_set: !!user.cluster_ssh_key
    });
  } catch (error) {
    logger.error('[Auth] getCurrentUser error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get password status (check if user must change password)
 * GET /api/auth/password-status
 */
exports.getPasswordStatus = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id }).lean();

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    return response.success(res, {
      must_change_password: user.must_change_password || false
    });
  } catch (error) {
    logger.error('[Auth] getPasswordStatus error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Change password
 * POST /api/auth/change-password
 */
exports.changePassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body;

    if (!current_password || !new_password) {
      return response.badRequest(res, 'Current password and new password are required');
    }

    if (new_password !== confirm_password) {
      return response.badRequest(res, 'New password and confirmation do not match');
    }

    // Validate password strength
    const passwordValidation = validatePassword(new_password);
    if (!passwordValidation.valid) {
      return response.badRequest(res, passwordValidation.errors.join(', '));
    }

    // Get user with password
    const user = await User.findOne({ id: req.user.id }).select('+password');

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Verify current password
    const isMatch = await user.comparePassword(current_password);
    if (!isMatch) {
      return response.unauthorized(res, 'Current password is incorrect');
    }

    // Update password
    user.password = new_password;
    user.must_change_password = false;
    await user.save();

    logger.info(`[Auth] Password changed for user: ${user.username}`);

    return response.success(res, { message: 'Password changed successfully' });
  } catch (error) {
    logger.error('[Auth] changePassword error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update user profile
 * PUT /api/auth/profile
 */
exports.updateProfile = async (req, res) => {
  try {
    const { first_name, last_name, email } = req.body;

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // If email is being changed, validate and check uniqueness
    if (email && email.toLowerCase() !== user.email) {
      if (!isValidEmail(email)) {
        return response.badRequest(res, 'Invalid email format');
      }
      const existingUser = await User.findOne({ email: email.toLowerCase() });
      if (existingUser) {
        return response.conflict(res, 'Email already in use');
      }
      user.email = email.toLowerCase();
    }

    // Update fields if provided
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;

    await user.save();

    logger.info(`[Auth] Profile updated for user: ${user.username}`);

    return response.successData(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name,
      last_name: user.last_name,
      is_staff: user.is_staff,
      is_superuser: user.is_superuser
    });
  } catch (error) {
    logger.error('[Auth] updateProfile error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Refresh token
 * POST /api/auth/refresh
 */
exports.refreshToken = async (req, res) => {
  try {
    // Get token from header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return response.unauthorized(res, 'Token required');
    }

    const token = authHeader.substring(7);

    // Verify token (allow expired for refresh)
    let decoded;
    try {
      decoded = jwt.verify(token, settings.JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      return response.unauthorized(res, 'Invalid token');
    }

    // Get user
    const user = await User.findOne({ id: decoded.id });
    if (!user || !user.is_active) {
      return response.unauthorized(res, 'User not found or inactive');
    }

    // Generate new token and set HttpOnly cookie
    const newToken = user.generateAuthToken();
    setAuthCookie(res, newToken);

    return response.success(res, { message: 'Token refreshed' });
  } catch (error) {
    logger.error('[Auth] refreshToken error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update cluster SSH settings
 * PUT /api/auth/cluster-settings
 */
exports.updateClusterSettings = async (req, res) => {
  try {
    const { cluster_username, cluster_ssh_key, cluster_enabled } = req.body;

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return response.notFound(res, 'User not found');
    }

    if (cluster_username !== undefined) {
      const trimmed = cluster_username.trim();
      if (trimmed && !/^[a-zA-Z0-9_.\-]+$/.test(trimmed)) {
        return response.badRequest(res, 'Cluster username contains invalid characters');
      }
      user.cluster_username = trimmed;
    }

    if (cluster_ssh_key !== undefined) {
      if (cluster_ssh_key === '') {
        user.cluster_ssh_key = '';
        user.cluster_enabled = false;
      } else {
        user.cluster_ssh_key = encryptField(cluster_ssh_key);
      }
      user.cluster_connected = false;
    }

    if (cluster_enabled !== undefined) {
      // Only allow enabling if credentials are configured and tested
      if (cluster_enabled && !user.cluster_connected) {
        return response.badRequest(res, 'Test your connection first before enabling');
      }
      user.cluster_enabled = !!cluster_enabled;
    }

    await user.save();

    logger.info(`[Auth] Cluster settings updated for user: ${user.username} (enabled: ${user.cluster_enabled})`);

    return response.successData(res, {
      cluster_username: user.cluster_username,
      cluster_connected: user.cluster_connected,
      cluster_enabled: user.cluster_enabled,
      cluster_ssh_key_set: !!user.cluster_ssh_key
    });
  } catch (error) {
    logger.error('[Auth] updateClusterSettings error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Test cluster SSH connection
 * POST /api/auth/cluster-test
 */
exports.testClusterConnection = async (req, res) => {
  try {
    const user = await User.findOne({ id: req.user.id }).select('+cluster_ssh_key');
    if (!user) {
      return response.notFound(res, 'User not found');
    }

    if (!user.cluster_username) {
      return response.badRequest(res, 'Cluster username is required. Save your settings first.');
    }
    if (!user.cluster_ssh_key) {
      return response.badRequest(res, 'SSH private key is required. Save your settings first.');
    }

    const host = settings.SLURM_SSH_HOST;
    if (!host) {
      return response.badRequest(res, 'Cluster host is not configured. Ask your admin to set SLURM_SSH_HOST in .env');
    }

    let sshKey;
    try {
      sshKey = decryptField(user.cluster_ssh_key);
    } catch (decryptErr) {
      logger.error(`[Auth] Failed to decrypt SSH key for user ${user.username}: ${decryptErr.message}`);
      return response.serverError(res, 'Failed to decrypt stored SSH key');
    }

    const port = settings.SLURM_SSH_PORT || 22;
    const TEST_TIMEOUT = 10000;

    const result = await new Promise((resolve) => {
      const client = new Client();
      let settled = false;

      const finish = (success, message) => {
        if (settled) return;
        settled = true;
        client.end();
        resolve({ success, message });
      };

      const timer = setTimeout(() => {
        finish(false, 'Connection timed out after 10 seconds');
      }, TEST_TIMEOUT);

      client.on('ready', () => {
        client.exec('whoami', (err, stream) => {
          if (err) {
            clearTimeout(timer);
            return finish(false, `Command execution failed: ${err.message}`);
          }

          let stdout = '';
          stream.on('data', (data) => { stdout += data; });
          stream.on('close', () => {
            clearTimeout(timer);
            finish(true, `Connected as ${stdout.trim()}`);
          });
        });
      });

      client.on('error', (err) => {
        clearTimeout(timer);
        finish(false, err.message);
      });

      client.connect({
        host,
        port,
        username: user.cluster_username,
        privateKey: sshKey,
        readyTimeout: TEST_TIMEOUT,
      });
    });

    // Update connection status in DB
    user.cluster_connected = result.success;
    await user.save();

    if (result.success) {
      logger.info(`[Auth] Cluster connection test passed for user: ${user.username} → ${user.cluster_username}@${host}`);
      return response.successData(res, {
        connected: true,
        message: result.message
      });
    } else {
      logger.warn(`[Auth] Cluster connection test failed for user: ${user.username} — ${result.message}`);
      return response.successData(res, {
        connected: false,
        message: result.message
      });
    }
  } catch (error) {
    logger.error('[Auth] testClusterConnection error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Logout - clear auth cookie
 * POST /api/auth/logout
 */
exports.logout = (req, res) => {
  res.clearCookie('atoken', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/'
  });
  return response.success(res, { message: 'Logged out' });
};
