/**
 * Cluster Configuration API Service
 *
 * Handles communication with the cluster configuration backend
 */
import axiosInstance from "./config";

const CLUSTER_BASE_URL = "/api/cluster";

/**
 * Get list of all cluster configurations
 */
export const getClusterConfigs = async () => {
  const response = await axiosInstance.get(`${CLUSTER_BASE_URL}/configs/`);
  return response.data;
};

/**
 * Get a specific cluster configuration by name
 */
export const getClusterConfig = async (name) => {
  const response = await axiosInstance.get(`${CLUSTER_BASE_URL}/configs/${name}/`);
  return response.data;
};

/**
 * Create a new cluster configuration
 */
export const createClusterConfig = async (config) => {
  const response = await axiosInstance.post(`${CLUSTER_BASE_URL}/configs/`, config);
  return response.data;
};

/**
 * Update an existing cluster configuration
 */
export const updateClusterConfig = async (name, config) => {
  const response = await axiosInstance.put(`${CLUSTER_BASE_URL}/configs/${name}/`, config);
  return response.data;
};

/**
 * Delete a cluster configuration
 */
export const deleteClusterConfig = async (name) => {
  const response = await axiosInstance.delete(`${CLUSTER_BASE_URL}/configs/${name}/`);
  return response.data;
};

/**
 * Activate a cluster configuration
 */
export const activateClusterConfig = async (name) => {
  const response = await axiosInstance.post(`${CLUSTER_BASE_URL}/configs/${name}/activate/`);
  return response.data;
};

/**
 * Test cluster connectivity
 */
export const testClusterConnection = async (name = null) => {
  const url = name
    ? `${CLUSTER_BASE_URL}/test/${name}/`
    : `${CLUSTER_BASE_URL}/test/`;
  const response = await axiosInstance.post(url);
  return response.data;
};

/**
 * Get current cluster status
 */
export const getClusterStatus = async () => {
  const response = await axiosInstance.get(`${CLUSTER_BASE_URL}/status/`);
  return response.data;
};

const clusterApi = {
  getClusterConfigs,
  getClusterConfig,
  createClusterConfig,
  updateClusterConfig,
  deleteClusterConfig,
  activateClusterConfig,
  testClusterConnection,
  getClusterStatus,
};

export default clusterApi;
