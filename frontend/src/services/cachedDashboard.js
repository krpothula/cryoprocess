/**
 * Cached Dashboard API Service
 *
 * These APIs serve pre-generated thumbnails and stats from the compute nodes.
 * The post-processor generates these incrementally as each micrograph is processed,
 * making dashboard viewing much faster and more scalable.
 *
 * Endpoints:
 * - GET /api/dashboard/thumbnail/<job_id>/<filename> - Pre-generated PNG thumbnail
 * - GET /api/dashboard/thumbnails/<job_id>/ - List available thumbnails
 * - GET /api/dashboard/stats/<job_id>/ - Pre-computed statistics JSON
 * - GET /api/dashboard/postprocess-status/<job_id>/ - Check if post-processing complete
 */

import axiosInstance from "./config";

/**
 * Get a pre-generated thumbnail image.
 * @param {string} jobId - Job ID
 * @param {string} filename - Thumbnail filename (e.g., "micrograph_001.png")
 * @returns {Promise} - Response with image data
 */
export const getCachedThumbnailApi = (jobId, filename) => {
  return axiosInstance.get(`/api/dashboard/thumbnail/${jobId}/${filename}`, {
    responseType: 'blob'
  });
};

/**
 * Get the URL for a cached thumbnail (for direct img src usage).
 * @param {string} jobId - Job ID
 * @param {string} filename - Thumbnail filename
 * @returns {string} - URL to thumbnail
 */
export const getCachedThumbnailUrl = (jobId, filename) => {
  return `/api/dashboard/thumbnail/${jobId}/${filename}`;
};

/**
 * List all available cached thumbnails for a job.
 * @param {string} jobId - Job ID
 * @returns {Promise} - Response with { thumbnails: string[], count: number }
 */
export const listCachedThumbnailsApi = (jobId) => {
  return axiosInstance.get(`/api/dashboard/thumbnails/${jobId}`);
};

/**
 * Get pre-computed statistics for a job.
 * Returns stats that were generated incrementally on the compute node.
 * @param {string} jobId - Job ID
 * @returns {Promise} - Response with stats JSON
 */
export const getCachedStatsApi = (jobId) => {
  return axiosInstance.get(`/api/dashboard/stats/${jobId}`);
};

/**
 * Check post-processing status for a job.
 * @param {string} jobId - Job ID
 * @returns {Promise} - Response with { complete: boolean, thumbnail_count: number, stats_available: boolean }
 */
export const getPostProcessStatusApi = (jobId) => {
  return axiosInstance.get(`/api/dashboard/postprocess-status/${jobId}`);
};

/**
 * Helper to check if cached data is available for a job.
 * Falls back gracefully if post-processing hasn't run yet.
 * @param {string} jobId - Job ID
 * @returns {Promise<{hasCached: boolean, thumbnailCount: number, statsAvailable: boolean}>}
 */
export const checkCachedDataAvailable = async (jobId) => {
  try {
    const response = await getPostProcessStatusApi(jobId);
    return {
      hasCached: response.data.thumbnailCount > 0 || response.data.statsAvailable,
      thumbnailCount: response.data.thumbnailCount || 0,
      statsAvailable: response.data.statsAvailable || false,
      complete: response.data.complete || false,
    };
  } catch (error) {
    // Post-processing not available for this job
    return {
      hasCached: false,
      thumbnailCount: 0,
      statsAvailable: false,
      complete: false,
    };
  }
};

const cachedDashboardApi = {
  getCachedThumbnailApi,
  getCachedThumbnailUrl,
  listCachedThumbnailsApi,
  getCachedStatsApi,
  getPostProcessStatusApi,
  checkCachedDataAvailable,
};

export default cachedDashboardApi;
