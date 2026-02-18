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
            name: userInfo.firstName || userInfo.name || userInfo.username,
            username: userInfo.username,
            email: userInfo.email,
            isSuperuser: userInfo.isSuperuser || false,
            isStaff: userInfo.isStaff || false
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
    <div className="flex items-center justify-center min-h-screen p-6 bg-[var(--color-bg)] transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-[var(--color-bg-card)] rounded-lg shadow-lg">
        <h1 className="mb-1 text-3xl font-bold text-center text-[var(--color-text-heading)]">
          Login
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label htmlFor="login-email" className="block mb-1 text-sm font-medium text-[var(--color-text)]">
              Email
            </label>
            <input
              id="login-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@example.com"
              className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
              required
              autoComplete="email"
            />
          </div>

          <div>
            <label htmlFor="login-password" className="block mb-1 text-sm font-medium text-[var(--color-text)]">
              Password
            </label>
            <div className="relative">
              <input
                id="login-password"
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter password"
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
                required
                autoComplete="current-password"
              />
            </div>
          </div>

          {error && <p className="text-sm font-medium text-[var(--color-danger-text)]" role="alert">{error}</p>}

          <button
            type="submit"
            className="w-full py-2 font-semibold text-white transition duration-150 bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] focus:outline-none"
          >
            {isLoading ? "Please wait ..." : "Log In"}
          </button>

          <div className="text-sm text-center">
            <Link to="/forgot-password" className="font-semibold text-[var(--color-primary)]">
              Forgot password?
            </Link>
          </div>

          <div className="text-sm text-center text-[var(--color-text-secondary)]">
            Don't have an account?{" "}
            <span className="font-semibold text-[var(--color-primary)]">
              Contact Admin
            </span>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;
