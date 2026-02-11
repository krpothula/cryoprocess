/**
 * Response Helper Utilities
 *
 * Standardized API response functions to ensure consistent response format.
 */

const { HTTP_STATUS } = require('../config/constants');

/**
 * Send a success response
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default 200)
 */
function success(res, data = {}, statusCode = HTTP_STATUS.OK) {
  return res.status(statusCode).json({
    success: true,
    status: 'success',
    ...data
  });
}

/**
 * Send a success response with data wrapper
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 * @param {number} statusCode - HTTP status code (default 200)
 */
function successData(res, data, statusCode = HTTP_STATUS.OK) {
  return res.status(statusCode).json({
    success: true,
    status: 'success',
    data
  });
}

/**
 * Send a created response (201)
 * @param {Response} res - Express response object
 * @param {Object} data - Response data
 */
function created(res, data = {}) {
  return success(res, data, HTTP_STATUS.CREATED);
}

/**
 * Send an error response
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 * @param {number} statusCode - HTTP status code (default 400)
 * @param {Object} extra - Additional fields to include
 */
function error(res, message, statusCode = HTTP_STATUS.BAD_REQUEST, extra = {}) {
  return res.status(statusCode).json({
    success: false,
    status: 'error',
    message,
    ...extra
  });
}

/**
 * Send a bad request error (400)
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 */
function badRequest(res, message) {
  return error(res, message, HTTP_STATUS.BAD_REQUEST);
}

/**
 * Send an unauthorized error (401)
 * @param {Response} res - Express response object
 * @param {string} message - Error message (default: 'Unauthorized')
 */
function unauthorized(res, message = 'Unauthorized') {
  return error(res, message, HTTP_STATUS.UNAUTHORIZED);
}

/**
 * Send a forbidden error (403)
 * @param {Response} res - Express response object
 * @param {string} message - Error message (default: 'Access denied')
 */
function forbidden(res, message = 'Access denied') {
  return error(res, message, HTTP_STATUS.FORBIDDEN);
}

/**
 * Send a not found error (404)
 * @param {Response} res - Express response object
 * @param {string} message - Error message (default: 'Not found')
 */
function notFound(res, message = 'Not found') {
  return error(res, message, HTTP_STATUS.NOT_FOUND);
}

/**
 * Send a conflict error (409)
 * @param {Response} res - Express response object
 * @param {string} message - Error message
 */
function conflict(res, message) {
  return error(res, message, HTTP_STATUS.CONFLICT);
}

/**
 * Send a server error (500)
 * @param {Response} res - Express response object
 * @param {string} message - Error message (default: 'Internal server error')
 */
function serverError(res, message = 'Internal server error') {
  return error(res, message, HTTP_STATUS.INTERNAL_ERROR);
}

/**
 * Send validation errors
 * @param {Response} res - Express response object
 * @param {Array|Object} errors - Validation errors
 */
function validationError(res, errors) {
  const message = Array.isArray(errors)
    ? errors.map(e => e.message || e).join(', ')
    : (errors.message || String(errors));

  return error(res, message, HTTP_STATUS.BAD_REQUEST, {
    errors: Array.isArray(errors) ? errors : [errors]
  });
}

/**
 * Send paginated response
 * @param {Response} res - Express response object
 * @param {Array} data - Array of items
 * @param {Object} pagination - Pagination info { page, limit, total }
 */
function paginated(res, data, { page = 1, limit = 50, total = 0 }) {
  return res.status(HTTP_STATUS.OK).json({
    success: true,
    status: 'success',
    data,
    pagination: {
      page,
      limit,
      total,
      pages: Math.ceil(total / limit)
    }
  });
}

module.exports = {
  success,
  successData,
  created,
  error,
  badRequest,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  serverError,
  validationError,
  paginated
};
