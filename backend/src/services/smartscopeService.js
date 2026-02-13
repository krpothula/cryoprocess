/**
 * SmartScope Processing Service
 *
 * Handles single-micrograph processing for SmartScope integration.
 * Chains MotionCorr + CTF estimation in a single SLURM job,
 * then parses results into SmartScope's expected JSON format.
 */

const fs = require('fs');
const path = require('path');
const glob = require('glob');
const logger = require('../utils/logger');
const settings = require('../config/settings');
const { JOB_STATUS } = require('../config/constants');
const { writeStarFile, parseStarFile } = require('../utils/starParser');
const { execCommand, writeRemoteFile, isSSHMode } = require('../utils/remoteExec');
const { isPathSafe } = require('../utils/security');
const Job = require('../models/Job');

/**
 * Create a RELION STAR file for a single micrograph
 * @param {string} micrographPath - Absolute path to the micrograph/movie file
 * @param {Object} optics - { pixel_size, voltage, cs, amplitude_contrast }
 * @param {string} outputPath - Where to write the STAR file
 */
const createInputStar = (micrographPath, optics, outputPath) => {
  const starData = {
    data_optics: {
      columns: [
        'rlnOpticsGroupName',
        'rlnOpticsGroup',
        'rlnMicrographPixelSize',
        'rlnVoltage',
        'rlnSphericalAberration',
        'rlnAmplitudeContrast'
      ],
      data: [
        ['opticsGroup1', '1', String(optics.pixel_size), String(optics.voltage), String(optics.cs), String(optics.amplitude_contrast || 0.1)]
      ]
    },
    data_movies: {
      columns: [
        'rlnMicrographMovieName',
        'rlnOpticsGroup'
      ],
      data: [
        [micrographPath, '1']
      ]
    }
  };

  writeStarFile(outputPath, starData);
  logger.info(`[SmartScope] Input STAR written: ${outputPath}`);
};

/**
 * Generate a SLURM script that chains MotionCorr + CTF
 * @param {Object} options - Script options
 * @returns {string} SLURM script content
 */
const generateSlurmScript = (options) => {
  const {
    jobId,
    outputDir,
    partition,
    threads = 4,
    gpus = 0
  } = options;

  let script = `#!/bin/bash
#SBATCH --job-name=SmartScope_${jobId}
#SBATCH --output=${path.join(outputDir, 'run.out')}
#SBATCH --error=${path.join(outputDir, 'run.err')}
`;

  if (partition) {
    script += `#SBATCH --partition=${partition}\n`;
  }

  if (threads > 1) {
    script += `#SBATCH --cpus-per-task=${threads}\n`;
  }

  if (gpus > 0) {
    script += `#SBATCH --gres=gpu:${gpus}\n`;
  }

  script += `
# Suppress PMIx munge warnings
export PMIX_MCA_psec=native
export SINGULARITYENV_TORCH_HOME=\${HOME}/.cache/torch
export TORCH_HOME=\${HOME}/.cache/torch

cd ${outputDir}

`;

  // Build the two RELION commands
  const ctffindExe = settings.CTFFIND_EXE || 'ctffind';

  const motionCmd = [
    'relion_run_motioncorr',
    '--i', 'input.star',
    '--o', 'MotionCorr/',
    '--use_own',
    '--j', String(threads),
    '--bin_factor', '1',
    '--bfactor', '150',
    '--dose_per_frame', '0',
    '--patch_x', '5',
    '--patch_y', '5',
    '--pipeline_control', 'MotionCorr/'
  ].join(' ');

  const ctfCmd = [
    'relion_run_ctffind',
    '--i', 'MotionCorr/corrected_micrographs.star',
    '--o', 'CtfFind/',
    '--ctffind_exe', ctffindExe,
    '--Box', '512',
    '--ResMin', '30',
    '--ResMax', '5',
    '--dFMin', '5000',
    '--dFMax', '50000',
    '--FStep', '500',
    '--j', String(threads),
    '--pipeline_control', 'CtfFind/'
  ].join(' ');

  // Wrap with Singularity if configured
  const singularityAvailable = settings.SINGULARITY_IMAGE &&
    (isSSHMode() || fs.existsSync(settings.SINGULARITY_IMAGE));

  if (singularityAvailable) {
    let singPrefix = 'singularity exec';
    if (settings.SINGULARITY_BIND_PATHS) {
      singPrefix += ` --bind "${settings.SINGULARITY_BIND_PATHS}"`;
    }
    if (gpus > 0 && settings.SINGULARITY_OPTIONS) {
      singPrefix += ` ${settings.SINGULARITY_OPTIONS}`;
    }
    singPrefix += ` "${settings.SINGULARITY_IMAGE}"`;

    script += `# Step 1: Motion Correction\n`;
    script += `${singPrefix} ${motionCmd}\n`;
    script += `MOTION_EXIT=$?\n`;
    script += `if [ $MOTION_EXIT -ne 0 ]; then\n`;
    script += `  echo "Motion correction failed with exit code $MOTION_EXIT"\n`;
    script += `  touch RELION_JOB_EXIT_FAILURE\n`;
    script += `  exit $MOTION_EXIT\n`;
    script += `fi\n\n`;

    script += `# Step 2: CTF Estimation\n`;
    script += `${singPrefix} ${ctfCmd}\n`;
  } else {
    script += `# Step 1: Motion Correction\n`;
    script += `${motionCmd}\n`;
    script += `MOTION_EXIT=$?\n`;
    script += `if [ $MOTION_EXIT -ne 0 ]; then\n`;
    script += `  echo "Motion correction failed with exit code $MOTION_EXIT"\n`;
    script += `  touch RELION_JOB_EXIT_FAILURE\n`;
    script += `  exit $MOTION_EXIT\n`;
    script += `fi\n\n`;

    script += `# Step 2: CTF Estimation\n`;
    script += `${ctfCmd}\n`;
  }

  script += `
# Create RELION exit status markers
CMD_EXIT_CODE=$?
if [ $CMD_EXIT_CODE -eq 0 ]; then
  touch RELION_JOB_EXIT_SUCCESS
else
  touch RELION_JOB_EXIT_FAILURE
fi
exit $CMD_EXIT_CODE
`;

  return script;
};

