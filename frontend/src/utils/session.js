import axios from "axios";

const logout = async () => {
  try {
    // Clear HttpOnly auth cookie on the server
    await axios.post(
      `${process.env.REACT_APP_API_HOST || ""}/api/auth/logout`,
      {},
      { withCredentials: true }
    );
  } catch {
    // Continue with client-side cleanup even if server call fails
  }
  localStorage.removeItem("isAuthenticated");
  localStorage.removeItem("userInfo");
  window.location.href = "/";
};

export { logout };
