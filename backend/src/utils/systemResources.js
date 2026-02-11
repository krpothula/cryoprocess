/**
 * System Resource Detection
 *
 * Detects available CPUs and GPUs on the host machine.
 * Used to enforce resource limits for local job execution.
 * Results are cached — hardware doesn't change at runtime.
 */

const os = require('os');
const { execSync } = require('child_process');
const logger = require('./logger');

const RESERVED_CPUS = 6; // Reserve for Node.js, MongoDB, OS, desktop

let cached = null;

/**
 * Get system resource info (cached after first call)
 * @returns {{ totalCpus: number, availableCpus: number, reservedCpus: number, gpuCount: number }}
 */
function getSystemResources() {
  if (cached) return cached;

  const totalCpus = os.cpus().length;
  const availableCpus = Math.max(1, totalCpus - RESERVED_CPUS);

  let gpuCount = 0;
  try {
    const out = execSync('nvidia-smi --query-gpu=name --format=csv,noheader', {
      timeout: 5000,
      stdio: ['ignore', 'pipe', 'ignore']
    }).toString().trim();
    gpuCount = out.split('\n').filter(Boolean).length;
  } catch {
    // No GPU or nvidia-smi not available
  }

  cached = {
    totalCpus,
    availableCpus,
    reservedCpus: RESERVED_CPUS,
    gpuCount
  };

  logger.info(`[SystemResources] Detected: ${totalCpus} CPUs (${availableCpus} available), ${gpuCount} GPU(s)`);

  return cached;
}

module.exports = { getSystemResources };
