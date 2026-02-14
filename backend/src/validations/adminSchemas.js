/**
 * Admin Validation Schemas
 */

const Joi = require('joi');

const createUserSchema = {
  body: Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_.\-]+$/).max(64).required()
      .messages({ 'string.pattern.base': 'Username must contain only letters, numbers, underscore, dot, or hyphen' }),
    email: Joi.string().email().max(254).required(),
    first_name: Joi.string().max(100).allow('').default(''),
    last_name: Joi.string().max(100).allow('').default(''),
    is_staff: Joi.boolean().default(false),
    is_superuser: Joi.boolean().default(false)
  })
};

const updateUserSchema = {
  body: Joi.object({
    first_name: Joi.string().max(100).allow(''),
    last_name: Joi.string().max(100).allow(''),
    email: Joi.string().email().max(254),
    is_active: Joi.boolean(),
    is_staff: Joi.boolean(),
    is_superuser: Joi.boolean()
  }).min(1)
};

module.exports = {
  createUserSchema,
  updateUserSchema
};
