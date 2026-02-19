import axiosInstance from "../../config";

// Use unified jobs API for auto picking
const autoPickerAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/auto_picking/`, payload);
};

// Dashboard visualization APIs
const getAutoPickResultsApi = (jobId = "") => {
  return axiosInstance.get(`/autopick/results/?jobId=${jobId}`);
};

const getAutoPickImageApi = (jobId = "", micrograph = "", showPicks = true, radius = 50) => {
  return axiosInstance.get(
    `/autopick/image/?jobId=${jobId}&micrograph=${micrograph}&showPicks=${showPicks}&radius=${radius}`
  );
};

export {
  autoPickerAPI,
  getAutoPickResultsApi,
  getAutoPickImageApi,
};
