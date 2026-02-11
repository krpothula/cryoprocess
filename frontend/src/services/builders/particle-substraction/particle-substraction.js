import axiosInstance from "../../config";

const particleSubstractionAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/subtract/`, payload);
};

export { particleSubstractionAPI };
