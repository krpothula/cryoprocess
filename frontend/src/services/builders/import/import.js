import axiosInstance from "../../config";

/**
 * Get import job results including imported files and status
 */
export const getImportResultsApi = (jobId) => {
  return axiosInstance.get(`/api/import/results/${jobId}/`);
};

/**
 * Get movie frame info (dimensions, frame count)
 * @param {string} moviePath - Relative or absolute path to movie file
 * @param {string} jobId - Job ID to resolve relative paths
 */
export const getMovieInfoApi = (moviePath, jobId) => {
  return axiosInstance.get(`/api/import/movie-frame/`, {
    params: { path: moviePath, job_id: jobId, info: true }
  });
};

/**
 * Get a single movie frame as PNG
 * @param {string} moviePath - Relative or absolute path to movie file
 * @param {number} frameIndex - Frame index to retrieve
 * @param {string} jobId - Job ID to resolve relative paths
 */
export const getMovieFrameApi = (moviePath, frameIndex = 0, jobId = null) => {
  return axiosInstance.get(`/api/import/movie-frame/`, {
    params: { path: moviePath, frame: frameIndex, job_id: jobId },
    responseType: 'blob'
  });
};

/**
 * Get averaged frame preview as PNG (sum of all frames)
 * @param {string} moviePath - Relative or absolute path to movie file
 * @param {string} jobId - Job ID to resolve relative paths
 */
export const getMovieAverageApi = (moviePath, jobId) => {
  return axiosInstance.get(`/api/import/movie-frame/`, {
    params: { path: moviePath, job_id: jobId, average: true },
    responseType: 'blob'
  });
};

/**
 * Get all movie frames as base64 encoded PNGs for animation
 * @param {string} moviePath - Relative or absolute path to movie file
 * @param {number} maxFrames - Maximum number of frames to return
 * @param {number} size - Thumbnail size in pixels
 * @param {string} jobId - Job ID to resolve relative paths
 */
export const getMovieAllFramesApi = (moviePath, maxFrames = 50, size = 256, jobId = null) => {
  return axiosInstance.get(`/api/import/movie-frames/`, {
    params: { path: moviePath, max_frames: maxFrames, size, job_id: jobId }
  });
};

/**
 * Generate PNG thumbnails for all imported movies in a job
 * @param {string} jobId - Job ID
 * @param {number} size - Thumbnail size in pixels
 */
export const generateThumbnailsApi = (jobId, size = 512) => {
  return axiosInstance.post(`/api/import/generate-thumbnails/${jobId}/`, { size });
};

/**
 * Get thumbnail URL for a movie
 * @param {string} jobId - Job ID
 * @param {string} filename - Thumbnail filename (e.g., "movie_name.png")
 */
export const getThumbnailUrl = (jobId, filename) => {
  return `/api/import/thumbnail/${jobId}/${filename}`;
};
