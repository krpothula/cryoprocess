/**
 * Application Settings
 *
 * Centralized configuration loaded from environment variables.
 */

// Load .env from project root (single config file for all settings)
require('dotenv').config({ path: require('path').join(__dirname, '..', '..', '..', '.env') });

module.exports = {
  // Server
  PORT: parseInt(process.env.PORT, 10) || 8000,
  NODE_ENV: process.env.NODE_ENV || 'development',

  // Database
  MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/cryoprocess-db',

  // JWT Authentication
  JWT_SECRET: (() => {
    if (!process.env.JWT_SECRET) {
      console.error('FATAL: JWT_SECRET environment variable is not set. Server cannot start without it.');
      console.error('Set JWT_SECRET in your .env file. Generate one with: node -e "console.log(require(\'crypto\').randomBytes(64).toString(\'hex\'))"');
      process.exit(1);
    }
    return process.env.JWT_SECRET;
  })(),
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '7d',

  // Project paths
  ROOT_PATH: process.env.ROOT_PATH || '/data/projects',

  // SLURM settings
  SLURM_PARTITION: process.env.SLURM_PARTITION || 'default',
  SLURM_SUBMIT_COMMAND: process.env.SLURM_SUBMIT_COMMAND || 'sbatch',
  SLURM_NODES: parseInt(process.env.SLURM_NODES, 10) || 1,
  SLURM_CPUS_PER_TASK: parseInt(process.env.SLURM_CPUS_PER_TASK, 10) || 8,
  SLURM_GPUS_PER_NODE: parseInt(process.env.SLURM_GPUS_PER_NODE, 10) || 1,
  SLURM_TIME: process.env.SLURM_TIME || '24:00:00',

  // SSH Remote Cluster (run SLURM commands over SSH)
  SLURM_USE_SSH: process.env.SLURM_USE_SSH === 'true',
  SLURM_SSH_HOST: process.env.SLURM_SSH_HOST || '',
  SLURM_SSH_USER: process.env.SLURM_SSH_USER || process.env.USER || '',
  SLURM_SSH_PORT: parseInt(process.env.SLURM_SSH_PORT, 10) || 22,
  SLURM_SSH_KEY_PATH: process.env.SLURM_SSH_KEY_PATH || '',

  // MPI Launcher settings
  // 'mpirun' - Standard MPI launcher, portable across clusters
  // 'srun' - SLURM-native launcher (can cause issues with some setups)
  MPI_LAUNCHER: process.env.MPI_LAUNCHER || 'mpirun',

  // Singularity container settings
  // Support both RELION_PATH (preferred) and SINGULARITY_IMAGE (legacy)
  SINGULARITY_IMAGE: process.env.RELION_PATH || process.env.SINGULARITY_IMAGE || '',
  SINGULARITY_BIND_PATHS: process.env.SINGULARITY_BIND_PATHS || '',
  SINGULARITY_OPTIONS: process.env.SINGULARITY_OPTIONS || '--nv',

  // Security limits
  MAX_FILE_SIZE_MB: 500,
  MAX_FRAMES: 100,
  MAX_THUMBNAIL_SIZE: 1024,
  ALLOWED_EXTENSIONS: ['.mrc', '.mrcs', '.tiff', '.tif', '.eer'],

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // External Software Executables
  CTFFIND_EXE: process.env.CTFFIND_EXE || 'ctffind',
  GCTF_EXE: process.env.GCTF_EXE || 'gctf',
  MOTIONCOR2_EXE: process.env.MOTIONCOR2_EXE || '',
  MODELANGELO_EXE: process.env.MODELANGELO_EXE || 'relion_python_modelangelo',
};
