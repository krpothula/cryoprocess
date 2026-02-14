/**
 * Password Reset Token Model
 *
 * Stores single-use, time-limited tokens for self-service password reset.
 */

const mongoose = require('mongoose');

const passwordResetTokenSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  user_id: {
    type: Number,
    required: true,
    index: true
  },
  expires_at: {
    type: Date,
    required: true
  },
  used: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: { createdAt: 'created_at', updatedAt: false }
});

// TTL index: auto-delete expired tokens after 1 hour past expiry
passwordResetTokenSchema.index({ expires_at: 1 }, { expireAfterSeconds: 3600 });

module.exports = mongoose.model('PasswordResetToken', passwordResetTokenSchema);
