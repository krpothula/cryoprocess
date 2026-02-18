import axiosInstance from "../../config";

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

export {
  ctfEstimationAPI,
  ctfRefinementAPI,
  getCTFResultsApi,
  getCTFImageApi,
  getMicrographImageApi,
  exportCTFSelectionApi,
  getCTFImageWithCacheApi,
};
