import axiosInstance from "../../config";

const manualPickingAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/manual_pick/`, payload);
};

export { manualPickingAPI };
