import axiosInstance from "../../config";

const threeDMultiBodyAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/multibody/`, payload);
};

export { threeDMultiBodyAPI };
