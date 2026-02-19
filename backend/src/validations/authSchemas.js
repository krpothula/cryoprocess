/**
 * Auth Validation Schemas
 */

const Joi = require('joi');

const loginSchema = {
  body: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  })
};

const registerSchema = {
  body: Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_.\-]+$/).max(64).required()
      .messages({ 'string.pattern.base': 'Username must contain only letters, numbers, underscore, dot, or hyphen' }),
    email: Joi.string().email().max(254).required(),
    password: Joi.string().min(8).max(128).required(),
    firstName: Joi.string().max(100).allow('').default(''),
    lastName: Joi.string().max(100).allow('').default('')
  })
};

const changePasswordSchema = {
  body: Joi.object({
    currentPassword: Joi.string().required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'New password and confirmation do not match' })
  })
};

const updateProfileSchema = {
  body: Joi.object({
    firstName: Joi.string().max(100).allow(''),
    lastName: Joi.string().max(100).allow(''),
    email: Joi.string().email().max(254)
  })
};

const forgotPasswordSchema = {
  body: Joi.object({
    email: Joi.string().email().required()
  })
};

const resetPasswordSchema = {
  body: Joi.object({
    token: Joi.string().hex().length(64).required(),
    newPassword: Joi.string().min(8).max(128).required(),
    confirmPassword: Joi.string().valid(Joi.ref('newPassword')).required()
      .messages({ 'any.only': 'New password and confirmation do not match' })
  })
};

module.exports = {
  loginSchema,
  registerSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema
};
