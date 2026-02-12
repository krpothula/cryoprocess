/**
 * SLURM API Service
 *
 * Handles communication with SLURM query endpoints for:
 * - Available partitions
 * - Available nodes with states
 * - Cluster status
 * - Job queue
 */
import axiosInstance from "./config";

const SLURM_BASE_URL = "/api/slurm";

/**
 * Get list of available SLURM partitions
 * @returns {Promise<{success: boolean, partitions: Array}>}
 */
export const getSlurmPartitions = async () => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/partitions/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM partitions:", error);
    return { success: false, partitions: [], error: error.message };
  }
};

/**
 * Get list of available SLURM nodes
 * @param {string} partition - Optional partition filter
 * @returns {Promise<{success: boolean, nodes: Array}>}
 */
export const getSlurmNodes = async (partition = null) => {
  try {
    const params = partition ? { partition } : {};
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/nodes/`, { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM nodes:", error);
    return { success: false, nodes: [], error: error.message };
  }
};

/**
 * Get SLURM cluster status summary
 * @returns {Promise<{success: boolean, status: Object}>}
 */
export const getSlurmStatus = async () => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/status/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM status:", error);
    return {
      success: false,
      data: {
        available: false,
        total_nodes: 0,
        idle_nodes: 0,
        busy_nodes: 0,
        down_nodes: 0,
        running_jobs: 0,
        pending_jobs: 0,
        partitions: []
      },
      error: error.message
    };
  }
};

/**
 * Get SLURM job queue
 * @param {boolean} showAll - Show all users' jobs
 * @param {string} user - Filter by specific user
 * @returns {Promise<{success: boolean, jobs: Array}>}
 */
export const getSlurmQueue = async (showAll = false, user = null) => {
  try {
    const params = {};
    if (showAll) params.all = 'true';
    if (user) params.user = user;
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/queue/`, { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM queue:", error);
    return { success: false, jobs: [], error: error.message };
  }
};

/**
 * Get SLURM connection info (local or SSH mode)
 * @returns {Promise<{success: boolean, connection: Object}>}
 */
export const getSlurmConnectionInfo = async () => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/connection/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM connection info:", error);
    return {
      success: false,
      connection: { mode: "unknown" },
      error: error.message
    };
  }
};

/**
 * Get host machine resource limits (CPUs, GPUs)
 * Used to cap frontend inputs when running locally
 * @returns {Promise<{success: boolean, data: Object}>}
 */
export const getResourceLimits = async () => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/resource-limits/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch resource limits:", error);
    return { success: false, data: null };
  }
};

// =============================================================================
// JOB MANAGEMENT APIs
// =============================================================================

/**
 * Cancel a SLURM job by SLURM job ID
 * @param {string} slurmJobId - SLURM job ID
 * @param {string} jobId - Optional CryoScale job ID to update status
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const cancelSlurmJob = async (slurmJobId, jobId = null) => {
  try {
    const response = await axiosInstance.post(`${SLURM_BASE_URL}/cancel/`, {
      slurm_job_id: slurmJobId,
      job_id: jobId
    });
    return response.data;
  } catch (error) {
    console.error("Failed to cancel SLURM job:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Cancel a job by CryoScale job ID
 * @param {string} jobId - CryoScale job ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const cancelJobById = async (jobId) => {
  try {
    const response = await axiosInstance.post(`${SLURM_BASE_URL}/jobs/${jobId}/cancel`);
    return response.data;
  } catch (error) {
    console.error("Failed to cancel job:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Get job logs (stdout/stderr)
 * @param {string} jobId - CryoScale job ID
 * @param {Object} options - Options: type ('stdout'|'stderr'|'both'), tail (number), full (boolean)
 * @returns {Promise<{success: boolean, logs: Object}>}
 */
