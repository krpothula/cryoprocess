/**
 * Audit Logger Utility
 *
 * Fire-and-forget helper to log user actions.
 * Never throws — audit logging should not disrupt the request.
 */

const AuditLog = require('../models/AuditLog');

/**
 * Log an audit event (fire-and-forget).
 *
 * @param {Object} req - Express request (uses req.user, req.ip)
 * @param {string} action - One of AUDIT_ACTIONS enum values
 * @param {Object} [opts]
 * @param {string} [opts.resourceType] - e.g. 'project', 'user', 'job'
 * @param {string} [opts.resourceId]   - ID of the affected resource
 * @param {string} [opts.details]      - Human-readable description
 */
function auditLog(req, action, opts = {}) {
  const user = req?.user;
  AuditLog.log({
    user_id: user?.id || null,
    username: user?.username || '',
    action,
    resource_type: opts.resourceType || '',
    resource_id: String(opts.resourceId || ''),
    details: opts.details || '',
    ip_address: req?.ip || ''
  });
}

module.exports = auditLog;
