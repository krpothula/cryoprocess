import axiosInstance from "../../config";
import {
  getCachedStatsApi,
  checkCachedDataAvailable,
} from "../../cachedDashboard";

// Use unified jobs API for CTF estimation
const ctfEstimationAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/ctf_estimation/`, payload);
};

const ctfRefinementAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/ctf_refine/`, payload);
};

// CTF results visualization APIs
// Request all micrographs - no limit for accurate statistics
const getCTFResultsApi = (jobId = "", page = 1, pageSize = 100000) => {
  return axiosInstance.get(`/ctf/results/?job_id=${jobId}&page=${page}&page_size=${pageSize}`);
};

const getCTFLiveStatsApi = (jobId = "") => {
  return axiosInstance.get(`/ctf/live-stats/?job_id=${jobId}`);
};

const getCTFImageApi = (jobId = "", micrograph = "") => {
  return axiosInstance.get(
    `/ctf/image/?job_id=${jobId}&micrograph=${micrograph}`
  );
};

// Get the micrograph image (from the motion correction job or input)
const getMicrographImageApi = (jobId = "", micrograph = "") => {
  return axiosInstance.get(
    `/ctf/micrograph-image/?job_id=${jobId}&micrograph=${micrograph}`
  );
};

// Export selected micrographs to a new STAR file
const exportCTFSelectionApi = (jobId = "", micrographNames = [], filename = "selected_micrographs_ctf.star") => {
  return axiosInstance.post(`/ctf/export-selection/`, {
    job_id: jobId,
    micrograph_names: micrographNames,
    filename: filename,
  });
};

/**
 * Get CTF power spectrum image.
 * Always uses authenticated API endpoint which returns base64 images.
 * This avoids auth issues with direct img src URLs.
 * @param {string} jobId - Job ID
 * @param {string} micrograph - Micrograph name
 * @returns {Promise} - Response with image data (base64)
 */
const getCTFImageWithCacheApi = async (jobId = "", micrograph = "") => {
  // Always use the authenticated API endpoint which returns base64 images
  return getCTFImageApi(jobId, micrograph);
};

/**
 * Get CTF live stats with cached fallback.
 * Tries cached stats first, falls back to on-demand parsing.
 * @param {string} jobId - Job ID
 * @returns {Promise} - Response with stats
 */
const getCTFLiveStatsWithCacheApi = async (jobId = "") => {
  try {
    // Try cached stats first
    const cachedStatus = await checkCachedDataAvailable(jobId);

    if (cachedStatus.statsAvailable) {
      const cachedStats = await getCachedStatsApi(jobId);
      // Transform cached stats to match expected format
      if (cachedStats.data && cachedStats.data.ctf_stats) {
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
    console.debug("Cached CTF stats not available, using on-demand:", error.message);
  }

  // Fall back to on-demand parsing
  return getCTFLiveStatsApi(jobId);
};

export {
  ctfEstimationAPI,
  ctfRefinementAPI,
  getCTFResultsApi,
  getCTFLiveStatsApi,
  getCTFImageApi,
  getMicrographImageApi,
  exportCTFSelectionApi,
  // Cached versions with fallback
  getCTFImageWithCacheApi,
  getCTFLiveStatsWithCacheApi,
};