/**
 * Submit a single-micrograph processing job
 * @param {Object} params - { micrograph_path, pixel_size, voltage, cs, output_dir, user_id, threads, gpus }
 * @returns {Promise<{job_id: string, status: string}>}
 */
const submitProcessingJob = async (params) => {
  const {
    micrograph_path,
    pixel_size,
    voltage,
    cs,
    amplitude_contrast = 0.1,
    output_dir,
    user_id,
    threads = 4,
    gpus = 0
  } = params;

  // Generate job ID
  const jobId = Job.generateId();
  const jobOutputDir = path.join(output_dir, `smartscope_${jobId}`);

  // Create output directory
  fs.mkdirSync(jobOutputDir, { recursive: true });
  fs.mkdirSync(path.join(jobOutputDir, 'MotionCorr'), { recursive: true });
  fs.mkdirSync(path.join(jobOutputDir, 'CtfFind'), { recursive: true });

  logger.info(`[SmartScope] Creating job ${jobId} | micrograph: ${path.basename(micrograph_path)}`);

  // Write input STAR file
  const inputStarPath = path.join(jobOutputDir, 'input.star');
  createInputStar(micrograph_path, { pixel_size, voltage, cs, amplitude_contrast }, inputStarPath);

  // Create Job record in DB
  const job = new Job({
    id: jobId,
    project_id: 'smartscope',
    user_id: user_id || 1,
    job_name: `SmartScope_${jobId.substring(0, 8)}`,
    job_type: 'SmartScopeProcess',
    status: JOB_STATUS.PENDING,
    execution_mode: 'slurm',
    output_file_path: jobOutputDir,
    parameters: {
      micrograph_path,
      pixel_size,
      voltage,
      cs,
      amplitude_contrast,
      output_dir
    },
    pipeline_stats: {
      pixel_size,
      micrograph_count: 1
    }
  });
  await job.save();

  // Generate and write SLURM script
  const scriptContent = generateSlurmScript({
    jobId,
    outputDir: jobOutputDir,
    partition: settings.SLURM_PARTITION,
    threads,
    gpus
  });

  const scriptPath = path.join(jobOutputDir, 'run.sh');
  const doWriteFile = isSSHMode() ? writeRemoteFile : (p, c) => fs.writeFileSync(p, c, { mode: 0o755 });
  await doWriteFile(scriptPath, scriptContent);

  if (!isSSHMode()) {
    fs.chmodSync(scriptPath, 0o755);
  }

  logger.info(`[SmartScope] SLURM script written: ${scriptPath}`);

  // Submit to SLURM
  try {
    const { stdout } = await execCommand('sbatch', [scriptPath]);
    const match = stdout.match(/Submitted batch job (\d+)/);
    const slurmJobId = match ? match[1] : null;

    if (!slurmJobId) {
      logger.error(`[SmartScope] Failed to parse SLURM job ID: ${stdout}`);
      await Job.findOneAndUpdate({ id: jobId }, {
        status: JOB_STATUS.FAILED,
        error_message: `Failed to parse SLURM job ID from: ${stdout.trim()}`
      });
      return { job_id: jobId, status: 'failed', error: 'SLURM submission failed' };
    }

    await Job.findOneAndUpdate({ id: jobId }, {
      status: JOB_STATUS.RUNNING,
      slurm_job_id: slurmJobId,
      start_time: new Date()
    });

    logger.info(`[SmartScope] Job submitted | job_id: ${jobId} | slurm_id: ${slurmJobId}`);
    return { job_id: jobId, status: 'queued' };

  } catch (err) {
    logger.error(`[SmartScope] SLURM submission failed: ${err.message}`);
    await Job.findOneAndUpdate({ id: jobId }, {
      status: JOB_STATUS.FAILED,
      error_message: err.message
    });
    return { job_id: jobId, status: 'failed', error: err.message };
  }
};

