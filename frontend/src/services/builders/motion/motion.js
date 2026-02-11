import axiosInstance from "../../config";
import {
  getCachedStatsApi,
  checkCachedDataAvailable,
} from "../../cachedDashboard";

const getPrevFilesApi = (projectId = "", jobId = "", type = 1) => {
  return axiosInstance.get(
    `/api/files/?project_id=${projectId}&job_id=${jobId}&type=${type}`
  );
};

const getMCFilesApi = (projectId = "", jobId = "") => {
  return axiosInstance.get(
    `/api/download?project_id=${projectId}&job_id=${jobId}`
  );
};

// Use unified jobs API for motion correction
const motionCorrectionAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/motion_correction/`, payload);
};

const getMotionLogsApi = (projectId = "", jobId = "") => {
  return axiosInstance.get(
    `/motion/logs?project_id=${projectId}&job_id=${jobId}`
  );
};

// Motion correction results visualization APIs
// Supports pagination: offset (default 0), limit (default 100, max 500)
const getMotionResultsApi = (jobId = "", offset = 0, limit = 100) => {
  return axiosInstance.get(`/motion/results/?job_id=${jobId}&offset=${offset}&limit=${limit}`);
};

const getMicrographShiftsApi = (jobId = "", micrograph = "") => {
  return axiosInstance.get(
    `/motion/shifts/?job_id=${jobId}&micrograph=${micrograph}`
  );
};

const getMotionLiveStatsApi = (jobId = "") => {
  return axiosInstance.get(`/motion/live-stats/?job_id=${jobId}`);
};

// Get micrograph image as PNG (base64)
// type: 'micrograph' or 'power_spectrum'
const getMicrographImageApi = (jobId = "", micrograph = "", type = "micrograph") => {
  return axiosInstance.get(
    `/motion/image/?job_id=${jobId}&micrograph=${micrograph}&type=${type}`
  );
};

/**
 * Get micrograph image.
 * Always uses authenticated API endpoint which returns base64 images.
 * This avoids auth issues with direct img src URLs (browser doesn't send Authorization header).
 * @param {string} jobId - Job ID
 * @param {string} micrograph - Micrograph name
 * @param {string} type - Image type ('micrograph' or 'power_spectrum')
 * @returns {Promise} - Response with image data (base64)
 */
const getMicrographImageWithCacheApi = async (jobId = "", micrograph = "", type = "micrograph") => {
  // Always use the authenticated API endpoint which returns base64 images
  return getMicrographImageApi(jobId, micrograph, type);
};

/**
 * Get live stats with cached fallback.
 * Tries cached stats first, falls back to on-demand parsing.
 * @param {string} jobId - Job ID
 * @returns {Promise} - Response with stats
 */
const getMotionLiveStatsWithCacheApi = async (jobId = "") => {
  try {
    // Try cached stats first
    const cachedStatus = await checkCachedDataAvailable(jobId);

    if (cachedStatus.statsAvailable) {
      const cachedStats = await getCachedStatsApi(jobId);
      // Transform cached stats to match expected format
      if (cachedStats.data && cachedStats.data.motion_stats) {
        return {
          data: {
            cached: true,
            ...cachedStats.data,
          }
        };
      }
    }
  } catch (error) {
    // Cached stats not available, continue to fallback
    console.debug("Cached stats not available, using on-demand:", error.message);
  }

  // Fall back to on-demand parsing
  return getMotionLiveStatsApi(jobId);
};

export {
  getPrevFilesApi,
  motionCorrectionAPI,
  getMCFilesApi,
  getMotionLogsApi,
  getMotionResultsApi,
  getMicrographShiftsApi,
  getMotionLiveStatsApi,
  getMicrographImageApi,
  // Cached versions with fallback
  getMicrographImageWithCacheApi,
  getMotionLiveStatsWithCacheApi,
};
