/**
 * Authentication Middleware
 *
 * Validates JWT tokens and attaches user to request.
 */

const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const settings = require('../config/settings');
const User = require('../models/User');
const logger = require('../utils/logger');

/**
 * Verify JWT token from HttpOnly cookie or Authorization header
 */
const authMiddleware = async (req, res, next) => {
  try {
    let token = null;

    // 1. Authorization header (API clients, legacy)
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7);
    }

    // 2. HttpOnly cookie (primary method for browser sessions)
    if (!token && req.cookies && req.cookies.atoken) {
      token = req.cookies.atoken;
    }

    if (!token) {
      return res.status(401).json({
        status: 'error',
        message: 'Authentication required'
      });
    }

    // Verify token
    const decoded = jwt.verify(token, settings.JWT_SECRET);

    // Get user from database
    const user = await User.findOne({ id: decoded.id }).lean();
    if (!user) {
      return res.status(401).json({
        status: 'error',
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        status: 'error',
        message: 'User account is disabled'
      });
    }

    // Attach user to request (camelCase — DB fields are snake_case)
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      firstName: user.first_name || '',
      lastName: user.last_name || '',
      isStaff: user.is_staff || false,
      isSuperuser: user.is_superuser || false
    };

    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      logger.warn('[Auth] Invalid token');
      return res.status(401).json({
        status: 'error',
        message: 'Invalid token'
      });
    }
    if (error.name === 'TokenExpiredError') {
      logger.warn('[Auth] Token expired');
      return res.status(401).json({
        status: 'error',
        message: 'Token expired'
      });
    }

    logger.error('[Auth] Error:', error);
    return res.status(500).json({
      status: 'error',
      message: 'Authentication error'
    });
  }
};

/**
 * Staff middleware - requires is_staff OR is_superuser
 * Can: view users, create users, reset passwords
 * Cannot: modify staff/superuser accounts, delete users
 */
const isStaff = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  if (!req.user.isSuperuser && !req.user.isStaff) {
    return res.status(403).json({
      status: 'error',
      message: 'Staff access required'
    });
  }

  next();
};

/**
 * Superuser middleware - requires is_superuser only
 * Can: everything including managing staff, deleting users
 */
const isSuperuser = (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      status: 'error',
      message: 'Authentication required'
    });
  }

  if (!req.user.isSuperuser) {
    return res.status(403).json({
      status: 'error',
      message: 'Superuser access required'
    });
  }

  next();
};

/**
 * SmartScope API key middleware
 *
 * Accepts an API key via X-API-Key header for machine-to-machine auth.
 * Falls back to standard JWT auth if no API key is provided.
 */
const smartscopeAuth = async (req, res, next) => {
  const apiKey = req.headers['x-api-key'];

  if (apiKey) {
    // 1. Legacy .env SMARTSCOPE_API_KEY (backwards compatible)
    if (settings.SMARTSCOPE_API_KEY && apiKey === settings.SMARTSCOPE_API_KEY) {
      const serviceUser = await User.findOne({ username: 'smartscope' }).lean();
      if (!serviceUser) {
        logger.error('[Auth] SmartScope service account not found in database. Create a user with username "smartscope".');
        return res.status(500).json({
          status: 'error',
          message: 'SmartScope service account not found. Contact admin.'
        });
      }

      req.user = {
        id: serviceUser.id,
        username: serviceUser.username,
        email: serviceUser.email,
        firstName: serviceUser.first_name || 'SmartScope',
        lastName: serviceUser.last_name || 'Service',
        isStaff: serviceUser.is_staff || false,
        isSuperuser: serviceUser.is_superuser || false
      };

      return next();
    }

    // 2. Per-user API key (SHA-256 hash lookup)
    const apiKeyHash = crypto.createHash('sha256').update(apiKey).digest('hex');
    const user = await User.findOne({ api_key_hash: apiKeyHash }).lean();

    if (user) {
      if (!user.is_active) {
        return res.status(401).json({
          status: 'error',
          message: 'User account is disabled'
        });
      }

      req.user = {
        id: user.id,
        username: user.username,
        email: user.email,
        firstName: user.first_name || '',
        lastName: user.last_name || '',
        isStaff: user.is_staff || false,
        isSuperuser: user.is_superuser || false
      };

      return next();
    }

    // API key provided but doesn't match anything
    logger.warn('[Auth] Invalid API key');
    return res.status(401).json({
      status: 'error',
      message: 'Invalid API key'
    });
  }

  // No API key provided — fall back to JWT auth
  return authMiddleware(req, res, next);
};

// Alias for backwards compatibility
const isAdmin = isStaff;

module.exports = authMiddleware;
module.exports.isAdmin = isAdmin;
module.exports.isStaff = isStaff;
module.exports.isSuperuser = isSuperuser;
module.exports.smartscopeAuth = smartscopeAuth;
