import axiosInstance from "./config";

const BASE = "/api/smartscope";

/**
 * Health check / connection test
 * GET /api/smartscope/health
 */
export const healthCheck = () => {
  return axiosInstance.get(`${BASE}/health`);
};

/**
 * Start watching a directory for new micrographs
 * POST /api/smartscope/start
 * @param {Object} payload - { pixel_size, voltage, cs, watch_directory, session_name, ... }
 */
export const startSession = (payload) => {
  return axiosInstance.post(`${BASE}/start`, payload);
};

/**
 * Get completed micrograph results
 * GET /api/smartscope/results/:sessionId
 * @param {string} sessionId - Session ID
 * @param {string} [since] - ISO timestamp to get only new results
 */
export const getResults = (sessionId, since) => {
  const params = since ? `?since=${encodeURIComponent(since)}` : '';
  return axiosInstance.get(`${BASE}/results/${sessionId}${params}`);
};

/**
 * Stop watching
 * POST /api/smartscope/stop/:sessionId
 * @param {string} sessionId - Session ID
 */
export const stopSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/stop/${sessionId}`);
};

/**
 * Pause watching
 * POST /api/smartscope/pause/:sessionId
 * @param {string} sessionId - Session ID
 */
export const pauseSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/pause/${sessionId}`);
};

/**
 * Resume watching
 * POST /api/smartscope/resume/:sessionId
 * @param {string} sessionId - Session ID
 */
export const resumeSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/resume/${sessionId}`);
};
