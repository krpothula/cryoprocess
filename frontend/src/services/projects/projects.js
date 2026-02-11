import axiosInstance from "../config";

/**
 * Create a new project
 * Node.js expects: { project_name, description }
 */
const createProjectApi = (payload = {}) => {
  return axiosInstance.post(`/api/projects`, payload);
};

/**
 * Get list of all projects
 */
const getProjectListApi = ({ limit, skip = 1 }) => {
  return axiosInstance.get(`/api/projects?skip=${skip}&limit=${limit}`);
};

/**
 * Get project by ID
 */
const getProjectByIdApi = (projectId) => {
  return axiosInstance.get(`/api/projects/${projectId}`);
};

// Delete project (requires confirmation)
const deleteProjectApi = (projectId, confirm = true) => {
  return axiosInstance.delete(`/api/projects/${projectId}`, {
    data: { confirm }
  });
};

// Get single project by ID
const getProjectApi = (projectId) => {
  return axiosInstance.get(`/api/projects/${projectId}`);
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
 * @param {object} payload - { user_id, username, or email } and { role }
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

export {
  createProjectApi,
  getProjectListApi,
  getProjectByIdApi,
  getProjectApi,
  deleteProjectApi,
  getProjectMembersApi,
  addProjectMemberApi,
  updateProjectMemberApi,
  removeProjectMemberApi,
  searchUsersApi
};
