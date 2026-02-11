/**
 * Unified Jobs API Service
 *
 * All job types use the same endpoint pattern: /api/jobs/<job_type>
 * Works with Node.js backend
 */
import axiosInstance from "./config";

/**
 * Submit a job of any type
 * @param {string} jobType - Job type (link_movies, import, motion_correction, etc.)
 * @param {object} payload - Job parameters
 */
export const submitJob = (jobType, payload) => {
  return axiosInstance.post(`/api/jobs/${jobType}`, payload);
};

/**
 * Get job results
 * @param {string} jobType - Job type
 * @param {string} jobId - Job ID
 */
export const getJobResults = (jobType, jobId) => {
  return axiosInstance.get(`/api/jobs/${jobType}/results/${jobId}`);
};

/**
 * Get job details by ID
 * @param {string} jobId - Job ID
 */
export const getJobDetails = (jobId) => {
  return axiosInstance.get(`/api/jobs/${jobId}`);
};

/**
 * Get job summary for a project
 * @param {string} jobType - Job type
 * @param {string} projectId - Project ID
 */
export const getJobSummary = (jobType, projectId) => {
  return axiosInstance.get(`/api/jobs/${jobType}/summary?project_id=${projectId}`);
};

// Convenience functions for specific job types

export const submitLinkMovies = (payload) => submitJob("link_movies", payload);
export const submitImport = (payload) => submitJob("import", payload);
export const submitMotionCorrection = (payload) => submitJob("motion_correction", payload);
export const submitCtf = (payload) => submitJob("ctf", payload);
export const submitAutoPick = (payload) => submitJob("auto_pick", payload);
export const submitParticleExtraction = (payload) => submitJob("particle_extraction", payload);
export const submit2DClassification = (payload) => submitJob("classification_2d", payload);
export const submit3DInitialModel = (payload) => submitJob("initial_model_3d", payload);
export const submit3DClassification = (payload) => submitJob("classification_3d", payload);
export const submit3DAutoRefine = (payload) => submitJob("auto_refine_3d", payload);

/**
 * Get job progress (for running jobs)
 * Returns processed count, total, and percentage based on output file counting
 * @param {string} jobId - Job ID
 */
export const getJobProgress = (jobId) => {
  return axiosInstance.get(`/api/jobs/${jobId}/progress`);
};
