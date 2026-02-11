import axiosInstance from "../../config";

// Use unified jobs API for auto picking
const autoPickerAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/auto_picking/`, payload);
};

// Dashboard visualization APIs
const getAutoPickResultsApi = (jobId = "") => {
  return axiosInstance.get(`/autopick/results/?job_id=${jobId}`);
};

const getAutoPickImageApi = (jobId = "", micrograph = "", showPicks = true, radius = 50) => {
  return axiosInstance.get(
    `/autopick/image/?job_id=${jobId}&micrograph=${micrograph}&show_picks=${showPicks}&radius=${radius}`
  );
};

const getAutoPickLiveStatsApi = (jobId = "") => {
  return axiosInstance.get(`/autopick/live-stats/?job_id=${jobId}`);
};

export {
  autoPickerAPI,
  getAutoPickResultsApi,
  getAutoPickImageApi,
  getAutoPickLiveStatsApi,
};
