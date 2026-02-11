import axiosInstance from "./config";

const BASE = "/api/live-sessions";

/**
 * Create a new live processing session.
 * Can optionally create a project alongside it.
 * @param {Object} payload - Session configuration
 */
export const createLiveSession = (payload) => {
  return axiosInstance.post(BASE, payload);
};

/**
 * Get a single live session by ID
 */
export const getSession = (sessionId) => {
  return axiosInstance.get(`${BASE}/${sessionId}`);
};

/**
 * Start a live session (begins file watching + pipeline)
 */
export const startSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/${sessionId}/start`);
};

/**
 * Pause a running session (stops watching, keeps jobs)
 */
export const pauseSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/${sessionId}/pause`);
};

/**
 * Resume a paused session
 */
export const resumeSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/${sessionId}/resume`);
};

/**
 * Stop a session permanently
 */
export const stopSession = (sessionId) => {
  return axiosInstance.post(`${BASE}/${sessionId}/stop`);
};

/**
 * Delete a session
 */
export const deleteSession = (sessionId) => {
  return axiosInstance.delete(`${BASE}/${sessionId}`);
};

/**
 * Get quality stats (CTF resolution distribution, motion distribution)
 */
export const getSessionStats = (sessionId) => {
  return axiosInstance.get(`${BASE}/${sessionId}/stats`);
};

/**
 * Get per-micrograph exposure table
 */
export const getSessionExposures = (sessionId) => {
  return axiosInstance.get(`${BASE}/${sessionId}/exposures`);
};

/**
 * Get activity log with optional filters
 * @param {string} sessionId
 * @param {Object} [filters] - { level, stage, search, limit }
 */
export const getSessionActivity = (sessionId, filters = {}) => {
  const params = new URLSearchParams();
  if (filters.level) params.set('level', filters.level);
  if (filters.stage) params.set('stage', filters.stage);
  if (filters.search) params.set('search', filters.search);
  if (filters.limit) params.set('limit', String(filters.limit));
  const qs = params.toString();
  return axiosInstance.get(`${BASE}/${sessionId}/activity${qs ? `?${qs}` : ''}`);
};

/**
 * List all live sessions for a project
 */
export const getProjectSessions = (projectId) => {
  return axiosInstance.get(`${BASE}/project/${projectId}`);
};
