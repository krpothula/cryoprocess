import React, { useContext, useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./App.css";
import { MyContext } from "./useContext/authContext";
import { loginApi } from "./services/auth/auth";
import useToast from "./hooks/useToast";

const Login = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
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

    if (!email || !password) {
      alert("Please enter valid email and password");
      return;
    }
    setError("");
    setLoading(true);
    loginApi({ email, password })
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
        showToast("Invalid email or password", {
          type: "error",
        });
      });
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-2xl dark:shadow-black/20">
        <h1 className="mb-1 text-3xl font-bold text-center text-gray-900 dark:text-slate-100">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-blue-400"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-blue-400"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-red-500 dark:text-red-400" role="alert">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 font-semibold text-white transition duration-150 bg-indigo-600 dark:bg-blue-600 rounded-lg hover:bg-indigo-700 dark:hover:bg-blue-500 focus:outline-none"
          >
            {isLoading ? "Please wait ..." : "Log In"}
          </button>

          <div className="text-sm text-center">
            <Link to="/forgot-password" className="font-semibold text-indigo-600 dark:text-blue-400">
              Forgot password?
            </Link>
          </div>

          <div className="text-sm text-center dark:text-slate-400">
            Don't have an account?{" "}
            <span className="font-semibold text-indigo-600 dark:text-blue-400">
              Contact Admin
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
