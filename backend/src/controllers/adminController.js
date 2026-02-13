/**
 * Admin Controller
 *
 * Handles user management for admin users.
 */

const crypto = require('crypto');
const logger = require('../utils/logger');
const User = require('../models/User');
const response = require('../utils/responseHelper');

/**
 * Generate temporary password
 */
const generateTempPassword = () => {
  return crypto.randomBytes(16).toString('hex'); // 32 characters, 128 bits entropy
};

/**
 * Generate API key (raw) and its SHA-256 hash
 */
const generateApiKeyPair = () => {
  const raw = crypto.randomBytes(32).toString('hex'); // 64 characters, 256 bits entropy
  const hash = crypto.createHash('sha256').update(raw).digest('hex');
  return { raw, hash };
};

/**
 * List all users
 * GET /api/admin/users
 */
exports.listUsers = async (req, res) => {
  try {
    const users = await User.find({})
      .select('-password +api_key_hash')
      .sort({ created_at: -1 })
      .lean();

    res.json({
      success: true,
      status: 'success',
      data: users.map(u => ({
        id: u.id,
        username: u.username,
        email: u.email,
        first_name: u.first_name || '',
        last_name: u.last_name || '',
        is_active: u.is_active !== false,
        is_staff: u.is_staff || false,
        is_superuser: u.is_superuser || false,
        must_change_password: u.must_change_password || false,
        has_api_key: !!u.api_key_hash,
        created_at: u.created_at,
        last_login: u.last_login
      })),
      count: users.length
    });
  } catch (error) {
    logger.error('[Admin] listUsers error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Create a new user
 * POST /api/admin/users
 * Staff can create regular users only
 * Superuser can create staff/superuser accounts
 */
exports.createUser = async (req, res) => {
  try {
    const { email, username, first_name, last_name, is_staff, is_superuser } = req.body;

    if (!email) {
      return response.badRequest(res, 'Email is required');
    }

    if (!username) {
      return response.badRequest(res, 'Username is required');
    }

    // Validate username: single word, no spaces, alphanumeric + underscore/dot/hyphen
    if (!/^[a-zA-Z0-9_.\-]+$/.test(username)) {
      return response.badRequest(res, 'Username must be a single word with no spaces (letters, numbers, underscore, dot, or hyphen only)');
    }

    // Normalize to lowercase (login uses lowercase comparison)
    const normalizedUsername = username.toLowerCase();
    const normalizedEmail = email.toLowerCase();

    // Staff cannot create staff/superuser accounts
    if (!req.user.is_superuser && (is_staff || is_superuser)) {
      return response.forbidden(res, 'Only superusers can create staff or superuser accounts');
    }

    // Check if user exists
    const existingUser = await User.findOne({
      $or: [{ email: normalizedEmail }, { username: normalizedUsername }]
    });

    if (existingUser) {
      return response.conflict(res, 'User with this email or username already exists');
    }

    // Generate temporary password
    const tempPassword = generateTempPassword();

    // Get next user ID
    const lastUser = await User.findOne().sort({ id: -1 });
    const nextId = (lastUser?.id || 0) + 1;

    // Note: Don't hash here - User model pre-save hook handles hashing
    const newUser = await User.create({
      id: nextId,
      username: normalizedUsername,
      email: normalizedEmail,
      password: tempPassword,
      first_name: first_name || '',
      last_name: last_name || '',
      is_active: true,
      is_staff: is_staff || false,
      is_superuser: is_superuser || false,
      must_change_password: true
    });

    logger.info(`[Admin] User created: ${normalizedUsername} by admin ${req.user.username}`);

    res.status(201).json({
      success: true,
      status: 'success',
      data: {
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        temporary_password: tempPassword
      },
      message: 'User created with temporary password'
    });
  } catch (error) {
    logger.error('[Admin] createUser error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Get single user
 * GET /api/admin/users/:userId
 */
exports.getUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ id: parseInt(userId, 10) })
      .select('-password +api_key_hash')
      .lean();

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    res.json({
      success: true,
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name || '',
        last_name: user.last_name || '',
        is_active: user.is_active !== false,
        is_staff: user.is_staff || false,
        is_superuser: user.is_superuser || false,
        must_change_password: user.must_change_password || false,
        has_api_key: !!user.api_key_hash,
        created_at: user.created_at,
        last_login: user.last_login
      }
    });
  } catch (error) {
    logger.error('[Admin] getUser error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Update user
 * PATCH /api/admin/users/:userId
 * Staff can update regular users only (name, active status)
 * Superuser can update anyone including staff/superuser flags
 */
exports.updateUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const { first_name, last_name, is_active, is_staff, is_superuser } = req.body;

    const user = await User.findOne({ id: parseInt(userId, 10) });

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Staff cannot modify staff/superuser accounts
    if (!req.user.is_superuser && (user.is_staff || user.is_superuser)) {
      return response.forbidden(res, 'Only superusers can modify staff or superuser accounts');
    }

    // Staff cannot grant staff/superuser privileges
    if (!req.user.is_superuser && (is_staff || is_superuser)) {
      return response.forbidden(res, 'Only superusers can grant staff or superuser privileges');
    }

    // Update fields
    if (first_name !== undefined) user.first_name = first_name;
    if (last_name !== undefined) user.last_name = last_name;
    if (is_active !== undefined) user.is_active = is_active;

    // Only superuser can modify these
    if (req.user.is_superuser) {
      if (is_staff !== undefined) user.is_staff = is_staff;
      if (is_superuser !== undefined) user.is_superuser = is_superuser;
    }

    user.updated_at = new Date();

    await user.save();

    logger.info(`[Admin] User updated: ${user.username} by admin ${req.user.username}`);

    res.json({
      success: true,
      status: 'success',
      data: {
        id: user.id,
        username: user.username,
        email: user.email,
        first_name: user.first_name,
        last_name: user.last_name,
        is_active: user.is_active,
        is_staff: user.is_staff,
        is_superuser: user.is_superuser
      },
      message: 'User updated successfully'
    });
  } catch (error) {
    logger.error('[Admin] updateUser error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Delete user
 * DELETE /api/admin/users/:userId
 * Only superusers can delete users
 */
exports.deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;
    const userIdInt = parseInt(userId, 10);

    // Only superusers can delete users
    if (!req.user.is_superuser) {
      return response.forbidden(res, 'Only superusers can delete users');
    }

    // Prevent self-deletion
    if (userIdInt === req.user.id) {
      return response.badRequest(res, 'Cannot delete your own account');
    }

    const user = await User.findOne({ id: userIdInt });

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    await User.deleteOne({ id: userIdInt });

    logger.info(`[Admin] User deleted: ${user.username} by admin ${req.user.username}`);

    return response.success(res, { message: 'User deleted successfully' });
  } catch (error) {
    logger.error('[Admin] deleteUser error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Reset user password
 * POST /api/admin/users/:userId/reset-password
 * Staff can reset passwords for regular users only
 * Superuser can reset passwords for anyone
 */
exports.resetPassword = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ id: parseInt(userId, 10) });

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Staff cannot reset passwords for staff/superuser accounts
    if (!req.user.is_superuser && (user.is_staff || user.is_superuser)) {
      return response.forbidden(res, 'Only superusers can reset passwords for staff or superuser accounts');
    }

    // Generate new temporary password
    const tempPassword = generateTempPassword();

    // Note: Don't hash here - User model pre-save hook handles hashing
    user.password = tempPassword;
    user.must_change_password = true;
    user.updated_at = new Date();

    await user.save();

    logger.info(`[Admin] Password reset for: ${user.username} by admin ${req.user.username}`);

    res.json({
      success: true,
      status: 'success',
      data: {
        temporary_password: tempPassword
      },
      message: 'Password reset successfully. User must change password on next login.'
    });
  } catch (error) {
    logger.error('[Admin] resetPassword error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Generate API key for user
 * POST /api/admin/users/:userId/generate-api-key
 * Staff can generate for regular users only
 * Superuser can generate for anyone
 */
exports.generateApiKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ id: parseInt(userId, 10) }).select('+api_key_hash');

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Staff cannot generate API keys for staff/superuser accounts
    if (!req.user.is_superuser && (user.is_staff || user.is_superuser)) {
      return response.forbidden(res, 'Only superusers can generate API keys for staff or superuser accounts');
    }

    const { raw, hash } = generateApiKeyPair();

    user.api_key_hash = hash;
    await user.save();

    logger.info(`[Admin] API key generated for: ${user.username} by admin ${req.user.username}`);

    res.json({
      success: true,
      status: 'success',
      data: {
        api_key: raw
      },
      message: 'API key generated. Store it securely — it cannot be shown again.'
    });
  } catch (error) {
    logger.error('[Admin] generateApiKey error:', error);
    return response.serverError(res, error.message);
  }
};

/**
 * Revoke API key for user
 * DELETE /api/admin/users/:userId/api-key
 * Staff can revoke for regular users only
 * Superuser can revoke for anyone
 */
exports.revokeApiKey = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findOne({ id: parseInt(userId, 10) }).select('+api_key_hash');

    if (!user) {
      return response.notFound(res, 'User not found');
    }

    // Staff cannot revoke API keys for staff/superuser accounts
    if (!req.user.is_superuser && (user.is_staff || user.is_superuser)) {
      return response.forbidden(res, 'Only superusers can revoke API keys for staff or superuser accounts');
    }

    if (!user.api_key_hash) {
      return response.badRequest(res, 'User does not have an API key');
    }

    user.api_key_hash = null;
    await user.save();

    logger.info(`[Admin] API key revoked for: ${user.username} by admin ${req.user.username}`);

    return response.success(res, { message: 'API key revoked successfully' });
  } catch (error) {
    logger.error('[Admin] revokeApiKey error:', error);
    return response.serverError(res, error.message);
  }
};
