/**
 * Audit Log Model
 *
 * Tracks user actions for security and compliance.
 * TTL index auto-deletes entries after 90 days.
 */

const mongoose = require('mongoose');

const AUDIT_ACTIONS = [
  // Auth
  'login', 'logout', 'register', 'password_change', 'password_reset',
  'forgot_password',
  // Projects
  'project_create', 'project_update', 'project_delete',
  'project_archive', 'project_restore',
  // Jobs
  'job_submit', 'job_cancel',
  // Admin
  'admin_create_user', 'admin_update_user', 'admin_delete_user',
  'admin_reset_password', 'admin_generate_api_key', 'admin_revoke_api_key'
];

const auditLogSchema = new mongoose.Schema({
  user_id: {
    type: Number,
    default: null,
    index: true
  },
  username: {
    type: String,
    default: ''
  },
  action: {
    type: String,
    required: true,
    enum: AUDIT_ACTIONS,
    index: true
  },
  resource_type: {
    type: String,
    default: ''
  },
  resource_id: {
    type: String,
    default: ''
  },
  details: {
    type: String,
    default: ''
  },
  ip_address: {
    type: String,
    default: ''
  },
  created_at: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  collection: 'audit_logs',
  timestamps: false
});

// Auto-delete after 90 days
auditLogSchema.index({ created_at: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

// Compound index for common queries
auditLogSchema.index({ action: 1, created_at: -1 });

/**
 * Static convenience method for fire-and-forget logging
 */
auditLogSchema.statics.log = function(data) {
  return this.create(data).catch(() => {
    // Swallow errors — audit logging should never break the app
  });
};

const AuditLog = mongoose.model('AuditLog', auditLogSchema);

module.exports = AuditLog;
module.exports.AUDIT_ACTIONS = AUDIT_ACTIONS;
