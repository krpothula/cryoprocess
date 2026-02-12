/**
 * Field Encryption Utility
 *
 * AES-256-GCM encryption for sensitive fields stored in MongoDB
 * (e.g., SSH private keys). Key is derived from JWT_SECRET.
 *
 * Stored format: iv:authTag:ciphertext (all hex-encoded)
 */

const crypto = require('crypto');
const settings = require('../config/settings');

/**
 * Derive a 32-byte AES key from JWT_SECRET
 */
function getDerivedKey() {
  return crypto.createHash('sha256').update(settings.JWT_SECRET).digest();
}

/**
 * Encrypt a plaintext string
 * @param {string} plaintext
 * @returns {string} iv:authTag:ciphertext (hex-encoded)
 */
function encryptField(plaintext) {
  const key = getDerivedKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt a stored encrypted string
 * @param {string} stored - iv:authTag:ciphertext (hex-encoded)
 * @returns {string} decrypted plaintext
 */
function decryptField(stored) {
  const parts = stored.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted field format');
  }
  const [ivHex, authTagHex, encrypted] = parts;
  const key = getDerivedKey();
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

module.exports = { encryptField, decryptField };
