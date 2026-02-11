import React, { useState } from "react";
import { FiLock, FiEye, FiEyeOff, FiLoader, FiCheck } from "react-icons/fi";
import adminApi from "../../services/adminApi";
import useToast from "../../hooks/useToast";
import { useNavigate } from "react-router-dom";

const ChangePassword = ({ isForced = false, onSuccess }) => {
  const [formData, setFormData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
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
    if (formData.new_password.length < 8) {
      setError("Password must be at least 8 characters");
      return false;
    }
    if (formData.new_password !== formData.confirm_password) {
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
                name="current_password"
                value={formData.current_password}
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
                name="new_password"
                value={formData.new_password}
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
                name="confirm_password"
                value={formData.confirm_password}
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
            {formData.new_password && formData.confirm_password && (
              <span className={`match-indicator ${formData.new_password === formData.confirm_password ? 'match' : 'no-match'}`}>
                {formData.new_password === formData.confirm_password ? (
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
          background: linear-gradient(180deg, #f8fafc 0%, #e2e8f0 100%);
          padding: 20px;
        }

        .change-password-card {
          background: white;
          border-radius: 16px;
          padding: 40px;
          width: 100%;
          max-width: 400px;
          box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08);
        }

        .card-icon {
          width: 56px;
          height: 56px;
          background: #f1f5f9;
          border-radius: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
          font-size: 24px;
          color: #0f172a;
        }

        .change-password-card h1 {
          font-size: 24px;
          font-weight: 600;
          color: #0f172a;
          text-align: center;
          margin: 0 0 8px;
        }

        .forced-message {
          text-align: center;
          color: #64748b;
          font-size: 14px;
          margin-bottom: 24px;
        }

        .error-message {
          background: #fef2f2;
          border: 1px solid #fecaca;
          color: #dc2626;
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
          color: #334155;
          margin-bottom: 8px;
        }

        .password-input {
          position: relative;
        }

        .password-input input {
          width: 100%;
          padding: 12px 44px 12px 14px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
          transition: all 0.15s;
        }

        .password-input input:focus {
          outline: none;
          border-color: #3b82f6;
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
          color: #64748b;
          padding: 4px;
        }

        .toggle-password:hover {
          color: #0f172a;
        }

        .password-hint {
          display: block;
          font-size: 12px;
          color: #94a3b8;
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
          color: #16a34a;
        }

        .match-indicator.no-match {
          color: #dc2626;
        }

        .btn-submit {
          width: 100%;
          padding: 14px 20px;
          background: #0f172a;
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
          background: #1e293b;
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
