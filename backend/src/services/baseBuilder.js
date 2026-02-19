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
const { getKnownFlags } = require('../config/relionFlags');
const { getThreads, isGpuEnabled, getGpuIds, getParam, getBoolParam } = require('../utils/paramHelper');

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
    if (this.data.inputJobIds && this.data.inputJobIds.length > 0) {
      return this.data.inputJobIds;
    }

    // Otherwise, extract job names from input file paths
    const jobNames = new Set();
    const inputFields = [
      // STAR file inputs
      'inputStarFile', 'inputMicrographs', 'micrographStarFile',
      'inputCoordinates', 'inputParticles', 'particlesStarFile',
      'inputMovies', 'ctfStarFile', 'autopickStarFile',
      'refinementStarFile', 'particleStarFile', 'inputImages',
      'inputStarMicrograph', 'micrographsCtfFile', 'coordinatesFile',
      // MRC/Map file inputs
      'maskFile', 'referenceMap', 'referenceMask', 'inputMap', 'inputVolume',
      'halfMap1', 'halfMap2', 'inputModel', 'sharpenedMap',
      'referenceVolume', 'solventMask', 'inputMask',
      // Model inputs
      'inputPdb', 'inputPdbFile', 'pdbFile',
      // Multi-body inputs
      'bodyStarFile',
      // CTF Refine inputs
      'particlesStar', 'postProcessStar', 'postprocessStar',
      // Polish inputs
      'polishStarFile', 'particlesFile', 'micrographsFile', 'postProcessStarFile',
      // Subtract inputs
      'subtractStarFile', 'optimiserStar', 'maskOfSignal',
      'inputParticlesStar', 'revertParticles',
      // Local resolution inputs
      'localresStarFile',
      // Join star inputs
      'particlesStarFile1', 'particlesStarFile2', 'particlesStarFile3', 'particlesStarFile4',
      'micrographStarFile1', 'micrographStarFile2', 'micrographStarFile3', 'micrographStarFile4',
      'movieStarFile1', 'movieStarFile2', 'movieStarFile3', 'movieStarFile4',
      // Subset inputs
      'microGraphsStar', 'micrographsStar',
      // DynaMight inputs
      'micrographs', 'inputFile', 'checkpointFile', 'consensusMap',
      // Class selection / subset inputs (ManualSelect, Subset)
      'classFromJob',
      'selectClassesFromJob'
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
   * Get the subdirectory (relative to the job output dir) where RELION writes
   * per-micrograph output files.  RELION mirrors the input micrograph path
   * structure, so for downstream jobs the outputs are nested, e.g.
   *   CtfFind/Job005/MotionCorr/Job003/Movies/*.ctf
   *
   * This reads the primary input STAR file, extracts the first micrograph path,
   * and returns its directory component (e.g. "MotionCorr/Job003/Movies").
   *
   * Returns null when not applicable (iterative jobs, Import, etc.).
   * Subclasses may override if they use a different input field.
   * @returns {string|null}
   */
  getProgressSubdir() {
    // Only relevant for downstream per-micrograph jobs that mirror input paths.
    // MotionCorr uses config.subdir='Movies' in PROGRESS_CONFIG (no DB storage needed).
    const perMicTypes = ['CtfFind', 'AutoPick', 'Extract'];
    if (!perMicTypes.includes(this.stageName)) {
      return null;
    }

    try {
      const { getFirstMoviePathSync } = require('../utils/starParser');

      // Find the primary input STAR file
      const inputFields = [
        'inputStarFile', 'inputMicrographs', 'micrographStarFile',
        'inputCoordinates', 'coordinatesFile', 'inputMovies'
      ];
      let starPath = null;
      for (const field of inputFields) {
        const val = this.data[field];
        if (val && typeof val === 'string') {
          starPath = this.resolveInputPath(val);
          break;
        }
      }
      if (!starPath) return null;

      // Read the first micrograph path from the STAR file
      const firstMicPath = getFirstMoviePathSync(starPath);
      if (!firstMicPath) return null;

      // Return the directory portion (e.g. "MotionCorr/Job003/Movies")
      const subdir = path.dirname(firstMicPath);
      if (subdir === '.' || !subdir) return null;

      logger.info(`[${this.stageName}] Progress subdir resolved: ${subdir}`);
      return subdir;
    } catch (err) {
      logger.warn(`[${this.stageName}] Could not resolve progress subdir: ${err.message}`);
      return null;
    }
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
    cmd.push('--pipeline_control', relOutputDir + path.sep);
  }

  /**
   * Add MPI/threading flags
   * @param {string[]} cmd - Command array
   */
  addMpiFlags(cmd) {
    const threads = getThreads(this.data);
    if (threads > 1) {
      cmd.push('--j', String(threads));
    }
  }

  /**
   * Add GPU flags
   * @param {string[]} cmd - Command array
   */
  addGpuFlags(cmd) {
    if (this.supportsGpu && isGpuEnabled(this.data)) {
      const gpuIds = getGpuIds(this.data);
      cmd.push('--gpu', gpuIds);
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
    const additionalArgs = getParam(this.data, ['additionalArguments', 'arguments'], null);
    if (!additionalArgs || !String(additionalArgs).trim()) return;

    const raw = String(additionalArgs).trim();

    // Block shell injection patterns
    const dangerous = /[;|&`$()<>{}!\\\n\r]/;
    if (dangerous.test(raw)) {
      logger.warn(`[BaseBuilder] Blocked dangerous characters in additional arguments: ${raw.substring(0, 80)}`);
      return;
    }

    // Extract RELION program name from command array for flag validation
    // Handles both direct (relion_import) and MPI (relion_refine_mpi) names
    const rawProgram = cmd.find(c => typeof c === 'string' && c.startsWith('relion_'));
    const relionProgram = rawProgram ? rawProgram.replace(/_mpi$/, '') : null;
    const knownFlags = relionProgram ? getKnownFlags(relionProgram) : null;

    // Parse respecting quoted strings
    const args = raw.match(/(?:[^\s"]+|"[^"]*")+/g) || [];
    for (const arg of args) {
      const clean = arg.replace(/"/g, '');
      // Each token must be a RELION flag (--name) or a plain value (number, path, string)
      if (clean.startsWith('-') && !/^--?[\w][\w-]*$/.test(clean)) {
        logger.warn(`[BaseBuilder] Skipping invalid flag: ${clean}`);
        continue;
      }
      // Warn if flag is not in the known registry (still pass through — RELION versions may differ)
      if (knownFlags && clean.startsWith('--') && !knownFlags.has(clean)) {
        logger.warn(`[${this.stageName}] Unknown RELION flag for ${relionProgram}: ${clean} (passing through)`);
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
   * Override to false for non-MPI jobs (Import, etc.)
   * Used by job submission to prevent mpirun usage for non-MPI jobs.
   * @returns {boolean}
   */
  get supportsMpi() {
    return true;
  }

  /**
   * Build MPI command prefix for RELION commands.
   *
   * When submitting to SLURM queue:
   * - Just use the _mpi version of the command without mpirun
   * - The job submission layer handles MPI via SLURM's --ntasks
   * - For Singularity, MPI is handled via SLURM process allocation
   *
   * For local execution:
   * - Uses mpirun to launch MPI processes
   *
   * @param {string} relionCommand - The RELION command (e.g., 'relion_refine')
   * @param {number} mpiProcs - Number of MPI processes
   * @param {boolean} useGpu - Whether this job uses GPU
   * @returns {string[]} Command prefix array
   */
  buildMpiCommand(relionCommand, mpiProcs, useGpu = false) {
    const submitToQueue = getBoolParam(this.data, ['submitToQueue', 'SubmitToQueue'], true);
    const cmd = [];

    if (mpiProcs <= 1) {
      // Single process, no MPI launcher needed
      cmd.push(relionCommand);
      return cmd;
    }

    const mpiCommand = relionCommand + '_mpi';

    // When submitting to SLURM queue, don't add mpirun here.
    // The job submission layer handles MPI:
    // - For Singularity: SLURM's --ntasks allocates processes, MPI inside container picks them up
    // - For native MPI: jobSubmission.js adds mpirun to the SLURM script
    if (submitToQueue) {
      cmd.push(mpiCommand);
      logger.info(`[${this.stageName}] MPI command (SLURM): ${mpiCommand} (mpi=${mpiProcs}, gpu=${useGpu})`);
      return cmd;
    }

    // Local execution - need explicit MPI launcher
    cmd.push('mpirun', '-np', String(mpiProcs), mpiCommand);

    logger.info(`[${this.stageName}] MPI command (local): ${cmd.join(' ')} (gpu=${useGpu})`);
    return cmd;
  }
}

module.exports = BaseJobBuilder;
