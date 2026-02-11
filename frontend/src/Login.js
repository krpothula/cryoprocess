import React, { useContext, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { MyContext } from "./useContext/authContext";
import { loginApi } from "./services/auth/auth";
import useToast from "./hooks/useToast";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setLoading] = useState(false);
  const navigate = useNavigate(); // Initialize useNavigate
  const location = useLocation(); // Get current location
  const showToast = useToast();

  const { setUser } = useContext(MyContext);

  // Log the current pathname
  useEffect(() => {
    // console.log('Current Pathname:', location.pathname);
  }, [location]);

  const handleSubmit = (e) => {
    e.preventDefault();

    if (isLoading) {
      // return if api is already in progress
      return;
    }

    if (!username || !password) {
      // error when any of the field value is empty
      alert("Please enter valid username and password");
      return;
    }
    setError("");
    setLoading(true);
    loginApi({ email_address: username, password })
      .then((resp) => {
        // Token is now set as HttpOnly cookie by the backend
        const data = resp?.data?.data || resp?.data;
        const userInfo = data?.user || data;

        if (userInfo) {
          localStorage.setItem("isAuthenticated", "true");
          localStorage.setItem("userInfo", JSON.stringify({
            id: userInfo.id,
            name: userInfo.first_name || userInfo.name || userInfo.username,
            username: userInfo.username,
            email: userInfo.email,
            is_superuser: userInfo.is_superuser || false,
            is_staff: userInfo.is_staff || false
          }));
          setUser(true);
          navigate("/projects");
        }
      })
      .catch(() => {
        setLoading(false);
        showToast("Invalid username or password", {
          type: "error",
        });
      });
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50">
      <div className="w-full max-w-md p-8 bg-white rounded-lg shadow-lg">
        <h1 className="mb-1 text-3xl font-bold text-center text-gray-900">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="login-username" className="block mb-1 text-sm font-medium text-gray-700">
              Username or Email
            </label>
            <input
              id="login-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Enter username or email"
              className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-indigo-500"
              required
              autoComplete="username"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block mb-1 text-sm font-medium text-gray-700">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg bg-gray-50 focus:outline-none focus:border-indigo-500"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-500" role="alert">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 font-semibold text-white transition duration-150 bg-indigo-600 rounded-lg hover:bg-indigo-700 focus:outline-none"
          >
            {isLoading ? "Please wait ..." : "Log In"}
          </button>

          <div className="mt-6 text-sm text-center">
            Don't have an account?{" "}
            <span className="font-semibold text-indigo-600">
              Contact Admin
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
