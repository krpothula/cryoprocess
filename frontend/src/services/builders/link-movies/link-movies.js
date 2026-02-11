import axiosInstance from "../../config";

/**
 * Submit a Link Movies job
 */
export const linkMoviesApi = (payload) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/link_movies/`, payload);
};

/**
 * Get Link Movies job results
 */
export const getLinkMoviesResultsApi = (jobId) => {
  return axiosInstance.get(`/api/jobs/link_movies/results/${jobId}/`);
};

/**
 * Preview files that would be linked
 */
export const previewLinkMoviesApi = (sourcePath, pattern = "*.mrc") => {
  return axiosInstance.get(`/api/jobs/link_movies/preview/`, {
    params: { source_path: sourcePath, pattern }
  });
};
