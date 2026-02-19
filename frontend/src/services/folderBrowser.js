import axiosInstance from "./config";

/**
 * Browse folder contents within a project
 * @param {string} projectId - Project ID
 * @param {string} path - Relative path within project (empty for root)
 * @param {object} filters - Optional filters { prefix, suffix, extensions }
 */
export const browseFolderApi = (projectId, path = "", filters = {}) => {
  const params = {
    projectId,
    path: path,
  };

  if (filters.prefix) params.prefix = filters.prefix;
  if (filters.suffix) params.suffix = filters.suffix;
  if (filters.extensions) params.extensions = filters.extensions;
  if (filters.showFiles !== undefined) params.showFiles = filters.showFiles;
  if (filters.limit !== undefined) params.limit = filters.limit;
  if (filters.offset !== undefined) params.offset = filters.offset;

  return axiosInstance.get("/api/files/browse", { params });
};

/**
 * Select files with a glob pattern
 * @param {string} projectId - Project ID
 * @param {string} folderPath - Folder path relative to project
 * @param {string} pattern - Glob pattern (e.g., "*.tiff")
 * @param {string} prefix - Filter by prefix
 * @param {string} suffix - Filter by suffix
 */
export const selectFilesApi = (projectId, folderPath, pattern = "*", prefix = "", suffix = "") => {
  return axiosInstance.post("/api/files/select", {
    projectId,
    folderPath,
    pattern: pattern,
    prefix: prefix,
    suffix: suffix,
  });
};