/**
 * Get processing results for a SmartScope job
 * @param {string} jobId - Job ID
 * @returns {Promise<Object>} Results in SmartScope format
 */
const getProcessingResults = async (jobId) => {
  const job = await Job.findOne({ id: jobId });
  if (!job) {
    return { error: 'Job not found' };
  }

  // Still running or pending
  if (job.status === JOB_STATUS.PENDING || job.status === JOB_STATUS.RUNNING) {
    return { job_id: jobId, status: job.status };
  }

  // Failed
  if (job.status === JOB_STATUS.FAILED) {
    return { job_id: jobId, status: 'failed', error: job.error_message || 'Processing failed' };
  }

  // Cancelled
  if (job.status === JOB_STATUS.CANCELLED) {
    return { job_id: jobId, status: 'cancelled' };
  }

  // Success — parse CTF results
  const outputDir = job.output_file_path;
  const ctfStarPath = path.join(outputDir, 'CtfFind', 'micrographs_ctf.star');

  if (!fs.existsSync(ctfStarPath)) {
    return { job_id: jobId, status: 'completed', error: 'CTF output STAR file not found' };
  }

  try {
    const starData = await parseStarFile(ctfStarPath);

    // Get the first (and only) micrograph row from the micrographs block
    const micrographs = starData.micrographs || starData.movies || {};
    const rows = micrographs.rows || starData.files || [];

    if (rows.length === 0) {
      return { job_id: jobId, status: 'completed', error: 'No micrograph data in CTF STAR file' };
    }

    const row = rows[0];

    // Extract CTF values (RELION stores defocus in Angstroms)
    const defocusU = parseFloat(row.rlnDefocusU || 0);
    const defocusV = parseFloat(row.rlnDefocusV || 0);
    const defocusAngle = parseFloat(row.rlnDefocusAngle || 0);
    const ctfFit = parseFloat(row.rlnCtfFigureOfMerit || 0);
    const imageX = parseInt(row.rlnImageSizeX || 0, 10);
    const imageY = parseInt(row.rlnImageSizeY || 0, 10);

    // Convert to SmartScope units (micrometers)
    const defocus = (defocusU + defocusV) / 2 / 10000;
    const astig = Math.abs(defocusU - defocusV) / 10000;

    // Generate PNGs from MRC files
    const pngResults = await generatePngs(outputDir);

    const results = {
      defocus: Math.round(defocus * 1000) / 1000,
      astig: Math.round(astig * 1000) / 1000,
      angast: Math.round(defocusAngle * 10) / 10,
      ctffit: Math.round(ctfFit * 1000) / 1000,
      shape_x: imageX,
      shape_y: imageY,
      pixel_size: job.parameters.pixel_size,
      micrograph_png: pngResults.micrograph_png || '',
      ctf_png: pngResults.ctf_png || ''
    };

    return { job_id: jobId, status: 'completed', results };

  } catch (err) {
    logger.error(`[SmartScope] Error parsing results for ${jobId}: ${err.message}`);
    return { job_id: jobId, status: 'completed', error: `Result parsing failed: ${err.message}` };
  }
};

