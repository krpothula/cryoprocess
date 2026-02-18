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
    <div className="flex items-center justify-center min-h-screen p-6 bg-[var(--color-bg)] transition-colors duration-200">
      <div className="w-full max-w-md p-8 bg-[var(--color-bg-card)] rounded-lg shadow-lg">
        <h1 className="mb-1 text-3xl font-bold text-center text-[var(--color-text-heading)]">
          Reset Password
        </h1>

        {submitted ? (
          <div className="mt-6 space-y-4">
            <p className="text-sm text-center text-[var(--color-text-secondary)]">
              If an account with that email exists, we've sent a password reset link.
              Check your email and follow the instructions.
            </p>
            <div className="text-sm text-center">
              <Link to="/login" className="font-semibold text-[var(--color-primary)]">
                Back to Login
              </Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="mt-6 space-y-6">
            <p className="text-sm text-[var(--color-text-secondary)]">
              Enter your email address and we'll send you a link to reset your password.
            </p>
            <div>
              <label htmlFor="reset-email" className="block mb-1 text-sm font-medium text-[var(--color-text)]">
                Email
              </label>
              <input
                id="reset-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full px-4 py-2 border border-[var(--color-border)] rounded-lg bg-[var(--color-bg)] text-[var(--color-text)] placeholder-[var(--color-text-muted)] focus:outline-none focus:border-[var(--color-border-focus)]"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              className="w-full py-2 font-semibold text-white transition duration-150 bg-[var(--color-primary)] rounded-lg hover:bg-[var(--color-primary-hover)] focus:outline-none"
            >
              {isLoading ? "Sending..." : "Send Reset Link"}
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

export default ForgotPassword;
