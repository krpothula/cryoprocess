import axiosInstance from "../../config";

const ctfRefinementAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/ctf_refine/`, payload);
};

export { ctfRefinementAPI };
