/**
 * Auth Controller
 *
 * Handles user authentication.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const { Client } = require('ssh2');
const logger = require('../utils/logger');
const User = require('../models/User');
const PasswordResetToken = require('../models/PasswordResetToken');
const settings = require('../config/settings');
const { validatePassword, isValidEmail } = require('../utils/security');
const { encryptField, decryptField } = require('../utils/crypto');
const response = require('../utils/responseHelper');
const { TIMING } = require('../config/constants');
const { getEmailService } = require('../services/emailService');
const auditLog = require('../utils/auditLogger');

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
    const { username, email, password, firstName = '', lastName = '' } = req.body;

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
      first_name: firstName,
      last_name: lastName
    });

    // Generate token and set HttpOnly cookie
    const token = user.generateAuthToken();
    setAuthCookie(res, token);

    logger.info(`[Auth] User registered: ${username}`);
    auditLog(req, 'register', { resourceType: 'user', resourceId: userId, details: `User registered: ${username}` });

    return response.created(res, {
      data: {
        user: {
          id: user.id,
          username: user.username,
          email: user.email,
          firstName: user.first_name,
          lastName: user.last_name
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
    auditLog(req, 'login', { resourceType: 'user', resourceId: user.id, details: `Login: ${user.email}` });

    return response.successData(res, {
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        isStaff: user.is_staff,
        isSuperuser: user.is_superuser
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
      firstName: user.first_name,
      lastName: user.last_name,
      isStaff: user.is_staff,
      isSuperuser: user.is_superuser,
      dateJoined: user.date_joined,
      lastLogin: user.last_login,
      notifyEmailDefault: user.notify_email_default !== false,
      clusterUsername: user.cluster_username || '',
      clusterConnected: user.cluster_connected || false,
      clusterEnabled: user.cluster_enabled || false,
      clusterSshKeySet: !!user.cluster_ssh_key
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
      mustChangePassword: user.must_change_password || false
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
    const { currentPassword, newPassword, confirmPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return response.badRequest(res, 'Current password and new password are required');
    }

    if (newPassword !== confirmPassword) {
      return response.badRequest(res, 'New password and confirmation do not match');
    }

    // Validate password strength
    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return response.badRequest(res, passwordValidation.errors.join(', '));
    }

    // Get user with password
    const user = await User.findOne({ id: req.user.id }).select('+password');

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Verify current password
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return response.unauthorized(res, 'Current password is incorrect');
    }

    // Update password
    user.password = newPassword;
    user.must_change_password = false;
    await user.save();

    logger.info(`[Auth] Password changed for user: ${user.username}`);
    auditLog(req, 'password_change', { resourceType: 'user', resourceId: user.id });

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
    const { firstName, lastName, email, notifyEmailDefault } = req.body;

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
    if (firstName !== undefined) user.first_name = firstName;
    if (lastName !== undefined) user.last_name = lastName;
    if (notifyEmailDefault !== undefined) user.notify_email_default = !!notifyEmailDefault;

    await user.save();

    logger.info(`[Auth] Profile updated for user: ${user.username}`);

    return response.successData(res, {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      isStaff: user.is_staff,
      isSuperuser: user.is_superuser,
      notifyEmailDefault: user.notify_email_default !== false
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
    // Get token from cookie (primary) or Authorization header (fallback)
    let token = req.cookies?.atoken;
    if (!token) {
      const authHeader = req.headers.authorization;
      if (authHeader && authHeader.startsWith('Bearer ')) {
        token = authHeader.substring(7);
      }
    }

    if (!token) {
      return response.unauthorized(res, 'Token required');
    }

    // Verify token (allow expired for refresh)
    let decoded;
    try {
      decoded = jwt.verify(token, settings.JWT_SECRET, { ignoreExpiration: true });
    } catch (err) {
      return response.unauthorized(res, 'Invalid token');
    }

    // Reject refresh if original token was issued more than 30 days ago
    const MAX_REFRESH_AGE = 30 * 24 * 60 * 60; // 30 days in seconds
    if (decoded.iat && (Math.floor(Date.now() / 1000) - decoded.iat) > MAX_REFRESH_AGE) {
      return response.unauthorized(res, 'Session expired, please login again');
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
    const { clusterUsername, clusterSshKey, clusterEnabled } = req.body;

    const user = await User.findOne({ id: req.user.id });
    if (!user) {
      return response.notFound(res, 'User not found');
    }

    if (clusterUsername !== undefined) {
      const trimmed = clusterUsername.trim();
      if (trimmed && !/^[a-zA-Z0-9_.\-]+$/.test(trimmed)) {
        return response.badRequest(res, 'Cluster username contains invalid characters');
      }
      user.cluster_username = trimmed;
    }

    if (clusterSshKey !== undefined) {
      if (clusterSshKey === '') {
        user.cluster_ssh_key = '';
        user.cluster_enabled = false;
      } else {
        user.cluster_ssh_key = encryptField(clusterSshKey);
      }
      user.cluster_connected = false;
    }

    if (clusterEnabled !== undefined) {
      // Only allow enabling if credentials are configured and tested
      if (clusterEnabled && !user.cluster_connected) {
        return response.badRequest(res, 'Test your connection first before enabling');
      }
      user.cluster_enabled = !!clusterEnabled;
    }

    await user.save();

    logger.info(`[Auth] Cluster settings updated for user: ${user.username} (enabled: ${user.cluster_enabled})`);

    return response.successData(res, {
      clusterUsername: user.cluster_username,
      clusterConnected: user.cluster_connected,
      clusterEnabled: user.cluster_enabled,
      clusterSshKeySet: !!user.cluster_ssh_key
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
  try {
    auditLog(req, 'logout', { resourceType: 'user', resourceId: req.user?.id });
    res.clearCookie('atoken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/'
    });
    return response.success(res, { message: 'Logged out' });
  } catch (error) {
    logger.error('[Auth] logout error:', error);
    return response.serverError(res, 'Logout failed');
  }
};

/**
 * Forgot password - send reset email
 * POST /api/auth/forgot-password
 */
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;

    // Always return success to prevent email enumeration
    const genericMsg = 'If an account with that email exists, a password reset link has been sent.';

    if (!email) {
      return response.success(res, { message: genericMsg });
    }

    const user = await User.findOne({ email: email.toLowerCase(), is_active: true });
    if (!user) {
      return response.success(res, { message: genericMsg });
    }

    // Generate a secure random token
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Invalidate any existing tokens for this user
    await PasswordResetToken.deleteMany({ user_id: user.id });

    await PasswordResetToken.create({
      token,
      user_id: user.id,
      expires_at: expiresAt
    });

    // Send reset email
    const emailService = getEmailService();
    if (emailService.enabled) {
      const frontendUrl = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',')[0].trim();
      const resetUrl = `${frontendUrl}/reset-password?token=${token}`;
      await emailService.sendPasswordReset({
        to: user.email,
        resetUrl,
        username: user.username
      });
    }

    logger.info(`[Auth] Password reset requested for: ${user.email}`);
    auditLog(req, 'forgot_password', { resourceType: 'user', resourceId: user.id });
    return response.success(res, { message: genericMsg });
  } catch (error) {
    logger.error('[Auth] forgotPassword error:', error);
    return response.success(res, { message: 'If an account with that email exists, a password reset link has been sent.' });
  }
};

