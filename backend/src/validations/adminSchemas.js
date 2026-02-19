/**
 * Admin Validation Schemas
 */

const Joi = require('joi');

const createUserSchema = {
  body: Joi.object({
    username: Joi.string().pattern(/^[a-zA-Z0-9_.\-]+$/).max(64).required()
      .messages({ 'string.pattern.base': 'Username must contain only letters, numbers, underscore, dot, or hyphen' }),
    email: Joi.string().email().max(254).required(),
    firstName: Joi.string().max(100).allow('').default(''),
    lastName: Joi.string().max(100).allow('').default(''),
    isStaff: Joi.boolean().default(false),
    isSuperuser: Joi.boolean().default(false)
  })
};

const updateUserSchema = {
  body: Joi.object({
    firstName: Joi.string().max(100).allow(''),
    lastName: Joi.string().max(100).allow(''),
    email: Joi.string().email().max(254),
    isActive: Joi.boolean(),
    isStaff: Joi.boolean(),
    isSuperuser: Joi.boolean()
  }).min(1)
};

module.exports = {
  createUserSchema,
  updateUserSchema
};
