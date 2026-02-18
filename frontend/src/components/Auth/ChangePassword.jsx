import React, { useState } from "react";
import { FiLock, FiEye, FiEyeOff, FiLoader, FiCheck } from "react-icons/fi";
import adminApi from "../../services/adminApi";
import useToast from "../../hooks/useToast";
import { useNavigate } from "react-router-dom";

const ChangePassword = ({ isForced = false, onSuccess }) => {
  const [formData, setFormData] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: ""
  });
  const [showPasswords, setShowPasswords] = useState({
    current: false,
    new: false,
    confirm: false
  });
  const [isLoading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const showToast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    if (error) setError(null);
  };

  const togglePasswordVisibility = (field) => {
    setShowPasswords({ ...showPasswords, [field]: !showPasswords[field] });
  };

  const validatePassword = () => {
    if (formData.newPassword.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (formData.newPassword !== formData.confirmPassword) {
      setError("Passwords do not match");
      return false;
    }
    return true;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    if (!validatePassword()) return;

    setLoading(true);
    try {
      await adminApi.changePassword(formData);
      showToast("Password changed successfully", { type: "success" });

      if (onSuccess) {
        onSuccess();
      } else {
        navigate("/projects");
      }
    } catch (error) {
      setError(error.response?.data?.message || "Failed to change password");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-page">
      <div className="change-password-card">
        <div className="card-icon">
          <FiLock />
        </div>
        <h1>{isForced ? "Change Your Password" : "Change Password"}</h1>
        {isForced && (
          <p className="forced-message">
            You must change your password before continuing.
          </p>
        )}

        {error && (
          <div className="error-message">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>Current Password</label>
            <div className="password-input">
              <input
                type={showPasswords.current ? "text" : "password"}
                name="currentPassword"
                value={formData.currentPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => togglePasswordVisibility("current")}
              >
                {showPasswords.current ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
          </div>

          <div className="form-group">
            <label>New Password</label>
            <div className="password-input">
              <input
                type={showPasswords.new ? "text" : "password"}
                name="newPassword"
                value={formData.newPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => togglePasswordVisibility("new")}
              >
                {showPasswords.new ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            <span className="password-hint">Minimum 8 characters</span>
          </div>

          <div className="form-group">
            <label>Confirm New Password</label>
            <div className="password-input">
              <input
                type={showPasswords.confirm ? "text" : "password"}
                name="confirmPassword"
                value={formData.confirmPassword}
                onChange={handleChange}
                required
              />
              <button
                type="button"
                className="toggle-password"
                onClick={() => togglePasswordVisibility("confirm")}
              >
                {showPasswords.confirm ? <FiEyeOff /> : <FiEye />}
              </button>
            </div>
            {formData.newPassword && formData.confirmPassword && (
              <span className={`match-indicator ${formData.newPassword === formData.confirmPassword ? 'match' : 'no-match'}`}>
                {formData.newPassword === formData.confirmPassword ? (
                  <><FiCheck /> Passwords match</>
                ) : (
                  "Passwords do not match"
                )}
              </span>
            )}
          </div>

          <button type="submit" className="btn-submit" disabled={isLoading}>
            {isLoading ? (
              <>
                <FiLoader className="spinner" />
                Changing...
              </>
            ) : (
              "Change Password"
            )}
          </button>
        </form>
      </div>

      <style>{`
        .change-password-page {
          min-height: 100vh;
          display: flex;
          align-items: center;
          justify-content: center;
          background: linear-gradient(180deg, var(--color-bg) 0%, var(--color-border) 100%);
          padding: 20px;
        }

        .change-password-card {
          background: var(--color-bg-card);
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }

        .card-icon {
          width: 56px;
          height: 56px;
          background: var(--color-border-light);
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 24px;
          color: var(--color-text-heading);
        }

        .change-password-card h1 {
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-heading);
          text-align: center;
          margin: 0 0 8px;
        }

        .forced-message {
          text-align: center;
          color: var(--color-text-secondary);
          font-size: 14px;
          margin-bottom: 24px;
        }

        .error-message {
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger-border);
          color: var(--color-danger-text);
          padding: 12px 16px;
          border-radius: 8px;
          font-size: 14px;
          margin-bottom: 20px;
          text-align: center;
        }

        .form-group {
          margin-bottom: 20px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-label);
          margin-bottom: 8px;
        }

        .password-input {
          position: relative;
        }

        .password-input input {
          width: 100%;
          padding: 12px 44px 12px 14px;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.15s;
          background: var(--color-bg-card);
          color: var(--color-text-heading);
        }

        .password-input input:focus {
          outline: none;
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .toggle-password {
          position: absolute;
          right: 12px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          cursor: pointer;
          color: var(--color-text-secondary);
          padding: 4px;
        }

        .toggle-password:hover {
          color: var(--color-text-heading);
        }

        .password-hint {
          display: block;
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: 6px;
        }

        .match-indicator {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 12px;
          margin-top: 6px;
        }

        .match-indicator.match {
          color: var(--color-success-text);
        }

        .match-indicator.no-match {
          color: var(--color-danger-text);
        }

        .btn-submit {
          width: 100%;
          padding: 14px 20px;
          background: var(--color-text-heading);
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.15s;
          margin-top: 8px;
        }

        .btn-submit:hover:not(:disabled) {
          background: var(--color-text);
        }

        .btn-submit:disabled {
          opacity: 0.7;
          cursor: not-allowed;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default ChangePassword;
