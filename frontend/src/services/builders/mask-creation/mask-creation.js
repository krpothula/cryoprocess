import axiosInstance from "../../config";

const maskCreationAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/mask_create/`, payload);
};

export { maskCreationAPI };
