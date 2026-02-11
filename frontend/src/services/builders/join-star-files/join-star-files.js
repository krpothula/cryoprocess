import axiosInstance from "../../config";

const joinStarFilesAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/join_star/`, payload);
};

export { joinStarFilesAPI };
