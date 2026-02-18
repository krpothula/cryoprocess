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
        newPassword,
        confirmPassword,
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
    <div className="flex items-center justify-center min-h-screen p-6 bg-[var(--color-bg)] transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-[var(--color-bg-card)] rounded-lg shadow-lg">
        <h1 className="mb-1 text-3xl font-bold text-center text-[var(--color-text-heading)]">
          Set New Password
        </h1>

        {success ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-center text-[var(--color-success-text)]">
              Your password has been reset successfully.
            </p>
            <div className="text-sm text-center">
              <Link to="/login" className="font-semibold text-[var(--color-primary)]">
                Go to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            {!token && (
              <p className="text-sm text-[var(--color-danger-text)] text-center">
                Invalid reset link. Please request a new one.
              </p>
            )}

            <div>
              <label htmlFor="new-password" className="block mb-1 text-sm font-medium text-[var(--color-text)]">
                New Password
              </label>
              <input
                id="new-password"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Minimum 8 characters"
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <div>
              <label htmlFor="confirm-password" className="block mb-1 text-sm font-medium text-[var(--color-text)]">
                Confirm Password
              </label>
              <input
                id="confirm-password"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Re-enter your password"
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>

            <button
              type="submit"
              disabled={!token}
              className="w-full py-2 font-semibold text-white transition duration-150 bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? "Resetting..." : "Reset Password"}
            </button>

            <div className="text-sm text-center text-[var(--color-text-secondary)]">
              <Link to="/login" className="font-semibold text-[var(--color-primary)]">
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
