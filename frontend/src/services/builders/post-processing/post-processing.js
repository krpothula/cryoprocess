import axiosInstance from "../../config";

const postProcessingAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/postprocess/`, payload);
};

export { postProcessingAPI };
