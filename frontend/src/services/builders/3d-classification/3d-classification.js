import axiosInstance from "../../config";

const threeDClassificationAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/class_3d/`, payload);
};

// Dashboard visualization APIs
const getClass3DResultsApi = (jobId = "") => {
  return axiosInstance.get(`/class3d/results/?job_id=${jobId}`);
};

// Live stats for running jobs (iteration progress)
const getClass3DLiveStatsApi = (jobId = "") => {
  return axiosInstance.get(`/class3d/live-stats/?job_id=${jobId}`);
};

export {
  threeDClassificationAPI,
  getClass3DResultsApi,
  getClass3DLiveStatsApi,
};
