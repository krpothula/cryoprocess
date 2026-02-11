import axiosInstance from "../../config";

const threeDClassificationAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/class_3d/`, payload);
};

export { threeDClassificationAPI };
