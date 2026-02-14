/**
 * Project Validation Schemas
 */

const Joi = require('joi');

const createProjectSchema = {
  body: Joi.object({
    project_name: Joi.string().pattern(/^[a-zA-Z0-9 _\-().]+$/).max(255).required()
      .messages({ 'string.pattern.base': 'Project name can only contain letters, numbers, spaces, hyphens, underscores, parentheses, and periods' }),
    description: Joi.string().max(5000).allow('').default(''),
    movie_directory: Joi.string().max(1024).allow('', null)
  })
};

const updateProjectSchema = {
  body: Joi.object({
    project_name: Joi.string().pattern(/^[a-zA-Z0-9 _\-().]+$/).max(255)
      .messages({ 'string.pattern.base': 'Project name can only contain letters, numbers, spaces, hyphens, underscores, parentheses, and periods' }),
    description: Joi.string().max(5000).allow(''),
    webhook_urls: Joi.array().items(
      Joi.string().uri({ scheme: 'https' })
    ).max(5),
    is_archived: Joi.boolean()
  }).min(1)
};

module.exports = {
  createProjectSchema,
  updateProjectSchema
};
