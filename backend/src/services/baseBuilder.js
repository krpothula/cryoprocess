/**
 * Base Job Builder
 *
 * Abstract base class for all RELION job builders.
 */

const path = require('path');
const fs = require('fs');
const logger = require('../utils/logger');
const { getProjectPath } = require('../utils/pathUtils');
const settings = require('../config/settings');

class BaseJobBuilder {
  constructor(data, project, user) {
    this.data = data;
    this.project = project;
    this.user = user;
    this.projectPath = getProjectPath(project);
    this.stageName = 'Unknown';
  }

  /**
   * Validate job parameters
   * @returns {{valid: boolean, error: string|null}}
   */
  validate() {
    throw new Error('validate() must be implemented by subclass');
  }

  /**
   * Build the RELION command
   * @param {string} outputDir - Output directory
   * @param {string} jobName - Job name
   * @returns {string[]} Command array
   */
  buildCommand(outputDir, jobName) {
    throw new Error('buildCommand() must be implemented by subclass');
  }

  /**
   * Get output directory for the job
   * @param {string} jobName - Job name (e.g., Job001)
   * @returns {string} Output directory path
   */
  getOutputDir(jobName) {
    const outputDir = path.join(this.projectPath, this.stageName, jobName);
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true, mode: 0o755 });
    }
    return outputDir;
  }

  /**
   * Get input job names for pipeline tree.
   * Extracts job names (e.g., "Job002") from input file paths.
   * These are used to establish parent-child relationships in the job tree.
   * @returns {string[]} Array of job names (e.g., ["Job002", "Job005"])
   */
  getInputJobIds() {
    // If explicitly provided, use those
    if (this.data.input_job_ids && this.data.input_job_ids.length > 0) {
      return this.data.input_job_ids;
    }

    // Otherwise, extract job names from input file paths
    const jobNames = new Set();
    const inputFields = [
      // STAR file inputs
      'inputStarFile', 'inputMicrographs', 'micrographStarFile',
      'inputCoordinates', 'inputParticles', 'particlesStarFile',
      'input_star_file', 'inputMovies', 'ctfStarFile', 'autopickStarFile',
      'refinementStarFile', 'particleStarFile', 'inputImages',
      'inputStarMicrograph', 'micrographsCtfFile', 'coordinatesFile',
      // MRC/Map file inputs
      'maskFile', 'referenceMap', 'inputMap', 'inputVolume',
      'halfMap1', 'halfMap2', 'inputModel', 'sharpenedMap',
      'referenceVolume', 'solventMask', 'inputMask',
      // Model inputs
      'inputPdb', 'inputPdbFile', 'pdbFile',
      // Multi-body inputs
      'bodyStarFile',
      // Polish inputs
      'polishStarFile',
      // Subtract inputs
      'subtractStarFile',
      // Local resolution inputs
      'localresStarFile',
      // Join star inputs
      'particlesStarFile1', 'particlesStarFile2', 'particlesStarFile3', 'particlesStarFile4',
      // Class selection / subset inputs (ManualSelect, Subset)
      'classFromJob', 'class_from_job',
      'selectClassesFromJob', 'select_classes_from_job'
    ];

    for (const field of inputFields) {
      const value = this.data[field];
      if (value && typeof value === 'string') {
        // Extract JobXXX from paths like "MotionCorr/Job002/file.star"
        const match = value.match(/Job(\d+)/i);
        if (match) {
          // Normalize to Job### format (e.g., Job002)
          const jobNum = parseInt(match[1], 10);
          jobNames.add(`Job${String(jobNum).padStart(3, '0')}`);
        }
      }
    }

    const result = Array.from(jobNames);
    if (result.length > 0) {
      logger.info(`[${this.stageName}] Extracted input jobs from paths: ${result.join(', ')}`);
    }
    return result;
  }

  /**
   * Get primary input job name
   * @returns {string}
   */
  getInputJobId() {
    const ids = this.getInputJobIds();
    return ids.length > 0 ? ids[0] : '';
  }

  /**
   * Resolve input STAR file path
   * @param {string} inputPath - Input path (absolute or relative)
   * @returns {string} Resolved path
   */
  resolveInputPath(inputPath) {
    if (!inputPath) return '';

    if (path.isAbsolute(inputPath)) {
      return inputPath;
    }
    return path.join(this.projectPath, inputPath);
  }

  /**
   * Make path relative to project
   * @param {string} fullPath - Absolute path
   * @returns {string} Relative path
   */
  makeRelative(fullPath) {
    if (!fullPath) return '';

    if (fullPath.startsWith(this.projectPath)) {
      return path.relative(this.projectPath, fullPath);
    }
    return fullPath;
  }

  /**
   * Validate that input file exists
   * @param {string} filePath - Path to check
   * @param {string} fieldName - Field name for error message
   * @returns {{valid: boolean, error: string|null}}
   */
  validateFileExists(filePath, fieldName) {
    if (!filePath) {
      return { valid: false, error: `${fieldName} is required` };
    }

    const resolvedPath = this.resolveInputPath(filePath);
    if (!fs.existsSync(resolvedPath)) {
      logger.warn(`[${this.stageName}] File not found: ${resolvedPath}`);
      return { valid: false, error: `${fieldName} not found: ${filePath}` };
    }

    return { valid: true, error: null };
  }

  /**
   * Add common RELION flags
   * @param {string[]} cmd - Command array
   * @param {string} outputDir - Output directory
   * @param {string} jobName - Job name
   */
  addCommonFlags(cmd, outputDir, jobName) {
    const relOutputDir = this.makeRelative(outputDir);
    cmd.push('--pipeline_control', path.resolve(outputDir) + path.sep);
  }

  /**
   * Add MPI/threading flags
   * @param {string[]} cmd - Command array
   */
  addMpiFlags(cmd) {
    const threads = this.data.threads || this.data.numberOfThreads || 1;
    if (threads > 1) {
      cmd.push('--j', String(threads));
    }
  }

  /**
   * Add GPU flags
   * @param {string[]} cmd - Command array
   */
  addGpuFlags(cmd) {
    const useGpu = this.data.use_gpu || this.data.useGpu;
    if (useGpu === 'Yes' || useGpu === true) {
      const gpuIds = this.data.gpu_ids || this.data.gpuIds || '0';
      cmd.push('--gpu', String(gpuIds));
    }
  }

  /**
   * Get post-processing command (optional)
   * @returns {string|null}
   */
  get postCommand() {
    return null;
  }

  /**
   * Add additional arguments from user input to command array.
   * Validates arguments are safe RELION-style flags (--flag value).
   * Blocks shell injection characters.
   * @param {string[]} cmd - Command array to append to
   */
  addAdditionalArguments(cmd) {
    const additionalArgs = this.data.AdditionalArguments
      || this.data.additionalArguments
      || this.data.arguments;
    if (!additionalArgs || !String(additionalArgs).trim()) return;

    const raw = String(additionalArgs).trim();

    // Block shell injection patterns
    const dangerous = /[;|&`$()<>{}!\\\n\r]/;
    if (dangerous.test(raw)) {
      logger.warn(`[BaseBuilder] Blocked dangerous characters in additional arguments: ${raw.substring(0, 80)}`);
      return;
    }

    // Parse respecting quoted strings
    const args = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    for (const arg of args) {
      const clean = arg.replace(/"/g, '');
      // Each token must be a RELION flag (--name) or a plain value (number, path, string)
      if (clean.startsWith('-') && !/^--?[\w][\w-]*$/.test(clean)) {
        logger.warn(`[BaseBuilder] Skipping invalid flag: ${clean}`);
        continue;
      }
      cmd.push(clean);
    }
  }

  /**
   * Whether this job type supports GPU acceleration.
   * Override to false for CPU-only jobs (Polish, CTFRefine, etc.)
   * Used by job submission to prevent GPU allocation for CPU-only jobs.
   * @returns {boolean}
   */
  get supportsGpu() {
    return true;
  }

  /**
   * Whether this job type supports MPI parallelization.
   * Override to false for non-MPI jobs (Import, LinkMovies, etc.)
   * Used by job submission to prevent srun usage for non-MPI jobs.
   * @returns {boolean}
   */
  get supportsMpi() {
    return true;
  }

  /**
   * Build MPI command prefix for RELION commands.
   *
   * When submitting to SLURM queue:
   * - Just use the _mpi version of the command without srun/mpirun
   * - The job submission layer handles MPI via SLURM's --ntasks
   * - For Singularity, MPI is handled via SLURM process allocation
   *
   * For local execution:
   * - Uses srun or mpirun based on MPI_LAUNCHER setting
   *
   * @param {string} relionCommand - The RELION command (e.g., 'relion_refine')
   * @param {number} mpiProcs - Number of MPI processes
   * @param {boolean} useGpu - Whether this job uses GPU
   * @returns {string[]} Command prefix array
   */
  buildMpiCommand(relionCommand, mpiProcs, useGpu = false) {
    const launcher = settings.MPI_LAUNCHER || 'srun';
    const submitToQueue = this.data.submitToQueue === 'Yes';
    const cmd = [];

    if (mpiProcs <= 1) {
      // Single process, no MPI launcher needed
      cmd.push(relionCommand);
      return cmd;
    }

    const mpiCommand = relionCommand + '_mpi';

    // When submitting to SLURM queue, don't add srun/mpirun here.
    // The job submission layer handles MPI:
    // - For Singularity: SLURM's --ntasks allocates processes, MPI inside container picks them up
    // - For native MPI: jobSubmission.js adds srun to the SLURM script
    if (submitToQueue) {
      cmd.push(mpiCommand);
      logger.info(`[${this.stageName}] MPI command (SLURM): ${mpiCommand} (mpi=${mpiProcs}, gpu=${useGpu})`);
      return cmd;
    }

    // Local execution - need explicit MPI launcher
    if (launcher === 'srun') {
      cmd.push('srun', '-n', String(mpiProcs));
      if (!useGpu) {
        cmd.push('--gpus=0');
      }
      cmd.push(mpiCommand);
    } else {
      // mpirun launcher
      cmd.push('mpirun', '-np', String(mpiProcs), mpiCommand);
    }

    logger.info(`[${this.stageName}] MPI command (local): ${cmd.join(' ')} (launcher=${launcher}, gpu=${useGpu})`);
    return cmd;
  }
}

module.exports = BaseJobBuilder;
