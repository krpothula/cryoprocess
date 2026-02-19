import axiosInstance from "../../config";

// Use unified jobs API for 2D classification
const twoDClassificationAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/class_2d/`, payload);
};

// Dashboard visualization APIs - use new unified endpoints
const getClass2DResultsApi = (jobId = "") => {
  return axiosInstance.get(`/class2d/results/?jobId=${jobId}`);
};

const getClass2DClassesImageApi = (jobId = "", iteration = "latest") => {
  return axiosInstance.get(`/class2d/classes-image/?jobId=${jobId}&iteration=${iteration}`);
};

// Live stats for running jobs (iteration progress)
const getClass2DLiveStatsApi = (jobId = "") => {
  return axiosInstance.get(`/class2d/live-stats/?jobId=${jobId}`);
};

// Individual class images with metadata (for gallery view)
const getClass2DIndividualImagesApi = (jobId = "", iteration = "latest") => {
  return axiosInstance.get(`/class2d/individual-images/?jobId=${jobId}&iteration=${iteration}`);
};

export {
  twoDClassificationAPI,
  getClass2DResultsApi,
  getClass2DClassesImageApi,
  getClass2DLiveStatsApi,
  getClass2DIndividualImagesApi,
};
