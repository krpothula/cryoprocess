/**
 * Request Logger Middleware
 *
 * HTTP request/response logging with duration tracking.
 * Uses appropriate log levels based on response status code.
 * Replaces morgan for richer, structured request logging.
 */

const logger = require('../utils/logger');

const requestLogger = () => {
  return (req, res, next) => {
    // Skip health check to avoid log noise
    if (req.path === '/api/health') {
      return next();
    }

    const start = Date.now();

    // Capture when response finishes
    res.on('finish', () => {
      const duration = Date.now() - start;
      const status = res.statusCode;
      const userId = req.user?.id || '-';

      const meta = {
        method: req.method,
        path: req.originalUrl || req.url,
        status,
        duration: `${duration}ms`,
        user: userId,
        ip: req.ip,
        contentLength: res.get('content-length') || '-',
      };

      const msg = `${req.method} ${meta.path} ${status} ${duration}ms`;

      if (status >= 500) {
        logger.error(msg, meta);
      } else if (status >= 400) {
        logger.warn(msg, meta);
      } else {
        logger.info(msg, meta);
      }
    });

    next();
  };
};

module.exports = requestLogger;
