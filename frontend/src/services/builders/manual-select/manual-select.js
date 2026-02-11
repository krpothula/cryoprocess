import axiosInstance from "../../config";

/**
 * Get manual class selection job results for dashboard display.
 * @param {string} jobId - The job ID
 */
const getManualSelectResultsApi = (jobId) => {
  return axiosInstance.get(`/manualselect/results/?job_id=${jobId}`);
};

export { getManualSelectResultsApi };
