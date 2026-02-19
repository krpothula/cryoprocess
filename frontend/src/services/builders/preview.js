/**
 * Command Preview API Service
 * Used by the CommandPreview component to fetch command previews from backend
 */
import axiosInstance from "../config";

/**
 * Preview the command that would be built for a job
 * @param {Object} payload - Form data including jobType and projectId
 * @returns {Promise} API response with command string
 */
const previewCommandAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/preview/`, payload);
};

export { previewCommandAPI };
