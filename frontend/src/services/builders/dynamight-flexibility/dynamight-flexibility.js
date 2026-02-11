import axiosInstance from "../../config";

const dynamightFlexibilityAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/dynamight/`, payload);
};

export { dynamightFlexibilityAPI };
