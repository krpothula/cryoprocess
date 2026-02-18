import axiosInstance from "../../config";

const threeDAutoRefineAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/auto_refine/`, payload);
};

// Dashboard visualization APIs
const getAutoRefineResultsApi = (jobId = "") => {
  return axiosInstance.get(`/autorefine/results/?job_id=${jobId}`);
};

const getAutoRefineFscApi = (jobId = "") => {
  return axiosInstance.get(`/autorefine/fsc/?job_id=${jobId}`);
};

export {
  threeDAutoRefineAPI,
  getAutoRefineResultsApi,
  getAutoRefineFscApi,
};
