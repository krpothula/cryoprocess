import axiosInstance from "../../config";

const localResolutionAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/local_resolution/`, payload);
};

export { localResolutionAPI };
