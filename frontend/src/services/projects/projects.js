import axiosInstance from "../config";

/**
 * Create a new project
 * Node.js expects: { projectName, description }
 */
const createProjectApi = (payload = {}) => {
  return axiosInstance.post(`/api/projects`, payload);
};

/**
 * Get list of all projects
 * @param {object} params - { limit, skip, includeArchived }
 */
const getProjectListApi = ({ limit, skip = 1, includeArchived = 'false' }) => {
  return axiosInstance.get(`/api/projects?skip=${skip}&limit=${limit}&includeArchived=${includeArchived}`);
};

/**
 * Get project by ID
 */
const getProjectByIdApi = (projectId) => {
  return axiosInstance.get(`/api/projects/${projectId}`);
};

/**
 * Update project settings (name, description, webhookUrls, etc.)
 */
const updateProjectApi = (projectId, payload) => {
  return axiosInstance.put(`/api/projects/${projectId}`, payload);
};

// Delete project (requires confirmation)
const deleteProjectApi = (projectId, confirm = true) => {
  return axiosInstance.delete(`/api/projects/${projectId}`, {
    data: { confirm }
  });
};

/**
 * Get project members
 * @param {string} projectId - Project ID
 */
const getProjectMembersApi = (projectId) => {
  return axiosInstance.get(`/api/projects/${projectId}/members`);
};

/**
 * Add member to project
 * @param {string} projectId - Project ID
 * @param {object} payload - { userId, username, or email } and { role }
 */
const addProjectMemberApi = (projectId, payload) => {
  return axiosInstance.post(`/api/projects/${projectId}/members`, payload);
};

/**
 * Update member role
 * @param {string} projectId - Project ID
 * @param {number} userId - User ID
 * @param {string} role - New role (viewer, editor, admin)
 */
const updateProjectMemberApi = (projectId, userId, role) => {
  return axiosInstance.put(`/api/projects/${projectId}/members/${userId}`, { role });
};

/**
 * Remove member from project
 * @param {string} projectId - Project ID
 * @param {number} userId - User ID
 */
const removeProjectMemberApi = (projectId, userId) => {
  return axiosInstance.delete(`/api/projects/${projectId}/members/${userId}`);
};

/**
 * Search users (for adding members)
 * @param {string} query - Search query (username, email, name)
 */
const searchUsersApi = (query) => {
  return axiosInstance.get(`/api/users/search?q=${encodeURIComponent(query)}`);
};

/**
 * Archive a project (move to archive storage)
 * @param {string} projectId
 */
const archiveProjectApi = (projectId) => {
  return axiosInstance.put(`/api/projects/${projectId}/archive`);
};

/**
 * Restore an archived project (move back to active storage)
 * @param {string} projectId
 */
const restoreProjectApi = (projectId) => {
  return axiosInstance.put(`/api/projects/${projectId}/restore`);
};

export {
  createProjectApi,
  getProjectListApi,
  getProjectByIdApi,
  updateProjectApi,
  deleteProjectApi,
  archiveProjectApi,
  restoreProjectApi,
  getProjectMembersApi,
  addProjectMemberApi,
  updateProjectMemberApi,
  removeProjectMemberApi,
  searchUsersApi
};
