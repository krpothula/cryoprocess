import axiosInstance from "../../config";

// Submit job via unified endpoint
const threeDInitialModelAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/initial_model/`, payload);
};

// Dashboard APIs
const getInitialModelResultsApi = (jobId) => {
  return axiosInstance.get(`/initialmodel/results/`, {
    params: { jobId },
  });
};

const getInitialModelSlicesApi = (jobId, iteration = "latest", axis = "z") => {
  return axiosInstance.get(`/initialmodel/slices/`, {
    params: { jobId, iteration, axis },
  });
};

const getInitialModelMRCApi = (jobId, iteration = "latest", classNum = 1) => {
  return axiosInstance.get(`/initialmodel/mrc/`, {
    params: { jobId, iteration, class: classNum },
    responseType: "blob",
  });
};

const getInitialModelLiveStatsApi = (jobId) => {
  return axiosInstance.get(`/initialmodel/live-stats/`, {
    params: { jobId },
  });
};

export {
  threeDInitialModelAPI,
  getInitialModelResultsApi,
  getInitialModelSlicesApi,
  getInitialModelMRCApi,
  getInitialModelLiveStatsApi,
};
