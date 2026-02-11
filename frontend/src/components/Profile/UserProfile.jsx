import React, { useState, useEffect } from "react";
import { FiUser, FiSave, FiLoader, FiLock, FiEye, FiEyeOff } from "react-icons/fi";
import { getCurrentUser, updateProfileApi, changePasswordApi } from "../../services/auth/auth";
import useToast from "../../hooks/useToast";

const UserProfile = () => {
  const [profile, setProfile] = useState({
    first_name: "",
    last_name: "",
    email: "",
    username: ""
  });
  const [originalProfile, setOriginalProfile] = useState({});
  const [isLoading, setLoading] = useState(true);
  const [isSaving, setSaving] = useState(false);
  const [isChangingPassword, setChangingPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordData, setPasswordData] = useState({
    current_password: "",
    new_password: "",
    confirm_password: ""
  });
  const showToast = useToast();

  useEffect(() => {
    loadProfile();
  }, []);

  const loadProfile = async () => {
    try {
      setLoading(true);
      const resp = await getCurrentUser();
      const userData = resp.data.data || resp.data;
      setProfile({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        email: userData.email || "",
        username: userData.username || ""
      });
      setOriginalProfile({
        first_name: userData.first_name || "",
        last_name: userData.last_name || "",
        email: userData.email || ""
      });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load profile", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    const hasChanges =
      profile.first_name !== originalProfile.first_name ||
      profile.last_name !== originalProfile.last_name ||
      profile.email !== originalProfile.email;

    if (!hasChanges) {
      showToast("No changes to save", { type: "info" });
      return;
    }

    try {
      setSaving(true);
      await updateProfileApi({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email
      });

      const userInfo = JSON.parse(localStorage.getItem("userInfo") || "{}");
      userInfo.first_name = profile.first_name;
      userInfo.last_name = profile.last_name;
      userInfo.email = profile.email;
      localStorage.setItem("userInfo", JSON.stringify(userInfo));

      setOriginalProfile({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email
      });

      showToast("Profile updated successfully", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to update profile", { type: "error" });
    } finally {
      setSaving(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    if (passwordData.new_password !== passwordData.confirm_password) {
      showToast("New passwords do not match", { type: "error" });
      return;
    }
    if (passwordData.new_password.length < 8) {
      showToast("Password must be at least 8 characters", { type: "error" });
      return;
    }

    try {
      setChangingPassword(true);
      await changePasswordApi({
        current_password: passwordData.current_password,
        new_password: passwordData.new_password
      });
      showToast("Password changed successfully", { type: "success" });
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to change password", { type: "error" });
    } finally {
      setChangingPassword(false);
    }
  };

  if (isLoading) {
    return (
      <div className="profile-loading" aria-live="polite">
        <FiLoader className="spinner" aria-hidden="true" />
        <span>Loading...</span>
        <style>{`
          .profile-loading {
            display: flex;
            align-items: center;
            justify-content: center;
            gap: 10px;
            height: calc(100vh - 48px);
            color: #64748b;
          }
          .spinner { animation: spin 1s linear infinite; }
          @keyframes spin { to { transform: rotate(360deg); } }
        `}</style>
      </div>
    );
  }

  return (
    <div className="profile-page">
      <div className="profile-container">
        <div className="profile-header">
          <div className="user-info">
            <div className="avatar"><FiUser size={24} /></div>
            <div>
              <h1>@{profile.username}</h1>
              <span>Manage your account</span>
            </div>
          </div>
        </div>

        <div className="profile-grid">
          {/* Profile Section */}
          <div className="section-card">
            <div className="section-title">
              <FiUser size={16} />
              <span>Profile Info</span>
            </div>
            <form onSubmit={handleSave}>
              <div className="form-row">
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={profile.first_name}
                    onChange={(e) => setProfile({ ...profile, first_name: e.target.value })}
                    placeholder="First name"
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={profile.last_name}
                    onChange={(e) => setProfile({ ...profile, last_name: e.target.value })}
                    placeholder="Last name"
                  />
                </div>
              </div>
              <div className="form-group">
                <label>Email</label>
                <input
                  type="email"
                  value={profile.email}
                  onChange={(e) => setProfile({ ...profile, email: e.target.value })}
                  placeholder="Email"
                  required
                />
              </div>
              <button type="submit" className="btn-primary" disabled={isSaving}>
                {isSaving ? <><FiLoader className="spinner" size={14} /> Saving...</> : <><FiSave size={14} /> Save</>}
              </button>
            </form>
          </div>

          {/* Password Section */}
          <div className="section-card">
            <div className="section-title">
              <FiLock size={16} />
              <span>Change Password</span>
            </div>
            <form onSubmit={handleChangePassword}>
              <div className="form-group">
                <label>Current Password</label>
                <div className="pwd-wrap">
                  <input
                    type={showCurrentPassword ? "text" : "password"}
                    value={passwordData.current_password}
                    onChange={(e) => setPasswordData({ ...passwordData, current_password: e.target.value })}
                    placeholder="Current password"
                    required
                  />
                  <button type="button" className="pwd-toggle" onClick={() => setShowCurrentPassword(!showCurrentPassword)} aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}>
                    {showCurrentPassword ? <FiEyeOff size={14} aria-hidden="true" /> : <FiEye size={14} aria-hidden="true" />}
                  </button>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group">
                  <label>New Password</label>
                  <div className="pwd-wrap">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={passwordData.new_password}
                      onChange={(e) => setPasswordData({ ...passwordData, new_password: e.target.value })}
                      placeholder="Min 8 chars"
                      required
                      minLength={8}
                    />
                    <button type="button" className="pwd-toggle" onClick={() => setShowNewPassword(!showNewPassword)} aria-label={showNewPassword ? "Hide new password" : "Show new password"}>
                      {showNewPassword ? <FiEyeOff size={14} aria-hidden="true" /> : <FiEye size={14} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
                <div className="form-group">
                  <label>Confirm</label>
                  <div className="pwd-wrap">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={passwordData.confirm_password}
                      onChange={(e) => setPasswordData({ ...passwordData, confirm_password: e.target.value })}
                      placeholder="Confirm"
                      required
                    />
                    <button type="button" className="pwd-toggle" onClick={() => setShowConfirmPassword(!showConfirmPassword)} aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}>
                      {showConfirmPassword ? <FiEyeOff size={14} aria-hidden="true" /> : <FiEye size={14} aria-hidden="true" />}
                    </button>
                  </div>
                </div>
              </div>
              <button type="submit" className="btn-primary" disabled={isChangingPassword}>
                {isChangingPassword ? <><FiLoader className="spinner" size={14} /> Changing...</> : <><FiLock size={14} /> Change</>}
              </button>
            </form>
          </div>
        </div>
      </div>

      <style>{`
        .profile-page {
          height: calc(100vh - 48px);
          background: #ffffff;
          display: flex;
          align-items: flex-start;
          padding-top: 24px;
        }
        .profile-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 24px;
        }
        .profile-header {
          margin-bottom: 20px;
        }
        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .avatar {
          width: 48px;
          height: 48px;
          border-radius: 50%;
          background: linear-gradient(135deg, #e0f2fe, #dbeafe);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #0369a1;
        }
        .user-info h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #0f172a;
        }
        .user-info span {
          font-size: 13px;
          color: #64748b;
        }
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .section-card {
          background: white;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
          padding: 20px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid #f1f5f9;
        }
        .form-group {
          margin-bottom: 12px;
        }
        .form-group label {
          display: block;
          font-size: 12px;
          font-weight: 500;
          color: #64748b;
          margin-bottom: 4px;
        }
        .form-group input {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 13px;
          box-sizing: border-box;
        }
        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 2px rgba(59,130,246,0.1);
        }
        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 10px;
        }
        .pwd-wrap {
          position: relative;
        }
        .pwd-wrap input {
          padding-right: 32px;
        }
        .pwd-toggle {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          background: none;
          border: none;
          color: #94a3b8;
          cursor: pointer;
          padding: 2px;
        }
        .pwd-toggle:hover {
          color: #64748b;
        }
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 10px;
          background: #0f172a;
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 8px;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1e293b;
        }
        .btn-primary:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .spinner {
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @media (max-width: 700px) {
          .profile-grid {
            grid-template-columns: 1fr;
          }
        }
      `}</style>
    </div>
  );
};

export default UserProfile;
