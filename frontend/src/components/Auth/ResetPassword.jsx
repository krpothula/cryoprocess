import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { resetPasswordApi } from "../../services/auth/auth";
import useToast from "../../hooks/useToast";

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const showToast = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (isLoading) return;

    if (newPassword !== confirmPassword) {
      showToast("Passwords do not match", { type: "error" });
      return;
    }

    if (newPassword.length < 8) {
      showToast("Password must be at least 8 characters", { type: "error" });
      return;
    }

    if (!token) {
      showToast("Invalid reset link", { type: "error" });
      return;
    }

    setLoading(true);
    try {
      await resetPasswordApi({
        token,
        new_password: newPassword,
        confirm_password: confirmPassword,
      });
      setSuccess(true);
    } catch (err) {
      const msg = err.response?.data?.message || "Invalid or expired reset link";
      showToast(msg, { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen p-6 bg-gray-50 dark:bg-slate-900 transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-white dark:bg-slate-800 rounded-lg shadow-lg dark:shadow-2xl dark:shadow-black/20">
        <h1 className="mb-1 text-3xl font-bold text-center text-gray-900 dark:text-slate-100">
          Set New Password
        </h1>

        {success ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-center text-green-600 dark:text-green-400">
              Your password has been reset successfully.
            </p>
            <div className="text-sm text-center">
              <Link to="/login" className="font-semibold text-indigo-600 dark:text-blue-400">
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {!token && (
              <p className="text-sm text-red-500 dark:text-red-400 text-center">
                Invalid reset link. Please request a new one.
              </p>
            )}

            <div>
              <label htmlFor="new-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-blue-400"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block mb-1 text-sm font-medium text-gray-700 dark:text-slate-300">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2 border border-gray-300 dark:border-slate-600 rounded-lg bg-gray-50 dark:bg-slate-700 dark:text-slate-100 dark:placeholder-slate-400 focus:outline-none focus:border-indigo-500 dark:focus:border-blue-400"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={!token}
              className="w-full py-2 font-semibold text-white transition duration-150 bg-indigo-600 dark:bg-blue-600 rounded-lg hover:bg-indigo-700 dark:hover:bg-blue-500 focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
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

export default ResetPassword;
