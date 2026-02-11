import axiosInstance from "../../config";

const threeDAutoRefineAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/auto_refine/`, payload);
};

export { threeDAutoRefineAPI };
