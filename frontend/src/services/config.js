import axios from "axios";

// Create an instance of axios with default configuration
// withCredentials ensures HttpOnly auth cookies are sent with every request
const axiosInstance = axios.create({
  baseURL: process.env.REACT_APP_API_HOST,
  headers: {
    "Content-Type": "application/json",
  },
  withCredentials: true,
});

// Token refresh state
let isRefreshing = false;
let failedQueue = [];

const processQueue = (success) => {
  failedQueue.forEach((p) => {
    if (success) {
      p.resolve();
    } else {
      p.reject();
    }
  });
  failedQueue = [];
};

// Auth endpoints that should not trigger a refresh attempt
const AUTH_PATHS = ["/api/auth/login", "/api/auth/register", "/api/auth/refresh",
  "/api/auth/forgot-password", "/api/auth/reset-password"];

// Response interceptor with automatic token refresh on 401
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Only attempt refresh on 401 errors, not on auth endpoints, and not already retried
    if (
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !AUTH_PATHS.some((p) => originalRequest.url?.includes(p))
    ) {
      if (isRefreshing) {
        // Queue this request while refresh is in progress
        return new Promise((resolve, reject) => {
          failedQueue.push({ resolve, reject });
        }).then(() => axiosInstance(originalRequest));
      }

      originalRequest._retry = true;
      isRefreshing = true;

      try {
        await axiosInstance.post("/api/auth/refresh");
        processQueue(true);
        return axiosInstance(originalRequest);
      } catch (refreshError) {
        processQueue(false);
        // Refresh failed — force logout
        localStorage.removeItem("isAuthenticated");
        localStorage.removeItem("userInfo");
        if (!window.location.pathname.includes("/login") && window.location.pathname !== "/") {
          window.location.href = "/";
        }
        return Promise.reject(refreshError);
      } finally {
        isRefreshing = false;
      }
    }

    // Auth endpoint 401s — direct logout (no refresh attempt)
    if (error.response?.status === 401) {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userInfo");
      if (!window.location.pathname.includes("/login") && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }

    return Promise.reject(error);
  }
);

export default axiosInstance;
