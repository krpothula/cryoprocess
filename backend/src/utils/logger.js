/**
 * Logger Utility
 *
 * Centralized logging using Winston with enhanced formatting for job tracking.
 */

const winston = require('winston');
const path = require('path');
const fs = require('fs');

// Ensure logs directory exists
const logsDir = path.join(__dirname, '../../logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Custom format for console output with colors
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level}] ${message}`;
    if (Object.keys(meta).length > 0 && Object.keys(meta)[0] !== 'stack') {
      msg += ` ${JSON.stringify(meta)}`;
    }
    if (meta.stack) {
      msg += `\n${meta.stack}`;
    }
    return msg;
  })
);

// Custom format for file output (no colors)
const fileFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let msg = `${timestamp} [${level.toUpperCase().padEnd(5)}] ${message}`;
    if (Object.keys(meta).length > 0 && meta.stack) {
      msg += `\n${meta.stack}`;
    } else if (Object.keys(meta).length > 0) {
      msg += ` ${JSON.stringify(meta)}`;
    }
    return msg;
  })
);

// JSON format for production (machine-parsable, ideal for log aggregators)
const jsonFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

const isProduction = process.env.NODE_ENV === 'production';

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  transports: [
    // Console output — JSON in production, pretty colors in dev
    new winston.transports.Console({
      format: isProduction ? jsonFormat : consoleFormat
    }),
    // Combined log file
    new winston.transports.File({
      filename: path.join(logsDir, 'combined.log'),
      format: isProduction ? jsonFormat : fileFormat,
      maxsize: 10 * 1024 * 1024, // 10MB
      maxFiles: 5
    }),
    // Error-only log file
    new winston.transports.File({
      filename: path.join(logsDir, 'error.log'),
      level: 'error',
      format: isProduction ? jsonFormat : fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    }),
    // Jobs-only log file
    new winston.transports.File({
      filename: path.join(logsDir, 'jobs.log'),
      format: isProduction ? jsonFormat : fileFormat,
      maxsize: 10 * 1024 * 1024,
      maxFiles: 5
    })
  ]
});

/**
 * Job Logger - Enhanced logging specifically for job operations
 * Provides consistent formatting and easy-to-read output
 */
const jobLogger = {
  /**
   * Log job submission start
   */
  start: (jobType, projectId, userId) => {
    const line = '='.repeat(70);
    logger.info(`\n${line}`);
    logger.info(`[JOB:${jobType.toUpperCase()}] NEW SUBMISSION`);
    logger.info(`  Project: ${projectId}`);
    logger.info(`  User: ${userId}`);
    logger.info(`  Time: ${new Date().toISOString()}`);
  },

  /**
   * Log a step in job processing
   */
  step: (jobType, stepNum, stepName, details = {}) => {
    let msg = `[JOB:${jobType.toUpperCase()}] Step ${stepNum}: ${stepName}`;
    if (Object.keys(details).length > 0) {
      const detailStr = Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(' | ');
      msg += ` | ${detailStr}`;
    }
    logger.info(msg);
  },

  /**
   * Log job success
   */
  success: (jobType, jobId, jobName, slurmId = null) => {
    logger.info(`[JOB:${jobType.toUpperCase()}] SUCCESS`);
    logger.info(`  Job ID: ${jobId}`);
    logger.info(`  Job Name: ${jobName}`);
    if (slurmId) {
      logger.info(`  SLURM ID: ${slurmId}`);
    }
    logger.info('='.repeat(70));
  },

  /**
   * Log job failure
   */
  error: (jobType, error, jobId = null) => {
    logger.error(`[JOB:${jobType.toUpperCase()}] FAILED`);
    if (jobId) {
      logger.error(`  Job ID: ${jobId}`);
    }
    logger.error(`  Error: ${error.message || error}`);
    if (error.stack) {
      logger.error(`  Stack: ${error.stack}`);
    }
    logger.error('='.repeat(70));
  },

  /**
   * Log job parameters (for debugging)
   */
  params: (jobType, params) => {
    logger.debug(`[JOB:${jobType.toUpperCase()}] Parameters:`);
    Object.entries(params).forEach(([key, value]) => {
      if (key !== 'project_id' && value !== undefined && value !== null && value !== '') {
        logger.debug(`  ${key}: ${typeof value === 'object' ? JSON.stringify(value) : value}`);
      }
    });
  },

  /**
   * Log command being executed
   */
  command: (jobType, cmd) => {
    if (!cmd) {
      logger.info(`[JOB:${jobType.toUpperCase()}] No command (direct execution)`);
      return;
    }
    const cmdStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;
    logger.info(`[JOB:${jobType.toUpperCase()}] Command:`);
    // Split long commands for readability
    if (cmdStr.length > 100) {
      const parts = cmdStr.split(' --');
      logger.info(`  ${parts[0]}`);
      parts.slice(1).forEach(part => {
        logger.info(`    --${part}`);
      });
    } else {
      logger.info(`  ${cmdStr}`);
    }
  }
};

/**
 * API Logger - For request/response tracking
 */
const apiLogger = {
  /**
   * Log incoming request
   */
  request: (method, path, userId = null) => {
    const userStr = userId ? ` [user:${userId}]` : '';
    logger.info(`[API] ${method} ${path}${userStr}`);
  },

  /**
   * Log response
   */
  response: (method, path, statusCode, duration = null) => {
    const durationStr = duration ? ` (${duration}ms)` : '';
    const level = statusCode >= 400 ? 'warn' : 'info';
    logger[level](`[API] ${method} ${path} -> ${statusCode}${durationStr}`);
  },

  /**
   * Log API error
   */
  error: (method, path, error) => {
    logger.error(`[API] ${method} ${path} ERROR: ${error.message}`);
  }
};

/**
 * SLURM Logger - For cluster operations
 */
const slurmLogger = {
  /**
   * Log SLURM submission
   */
  submit: (jobName, slurmId, partition = null) => {
    let msg = `[SLURM] Submitted: ${jobName} -> SLURM ID: ${slurmId}`;
    if (partition) {
      msg += ` (partition: ${partition})`;
    }
    logger.info(msg);
  },

  /**
   * Log SLURM status change
   */
  statusChange: (slurmId, oldStatus, newStatus) => {
    logger.info(`[SLURM] Status change: ${slurmId} ${oldStatus} -> ${newStatus}`);
  },

  /**
   * Log SLURM query
   */
  query: (queryType, result) => {
    logger.debug(`[SLURM] Query ${queryType}: ${JSON.stringify(result)}`);
  }
};

/**
 * Project Logger - Writes logs to project-specific log files
 * Note: Log data is read from the Job model, not from these files
 */
const projectLoggers = new Map();

// Clean format for project logs (no timestamp/level prefix)
const cleanFormat = winston.format.printf(({ message }) => message);

const getProjectLogger = (projectPath, projectId) => {
  if (!projectPath) return null;

  const key = projectId || projectPath;
  if (projectLoggers.has(key)) {
    return projectLoggers.get(key);
  }

  const logPath = path.join(projectPath, `${projectId || 'project'}.log`);

  const projectLogger = winston.createLogger({
    level: 'info',
    format: cleanFormat,
    transports: [
      new winston.transports.File({
        filename: logPath,
        maxsize: 5 * 1024 * 1024, // 5MB
        maxFiles: 3
      })
    ]
  });

  projectLoggers.set(key, projectLogger);
  return projectLogger;
};

// Job type display names
const JOB_TYPE_NAMES = {
  'import': 'Import',
  'motion_correction': 'Motion Correction',
  'motioncorr': 'Motion Correction',
  'ctf_estimation': 'CTF Estimation',
  'ctf': 'CTF Estimation',
  'auto_picking': 'Auto Picking',
  'autopick': 'Auto Picking',
  'particle_extraction': 'Particle Extraction',
  'extract': 'Particle Extraction',
  'class_2d': '2D Classification',
  'class2d': '2D Classification',
  'class_3d': '3D Classification',
  'class3d': '3D Classification',
  'initial_model': 'Initial Model',
  'initialmodel': 'Initial Model',
  'auto_refine': 'Auto Refine',
  'autorefine': 'Auto Refine',
  'postprocess': 'Post Processing',
  'polish': 'Bayesian Polishing',
  'ctf_refine': 'CTF Refinement',
  'mask_create': 'Mask Creation',
  'local_resolution': 'Local Resolution',
  'dynamight': 'DynaMight',
  'model_angelo': 'ModelAngelo'
};

const getJobTypeName = (jobType) => {
  return JOB_TYPE_NAMES[jobType?.toLowerCase()] || jobType;
};

const projectJobLogger = {
  /**
   * Log job submission start to project log
   */
  start: (projectPath, projectId, jobType, userId) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    const jobName = getJobTypeName(jobType);
    const line = '─'.repeat(50);

    if (pLogger) {
      pLogger.info(`\n${line}`);
      pLogger.info(`${jobName} Job`);
      pLogger.info(line);
    }
  },

  /**
   * Log a step to project log
   */
  step: (projectPath, projectId, jobType, stepNum, stepName, details = {}) => {
    const pLogger = getProjectLogger(projectPath, projectId);

    let msg = `Step ${stepNum}: ${stepName}`;
    if (Object.keys(details).length > 0) {
      const detailStr = Object.entries(details)
        .map(([k, v]) => `${k}=${v}`)
        .join(' | ');
      msg += ` | ${detailStr}`;
    }

    if (pLogger) pLogger.info(msg);
  },

  /**
   * Log info message to project log
   */
  info: (projectPath, projectId, prefix, message) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    if (pLogger) pLogger.info(message);
  },

  /**
   * Log warning to project log
   */
  warn: (projectPath, projectId, prefix, message) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    if (pLogger) pLogger.warn(`Warning: ${message}`);
  },

  /**
   * Log command to project log
   */
  command: (projectPath, projectId, jobType, cmd) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    if (!pLogger) return;

    if (!cmd) {
      pLogger.info('Command: (direct execution - no shell command)');
      return;
    }

    const cmdStr = Array.isArray(cmd) ? cmd.join(' ') : cmd;

    pLogger.info('Command:');
    if (cmdStr.length > 80) {
      const parts = cmdStr.split(' --');
      pLogger.info(`  ${parts[0]}`);
      parts.slice(1).forEach(part => {
        pLogger.info(`    --${part}`);
      });
    } else {
      pLogger.info(`  ${cmdStr}`);
    }
  },

  /**
   * Log job success to project log
   */
  success: (projectPath, projectId, jobType, jobId, jobName, slurmId = null) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    if (!pLogger) return;

    pLogger.info(`Job: ${jobName} | ID: ${jobId}` + (slurmId ? ` | SLURM: ${slurmId}` : ''));
    pLogger.info('Status: SUCCESS');
    pLogger.info('─'.repeat(50));
  },

  /**
   * Log job failure to project log
   */
  error: (projectPath, projectId, jobType, error, jobId = null) => {
    const pLogger = getProjectLogger(projectPath, projectId);
    if (!pLogger) return;

    pLogger.error('Status: FAILED');
    pLogger.error(`Error: ${error.message || error}`);
    pLogger.error('─'.repeat(50));
  }
};

// Attach specialized loggers
logger.job = jobLogger;
logger.api = apiLogger;
logger.slurm = slurmLogger;
logger.project = projectJobLogger;

module.exports = logger;