/**
 * Reset password with token
 * POST /api/auth/reset-password
 */
exports.resetPassword = async (req, res) => {
  try {
    const { token, newPassword, confirmPassword } = req.body;

    if (!token || !newPassword) {
      return response.badRequest(res, 'Token and new password are required');
    }

    if (newPassword !== confirmPassword) {
      return response.badRequest(res, 'New password and confirmation do not match');
    }

    const passwordValidation = validatePassword(newPassword);
    if (!passwordValidation.valid) {
      return response.badRequest(res, passwordValidation.errors.join(', '));
    }

    // Find valid token
    const resetToken = await PasswordResetToken.findOne({
      token,
      used: false,
      expires_at: { $gt: new Date() }
    });

    if (!resetToken) {
      return response.badRequest(res, 'Invalid or expired reset token');
    }

    // Find user and update password
    const user = await User.findOne({ id: resetToken.user_id });
    if (!user || !user.is_active) {
      return response.badRequest(res, 'Invalid or expired reset token');
    }

    user.password = newPassword;
    user.must_change_password = false;
    await user.save();

    // Mark token as used
    resetToken.used = true;
    await resetToken.save();

    logger.info(`[Auth] Password reset completed for: ${user.email}`);
    auditLog(req, 'password_reset', { resourceType: 'user', resourceId: user.id });
    return response.success(res, { message: 'Password has been reset successfully' });
  } catch (error) {
    logger.error('[Auth] resetPassword error:', error);
    return response.serverError(res, error.message);
  }
};
