import axiosInstance from "../config";

/**
 * Login API
 * @param {object} payload - { email, password }
 */
const loginApi = (payload = {}) => {
  return axiosInstance.post(`/api/auth/login`, {
    email: payload.email,
    password: payload.password
  });
};

/**
 * Register API
 */
const registerApi = (payload = {}) => {
  return axiosInstance.post(`/api/auth/register`, payload);
};

/**
 * Get current user info
 */
const getCurrentUser = () => {
  return axiosInstance.get(`/api/auth/me`);
};

/**
 * Update user profile
 * @param {object} payload - { first_name, last_name, email }
 */
const updateProfileApi = (payload = {}) => {
  return axiosInstance.put(`/api/auth/profile`, payload);
};

/**
 * Change password
 * @param {object} payload - { current_password, new_password }
 */
const changePasswordApi = (payload = {}) => {
  return axiosInstance.post(`/api/auth/change-password`, payload);
};

/**
 * Update cluster SSH settings
 * @param {object} payload - { cluster_username, cluster_ssh_key }
 */
const updateClusterSettingsApi = (payload = {}) => {
  return axiosInstance.put(`/api/auth/cluster-settings`, payload);
};

/**
 * Test cluster SSH connection
 * @returns {Promise<{connected: boolean, message: string}>}
 */
const testClusterConnectionApi = () => {
  return axiosInstance.post(`/api/auth/cluster-test`);
};

export {
  loginApi,
  registerApi,
  getCurrentUser,
  updateProfileApi,
  changePasswordApi,
  updateClusterSettingsApi,
  testClusterConnectionApi
};
