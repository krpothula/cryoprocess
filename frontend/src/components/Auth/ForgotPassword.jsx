import React, { useState } from "react";
import { Link } from "react-router-dom";
import { forgotPasswordApi } from "../../services/auth/auth";
import useToast from "../../hooks/useToast";

const ForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const showToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading || !email) return;

    setLoading(true);
    try {
      await forgotPasswordApi({ email });
      setSubmitted(true);
    } catch (err) {
      showToast("Something went wrong. Please try again.", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-2xl dark:shadow-black/20">
        <h1 className="mb-1 text-3xl font-bold text-center text-gray-900 dark:text-slate-100">
          Reset Password
        </h1>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-center text-gray-600 dark:text-slate-300">
              If an account with that email exists, we've sent a password reset link.
              Check your email and follow the instructions.
            </p>
            <div className="text-sm text-center">
              <Link to="/login" className="font-semibold text-indigo-600 dark:text-blue-400">
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <p className="text-sm text-gray-600 dark:text-slate-400">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="reset-email" className="block mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-blue-400"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 font-semibold text-white transition duration-150 bg-indigo-600 dark:bg-blue-600 rounded-lg hover:bg-indigo-700 dark:hover:bg-blue-500 focus:outline-none"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
            </button>

            <div className="text-sm text-center dark:text-slate-400">
              <Link to="/login" className="font-semibold text-indigo-600 dark:text-blue-400">
                Back to Login
              </Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

export default ForgotPassword;
