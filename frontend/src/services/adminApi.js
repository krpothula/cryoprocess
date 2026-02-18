import axiosInstance from "./config";

// Admin User Management APIs

/**
 * Get list of all users (admin only)
 */
const getUsers = () => {
  return axiosInstance.get('/api/admin/users');
};

/**
 * Create a new user (admin only)
 * @param {Object} userData - { email, username, firstName, lastName, isStaff, isSuperuser }
 */
const createUser = (userData) => {
  return axiosInstance.post('/api/admin/users', userData);
};

/**
 * Update user details (admin only)
 * @param {number} userId
 * @param {Object} userData - { firstName, lastName, isActive, isStaff, isSuperuser }
 */
const updateUser = (userId, userData) => {
  return axiosInstance.patch(`/api/admin/users/${userId}`, userData);
};

/**
 * Delete a user (admin only)
 * @param {number} userId
 */
const deleteUser = (userId) => {
  return axiosInstance.delete(`/api/admin/users/${userId}`);
};

/**
 * Reset user password and get new temp password (admin only)
 * @param {number} userId
 */
const resetUserPassword = (userId) => {
  return axiosInstance.post(`/api/admin/users/${userId}/reset-password`);
};

/**
 * Generate API key for a user (admin only)
 * @param {number} userId
 */
const generateApiKey = (userId) => {
  return axiosInstance.post(`/api/admin/users/${userId}/generate-api-key`);
};

/**
 * Revoke API key for a user (admin only)
 * @param {number} userId
 */
const revokeApiKey = (userId) => {
  return axiosInstance.delete(`/api/admin/users/${userId}/api-key`);
};

// Auth APIs

/**
 * Change current user's password
 * @param {Object} passwords - { currentPassword, newPassword, confirmPassword }
 */
const changePassword = (passwords) => {
  return axiosInstance.post('/api/auth/change-password', passwords);
};

/**
 * Check if current user must change password
 */
const checkPasswordStatus = () => {
  return axiosInstance.get('/api/auth/password-status');
};

const adminApi = {
  getUsers,
  createUser,
  updateUser,
  deleteUser,
  resetUserPassword,
  generateApiKey,
  revokeApiKey,
  changePassword,
  checkPasswordStatus
};

export default adminApi;
