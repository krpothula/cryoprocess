import axiosInstance from "../config";

const getJobsApi = (projectId = "", skip = 0, limit = 10) => {
  return axiosInstance.get(
    `/jobs?projectId=${projectId}&skip=${skip}&limit=${limit}`
  );
};

const getFilesApi = (projectId = "", jobId = "") => {
  return axiosInstance.get(
    `/api/download/?projectId=${projectId}&jobId=${jobId}`
  );
};

const getLogsApi = (projectId = "", jobId = "") => {
  return axiosInstance.get(
    `/api/import/logs?projectId=${projectId}&jobId=${jobId}`
  );
};

const getGroupedFilesApi = (projectId = "", type = "") => {
  return axiosInstance.get(
    `/grouping/files/?projectId=${projectId}&type=${type}`
  );
};
const getGroupedMrcFilesApi = (projectId = "", type = "") => {
  return axiosInstance.get(
    `/listing/mrcfiles/?projectId=${projectId}&type=${type}`
  );
};

const getMrcMapsApi = (projectId = "", type = "") => {
  return axiosInstance.get(
    `/listing/mrcmaps/?projectId=${projectId}&type=${type}`
  );
};

const getJobsTreeApi = (projectId = "") => {
  return axiosInstance.get(`/api/jobs/tree?projectId=${projectId}`);
};

/**
 * Get star files from any pipeline stage with job metadata.
 * Generic API for all job types to select input files from previous stages.
 * @param {string} projectId - Project ID
 * @param {string} stage - Stage name (Import, Motion, CTF, etc.)
 */
const getStageStarFilesApi = (projectId = "", stage = "") => {
  return axiosInstance.get(`/api/stage-files/?projectId=${projectId}&stage=${stage}`);
};

/**
 * Get MRC files from any pipeline stage with job metadata.
 * Generic API for all job types to select reference maps from previous stages.
 * @param {string} projectId - Project ID
 * @param {string} stage - Stage name (InitialModel, Class3D, AutoRefine, etc.)
 */
const getStageMrcFilesApi = (projectId = "", stage = "") => {
  return axiosInstance.get(`/api/stage-mrc-files/?projectId=${projectId}&stage=${stage}`);
};

/**
 * Get optimiser files from any pipeline stage for continuing stalled jobs.
 * Returns _optimiser.star files with latest iteration from each job.
 * @param {string} projectId - Project ID
 * @param {string} stage - Stage name (Class2D, Class3D, AutoRefine, InitialModel)
 */
const getStageOptimiserFilesApi = (projectId = "", stage = "") => {
  return axiosInstance.get(`/api/stage-optimiser-files/?projectId=${projectId}&stage=${stage}`);
};

/**
 * Get particle metadata from a STAR file.
 * Returns box size, pixel size, and particle count.
 * @param {string} projectId - Project ID
 * @param {string} starFile - Path to particles.star file
 */
const getParticleMetadataApi = (projectId = "", starFile = "") => {
  return axiosInstance.get(`/api/particle-metadata/?projectId=${projectId}&starFile=${encodeURIComponent(starFile)}`);
};

/**
 * Browse project folder directly on the filesystem.
 * Returns list of files and folders in the specified path.
 * @param {string} projectId - Project ID
 * @param {string} path - Relative path within project (empty for root)
 * @param {string} extensions - Comma-separated file extensions to filter (e.g., ".mrc,.map")
 */
const browseFolderApi = (projectId = "", path = "", extensions = "") => {
  let url = `/api/browse-folder/?projectId=${projectId}&path=${encodeURIComponent(path)}`;
  if (extensions) {
    url += `&extensions=${encodeURIComponent(extensions)}`;
  }
  return axiosInstance.get(url);
};

/**
 * Get job details including parameters.
 * Used for copying job parameters to a new job.
 * @param {string} jobId - Job ID
 */
const getJobDetailsApi = (jobId = "") => {
  return axiosInstance.get(`/api/jobs/${jobId}`);
};

/**
 * Get output files and downstream suggestions for a completed job.
 * Used when user clicks a job in the tree to auto-populate downstream builder inputs.
 * @param {string} jobId - Job ID
 */
const getJobOutputsApi = (jobId = "") => {
  return axiosInstance.get(`/api/jobs/${jobId}/outputs`);
};

/**
 * Get output files from completed jobs of specified stages (database-backed).
 * Replaces filesystem-scanning getStageStarFilesApi/getStageMrcFilesApi.
 * @param {string} projectId - Project ID
 * @param {string} stages - Comma-separated stage names (e.g., "Extract,Subset,ManualSelect")
 * @param {string} fileType - Filter by file type: 'star', 'mrc', 'cif', 'pdb' (optional)
 * @param {string} role - Filter by semantic role: 'particlesStar', 'referenceMrc', etc. (optional)
 */
const getStageOutputFilesApi = (projectId = "", stages = "", fileType = "", role = "") => {
  let url = `/api/jobs/stage-outputs?projectId=${projectId}&stages=${encodeURIComponent(stages)}`;
  if (fileType) url += `&fileType=${fileType}`;
  if (role) url += `&role=${role}`;
  return axiosInstance.get(url);
};

export {
  getJobsApi,
  getFilesApi,
  getLogsApi,
  getGroupedFilesApi,
  getGroupedMrcFilesApi,
  getMrcMapsApi,
  getJobsTreeApi,
  getStageStarFilesApi,
  getStageMrcFilesApi,
  getStageOptimiserFilesApi,
  getParticleMetadataApi,
  browseFolderApi,
  getJobDetailsApi,
  getJobOutputsApi,
  getStageOutputFilesApi,
};
