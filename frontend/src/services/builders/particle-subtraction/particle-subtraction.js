import axiosInstance from "../../config";

const particleSubtractionAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/subtract/`, payload);
};

export { particleSubtractionAPI };