export const getJobLogs = async (jobId, options = {}) => {
  try {
    const params = {};
    if (options.type) params.type = options.type;
    if (options.tail) params.tail = options.tail;
    if (options.full) params.full = 'true';

    const response = await axiosInstance.get(`${SLURM_BASE_URL}/jobs/${jobId}/logs/`, { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch job logs:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      logs: { stdout: "", stderr: "" }
    };
  }
};

/**
 * Stream job logs (for live updates)
 * @param {string} jobId - CryoScale job ID
 * @param {number} offset - Byte offset to start from
 * @returns {Promise<{success: boolean, content: string, offset: number, complete: boolean}>}
 */
export const streamJobLogs = async (jobId, offset = 0) => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/jobs/${jobId}/logs/stream/`, {
      params: { offset }
    });
    return response.data;
  } catch (error) {
    console.error("Failed to stream job logs:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      content: "",
      offset: offset,
      complete: false
    };
  }
};

/**
 * Validate SLURM resource request
 * @param {Object} resources - Resource request: partition, gpus, cpus, memory, nodes
 * @returns {Promise<{success: boolean, valid: boolean, errors: Array, warnings: Array}>}
 */
export const validateSlurmResources = async (resources) => {
  try {
    const response = await axiosInstance.post(`${SLURM_BASE_URL}/validate/`, resources);
    return response.data;
  } catch (error) {
    console.error("Failed to validate SLURM resources:", error);
    return {
      success: false,
      valid: false,
      errors: [error.response?.data?.error || error.message],
      warnings: []
    };
  }
};

/**
 * Get detailed SLURM job information
 * @param {string} slurmJobId - SLURM job ID
 * @returns {Promise<{success: boolean, job: Object}>}
 */
export const getSlurmJobDetails = async (slurmJobId) => {
  try {
    const response = await axiosInstance.get(`${SLURM_BASE_URL}/jobs/${slurmJobId}/details/`);
    return response.data;
  } catch (error) {
    console.error("Failed to fetch SLURM job details:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      job: null
    };
  }
};

/**
 * Get parsed issues/errors for a job from logs
 * Parses RELION errors, SLURM errors, and post-processing issues
 * @param {string} jobId - CryoScale job ID
 * @param {Object} options - Options: includeWarnings (boolean), includePostprocess (boolean)
 * @returns {Promise<{success: boolean, issues: Array, summary: Object}>}
 */
export const getJobIssues = async (jobId, options = {}) => {
  try {
    const params = {};
    if (options.includeWarnings !== undefined) {
      params.include_warnings = options.includeWarnings ? 'true' : 'false';
    }
    if (options.includePostprocess !== undefined) {
      params.include_postprocess = options.includePostprocess ? 'true' : 'false';
    }

    const response = await axiosInstance.get(`${SLURM_BASE_URL}/jobs/${jobId}/issues/`, { params });
    return response.data;
  } catch (error) {
    console.error("Failed to fetch job issues:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message,
      issues: [],
      summary: { total: 0, errors: 0, warnings: 0 }
    };
  }
};

/**
 * Delete a job by CryoScale job ID
 * @param {string} jobId - CryoScale job ID
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const deleteJob = async (jobId) => {
  try {
    const response = await axiosInstance.delete(`${SLURM_BASE_URL}/jobs/${jobId}`);
    return response.data;
  } catch (error) {
    console.error("Failed to delete job:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Update job status (mark as completed, error, etc.)
 * @param {string} jobId - CryoScale job ID
 * @param {string} status - New status ('completed', 'error', 'pending', 'running')
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const updateJobStatus = async (jobId, status) => {
  try {
    const response = await axiosInstance.patch(`${SLURM_BASE_URL}/jobs/${jobId}/status`, {
      status: status
    });
    return response.data;
  } catch (error) {
    console.error("Failed to update job status:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

/**
 * Toggle email notification for a job
 * @param {string} jobId - CryoScale job ID
 * @returns {Promise<{success: boolean, notify_email: boolean}>}
 */
export const toggleJobNotifyEmail = async (jobId) => {
  try {
    const response = await axiosInstance.patch(`${SLURM_BASE_URL}/jobs/${jobId}/notify`);
    return response.data;
  } catch (error) {
    console.error("Failed to toggle job notification:", error);
    return {
      success: false,
      error: error.response?.data?.error || error.message
    };
  }
};

const slurmApi = {
  getSlurmPartitions,
  getSlurmNodes,
  getSlurmStatus,
  getSlurmQueue,
  getSlurmConnectionInfo,
  getResourceLimits,
  cancelSlurmJob,
  cancelJobById,
  getJobLogs,
  streamJobLogs,
  validateSlurmResources,
  getSlurmJobDetails,
  getJobIssues,
  deleteJob,
  updateJobStatus,
  toggleJobNotifyEmail,
};

export default slurmApi;
