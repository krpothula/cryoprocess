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

// Response interceptor to handle 401 Unauthorized errors
axiosInstance.interceptors.response.use(
  (response) => {
    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem("isAuthenticated");
      localStorage.removeItem("userInfo");

      // Redirect to login page (avoid redirect loop if already on login)
      if (!window.location.pathname.includes("/login") && window.location.pathname !== "/") {
        window.location.href = "/";
      }
    }
    return Promise.reject(error);
  }
);

export default axiosInstance;
