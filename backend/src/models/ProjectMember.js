/**
 * ProjectMember Model
 *
 * Represents a user's membership/access to a project.
 * Used for project sharing functionality.
 */

const mongoose = require('mongoose');

const projectMemberSchema = new mongoose.Schema({
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  project_id: {
    type: String,
    required: true,
    index: true
  },
  user_id: {
    type: Number,
    required: true,
    index: true
  },
  role: {
    type: String,
    enum: ['viewer', 'editor', 'admin'],
    default: 'viewer'
  },
  added_by: {
    type: Number,
    required: true
  },
  added_at: {
    type: Date,
    default: Date.now
  }
}, {
  collection: 'project_members',
  timestamps: false
});

// Compound unique index to prevent duplicate memberships
projectMemberSchema.index({ project_id: 1, user_id: 1 }, { unique: true });

// Static method to generate unique ID
projectMemberSchema.statics.generateId = function() {
  return new mongoose.Types.ObjectId().toString();
};

// Check if user has at least the specified role level
projectMemberSchema.statics.hasRole = function(userRole, requiredRole) {
  const roleHierarchy = { viewer: 1, editor: 2, admin: 3 };
  return roleHierarchy[userRole] >= roleHierarchy[requiredRole];
};

const ProjectMember = mongoose.model('ProjectMember', projectMemberSchema);

module.exports = ProjectMember;
