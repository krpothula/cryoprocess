/**
 * Authentication Middleware
 *
 * Validates JWT tokens and attaches user to request.
 */

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

    // Attach user to request
    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      first_name: user.first_name || '',
      last_name: user.last_name || '',
      is_staff: user.is_staff || false,
      is_superuser: user.is_superuser || false
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

  if (!req.user.is_superuser && !req.user.is_staff) {
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

  if (!req.user.is_superuser) {
    return res.status(403).json({
      status: 'error',
      message: 'Superuser access required'
    });
  }

  next();
};

// Alias for backwards compatibility
const isAdmin = isStaff;

module.exports = authMiddleware;
module.exports.isAdmin = isAdmin;
module.exports.isStaff = isStaff;
module.exports.isSuperuser = isSuperuser;
