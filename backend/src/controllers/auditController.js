/**
 * Audit Controller
 *
 * Admin-only endpoint to view audit logs.
 */

const AuditLog = require('../models/AuditLog');
const response = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { mapKeys } = require('../utils/mapKeys');

/**
 * List audit logs with filters and pagination
 * GET /api/admin/audit?page=1&limit=50&action=login&user_id=1
 */
exports.listAuditLogs = async (req, res) => {
  try {
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 200);
    const skip = (page - 1) * limit;

    // Build filter
    const filter = {};
    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.user_id) {
      filter.user_id = parseInt(req.query.user_id);
    }
    if (req.query.username) {
      filter.username = { $regex: req.query.username, $options: 'i' };
    }
    if (req.query.resource_type) {
      filter.resource_type = req.query.resource_type;
    }

    const [logs, total] = await Promise.all([
      AuditLog.find(filter)
        .sort({ created_at: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      AuditLog.countDocuments(filter)
    ]);

    return response.paginated(res, mapKeys(logs), { page, limit, total });
  } catch (error) {
    logger.error('[Audit] listAuditLogs error:', error);
    return response.serverError(res, error.message);
  }
};
