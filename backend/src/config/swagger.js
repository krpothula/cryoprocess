const swaggerJsdoc = require('swagger-jsdoc');

const options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'CryoProcess API',
      version: '1.0.0',
      description: 'REST API for CryoProcess — cryo-EM data processing job submission and management',
    },
    servers: [
      { url: '/api', description: 'API server' },
    ],
    components: {
      securitySchemes: {
        cookieAuth: {
          type: 'apiKey',
          in: 'cookie',
          name: 'token',
          description: 'JWT token stored in HttpOnly cookie',
        },
      },
      schemas: {
        Error: {
          type: 'object',
          properties: {
            success: { type: 'boolean', example: false },
            message: { type: 'string' },
          },
        },
        Project: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            project_name: { type: 'string' },
            description: { type: 'string' },
            project_dir: { type: 'string' },
            webhook_urls: { type: 'array', items: { type: 'string' } },
            creation_date: { type: 'string', format: 'date-time' },
            created_by_id: { type: 'integer' },
          },
        },
        Job: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            job_type: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'running', 'success', 'failed', 'cancelled'] },
            slurm_job_id: { type: 'string' },
            project_id: { type: 'string' },
            start_time: { type: 'string', format: 'date-time' },
            end_time: { type: 'string', format: 'date-time' },
          },
        },
        User: {
          type: 'object',
          properties: {
            id: { type: 'integer' },
            username: { type: 'string' },
            email: { type: 'string' },
            first_name: { type: 'string' },
            last_name: { type: 'string' },
            is_staff: { type: 'boolean' },
            is_superuser: { type: 'boolean' },
          },
        },
      },
    },
    security: [{ cookieAuth: [] }],
  },
  apis: ['./src/routes/*.js'],
};

const swaggerSpec = swaggerJsdoc(options);

module.exports = swaggerSpec;
