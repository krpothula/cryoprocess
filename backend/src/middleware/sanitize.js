/**
 * Input Sanitization Middleware
 *
 * Trims strings, rejects null bytes, and strips HTML tags from request body.
 */

const stripHtmlTags = (str) => str.replace(/<[^>]*>/g, '');

const sanitizeValue = (value) => {
  if (typeof value === 'string') {
    // Reject null bytes
    if (value.includes('\0')) {
      return null; // Will be caught by validation
    }
    // Trim and strip HTML tags
    return stripHtmlTags(value.trim());
  }
  if (Array.isArray(value)) {
    return value.map(sanitizeValue);
  }
  if (value && typeof value === 'object') {
    return sanitizeObject(value);
  }
  return value;
};

const sanitizeObject = (obj) => {
  const result = {};
  for (const [key, value] of Object.entries(obj)) {
    result[key] = sanitizeValue(value);
  }
  return result;
};

const sanitizeMiddleware = () => {
  return (req, res, next) => {
    if (req.body && typeof req.body === 'object') {
      req.body = sanitizeObject(req.body);
    }
    if (req.query && typeof req.query === 'object') {
      req.query = sanitizeObject(req.query);
    }
    next();
  };
};

module.exports = sanitizeMiddleware;
