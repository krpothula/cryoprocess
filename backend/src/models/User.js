/**
 * User Model
 *
 * Simple user model for authentication.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const settings = require('../config/settings');

const userSchema = new mongoose.Schema({
  id: {
    type: Number,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    lowercase: true
  },
  password: {
    type: String,
    required: true,
    select: false
  },
  first_name: {
    type: String,
    default: ''
  },
  last_name: {
    type: String,
    default: ''
  },
  is_active: {
    type: Boolean,
    default: true
  },
  is_staff: {
    type: Boolean,
    default: false
  },
  is_superuser: {
    type: Boolean,
    default: false
  },
  must_change_password: {
    type: Boolean,
    default: false
  },
  date_joined: {
    type: Date,
    default: Date.now
  },
  last_login: {
    type: Date,
    default: null
  },
  cluster_username: {
    type: String,
    default: ''
  },
  cluster_ssh_key: {
    type: String,
    default: '',
    select: false
  },
  cluster_connected: {
    type: Boolean,
    default: false
  },
  cluster_enabled: {
    type: Boolean,
    default: false
  },
  api_key_hash: {
    type: String,
    default: null,
    index: true,
    select: false
  }
}, {
  collection: 'users',
  timestamps: false
});

// Pre-save middleware to hash password
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();

  const salt = await bcrypt.genSalt(10);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Generate JWT token
userSchema.methods.generateAuthToken = function() {
  return jwt.sign(
    {
      id: this.id,
      username: this.username,
      email: this.email
    },
    settings.JWT_SECRET,
    { expiresIn: settings.JWT_EXPIRES_IN }
  );
};

// Get next user ID
userSchema.statics.getNextId = async function() {
  const lastUser = await this.findOne().sort({ id: -1 }).select('id').lean();
  return (lastUser?.id || 0) + 1;
};

const User = mongoose.model('User', userSchema);

module.exports = User;
