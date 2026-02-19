/**
 * Audit Controller
 *
 * Admin-only endpoint to view audit logs.
 */

const AuditLog = require('../models/AuditLog');
const response = require('../utils/responseHelper');
const logger = require('../utils/logger');
const { mapKeys } = require('../utils/mapKeys');
const { parsePagination } = require('../utils/pagination');

/**
 * List audit logs with filters and pagination
 * GET /api/admin/audit?page=1&limit=50&action=login&user_id=1
 */
exports.listAuditLogs = async (req, res) => {
  try {
    const { page, limit, skip } = parsePagination(req.query, { maxLimit: 200 });

    // Build filter
    const filter = {};
    if (req.query.action) {
      filter.action = req.query.action;
    }
    if (req.query.userId) {
      filter.user_id = parseInt(req.query.userId);
    }
    if (req.query.username) {
      filter.username = { $regex: req.query.username, $options: 'i' };
    }
    if (req.query.resourceType) {
      filter.resource_type = req.query.resourceType;
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