/**
 * Generate PNG images from MRC output files
 * @param {string} outputDir - Job output directory
 * @returns {Promise<{micrograph_png: string, ctf_png: string}>}
 */
const generatePngs = async (outputDir) => {
  const result = { micrograph_png: '', ctf_png: '' };

  try {
    const { frameToPng } = require('../utils/mrcParser');

    // Find motion-corrected micrograph MRC
    const mrcPatterns = [
      path.join(outputDir, 'MotionCorr', 'Movies', '*.mrc'),
      path.join(outputDir, 'MotionCorr', 'Micrographs', '*.mrc'),
      path.join(outputDir, 'MotionCorr', '*.mrc')
    ];

    for (const pattern of mrcPatterns) {
      const matches = glob.sync(pattern);
      if (matches.length > 0) {
        const mrcPath = matches[0];
        const baseName = path.basename(mrcPath, '.mrc');
        const pngPath = path.join(outputDir, `${baseName}.png`);

        if (!fs.existsSync(pngPath)) {
          const pngBuffer = await frameToPng(mrcPath, 0, 0);
          if (pngBuffer) {
            fs.writeFileSync(pngPath, pngBuffer);
          }
        }
        result.micrograph_png = pngPath;
        break;
      }
    }

    // Find CTF power spectrum
    const ctfPatterns = [
      path.join(outputDir, 'CtfFind', 'Movies', '*.ctf'),
      path.join(outputDir, 'CtfFind', 'Micrographs', '*.ctf'),
      path.join(outputDir, 'CtfFind', '**', '*.ctf')
    ];

    for (const pattern of ctfPatterns) {
      const matches = glob.sync(pattern);
      if (matches.length > 0) {
        const ctfPath = matches[0];
        const baseName = path.basename(ctfPath, '.ctf');
        const pngPath = path.join(outputDir, `${baseName}_ctf.png`);

        if (!fs.existsSync(pngPath)) {
          const pngBuffer = await frameToPng(ctfPath, 0, 0);
          if (pngBuffer) {
            fs.writeFileSync(pngPath, pngBuffer);
          }
        }
        result.ctf_png = pngPath;
        break;
      }
    }

  } catch (err) {
    logger.warn(`[SmartScope] PNG generation error: ${err.message}`);
  }

  return result;
};

/**
 * Convert an MRC/CTF file to PNG (cached on disk).
 * Returns the PNG path, or empty string if conversion fails.
 * @param {string} mrcPath - Path to the .mrc or .ctf file
 * @param {string} [suffix=''] - Suffix to append before .png (e.g. '_ctf')
 * @returns {Promise<string>} PNG file path
 */
const mrcToPng = async (mrcPath, suffix = '') => {
  if (!mrcPath || !fs.existsSync(mrcPath)) return '';

  try {
    const ext = path.extname(mrcPath);
    const baseName = path.basename(mrcPath, ext);
    const pngPath = path.join(path.dirname(mrcPath), `${baseName}${suffix}.png`);

    // Return cached PNG if it exists
    if (fs.existsSync(pngPath)) return pngPath;

    const { frameToPng } = require('../utils/mrcParser');
    const pngBuffer = await frameToPng(mrcPath, 0, 0);
    if (pngBuffer) {
      fs.writeFileSync(pngPath, pngBuffer);
      return pngPath;
    }
  } catch (err) {
    logger.warn(`[SmartScope] PNG conversion failed for ${mrcPath}: ${err.message}`);
  }

  return '';
};

module.exports = {
  createInputStar,
  generateSlurmScript,
  submitProcessingJob,
  getProcessingResults,
  generatePngs,
  mrcToPng
};
