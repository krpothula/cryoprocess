/**
 * Project Model
 *
 * Represents a cryo-EM project in the system.
 */

const mongoose = require('mongoose');

const projectSchema = new mongoose.Schema({
  // Use custom string ID for compatibility with existing data
  id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  project_name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    default: ''
  },
  folder_name: {
    type: String,
    default: ''
  },
  created_by_id: {
    type: Number,
    required: true,
    index: true
  },
  is_archived: {
    type: Boolean,
    default: false
  },
  creation_date: {
    type: Date,
    default: Date.now
  },
  updated_at: {
    type: Date,
    default: Date.now
  },
  last_accessed_at: {
    type: Date,
    default: null
  }
}, {
  collection: 'projects',
  timestamps: false
});

// Pre-save middleware to update timestamps
projectSchema.pre('save', function(next) {
  this.updated_at = new Date();
  next();
});

// Static method to generate unique ID
projectSchema.statics.generateId = function() {
  return new mongoose.Types.ObjectId().toString();
};

// Instance method to get project path
projectSchema.methods.getPath = function(rootPath) {
  const folderName = this.folder_name || this.project_name.replace(/ /g, '_');
  const path = require('path');
  return path.join(rootPath, folderName);
};

// Virtual for job count (populated separately)
projectSchema.virtual('jobCount').get(function() {
  return this._jobCount || 0;
});

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
