/**
 * Global Error Handler Middleware
 *
 * Catches all errors and returns consistent JSON responses.
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  // Log the error
  logger.error('[Error]', {
    message: err.message,
    stack: err.stack,
    path: req.path,
    method: req.method
  });

  // Handle specific error types
  if (err.name === 'ValidationError') {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Validation error',
      errors: err.details || err.message
    });
  }

  if (err.name === 'CastError') {
    return res.status(400).json({
      success: false,
      status: 'error',
      message: 'Invalid ID format'
    });
  }

  if (err.code === 11000) {
    // MongoDB duplicate key error
    return res.status(409).json({
      success: false,
      status: 'error',
      message: 'Duplicate entry'
    });
  }

  if (err.name === 'UnauthorizedError') {
    return res.status(401).json({
      success: false,
      status: 'error',
      message: 'Authentication required'
    });
  }

  // Default error response
  const statusCode = err.statusCode || 500;
  const message = process.env.NODE_ENV === 'production'
    ? 'Internal server error'
    : err.message;

  res.status(statusCode).json({
    success: false,
    status: 'error',
    message
  });
};

module.exports = errorHandler;
