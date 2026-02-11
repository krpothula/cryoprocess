import axiosInstance from "../config";

/**
 * Login API - works with Node.js backend
 * @param {object} payload - { username, password } or { email, password }
 */
const loginApi = (payload = {}) => {
  // Node.js backend expects username/password
  const loginPayload = {
    username: payload.email_address || payload.username,
    password: payload.password
  };
  return axiosInstance.post(`/api/auth/login`, loginPayload);
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

export { loginApi, registerApi, getCurrentUser, updateProfileApi, changePasswordApi };
