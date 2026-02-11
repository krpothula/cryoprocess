import axiosInstance from "../../config";

const subsetSelectionAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/subset/`, payload);
};

export { subsetSelectionAPI };
