import axiosInstance from "../../config";

// Use unified jobs API for particle extraction
const particleExtractionAPI = (payload = {}) => {
  return axiosInstance.post(`/api/jobs/particle_extraction/`, payload);
};

// Dashboard visualization APIs
const getExtractResultsApi = (jobId = "") => {
  return axiosInstance.get(`/api/dashboard/extract/${jobId}`);
};

const getExtractParticlesImageApi = (jobId = "") => {
  return axiosInstance.get(`/extract/particles-image/?job_id=${jobId}`);
};

export {
  particleExtractionAPI,
  getExtractResultsApi,
  getExtractParticlesImageApi,
};
