import React, { useState, useEffect } from "react";
import { FiUser, FiSave, FiLoader, FiLock, FiEye, FiEyeOff, FiServer, FiWifi, FiWifiOff, FiTrash2, FiBell } from "react-icons/fi";
import { getCurrentUser, updateProfileApi, changePasswordApi, updateClusterSettingsApi, testClusterConnectionApi } from "../../services/auth/auth";
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

  // Notification preferences
  const [notifyEmail, setNotifyEmail] = useState(true);

  // Cluster settings state
  const [clusterUsername, setClusterUsername] = useState("");
  const [clusterSshKey, setClusterSshKey] = useState("");
  const [clusterStatus, setClusterStatus] = useState({ connected: false, enabled: false, ssh_key_set: false });
  const [isSavingCluster, setSavingCluster] = useState(false);
  const [isTesting, setTesting] = useState(false);
  const [isToggling, setToggling] = useState(false);
  const [testMessage, setTestMessage] = useState("");

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
      // Notification preferences
      setNotifyEmail(userData.notify_email_default !== false);
      // Cluster settings
      setClusterUsername(userData.cluster_username || "");
      setClusterStatus({
        connected: userData.cluster_connected || false,
        enabled: userData.cluster_enabled || false,
        ssh_key_set: userData.cluster_ssh_key_set || false
      });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load profile", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      await updateProfileApi({
        first_name: profile.first_name,
        last_name: profile.last_name,
        email: profile.email,
        notify_email_default: notifyEmail
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
        new_password: passwordData.new_password,
        confirm_password: passwordData.confirm_password
      });
      showToast("Password changed successfully", { type: "success" });
      setPasswordData({ current_password: "", new_password: "", confirm_password: "" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to change password", { type: "error" });
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSaveCluster = async (e) => {
    e.preventDefault();
    if (!clusterUsername.trim()) {
      showToast("Cluster username is required", { type: "error" });
      return;
    }

    try {
      setSavingCluster(true);
      setTestMessage("");
      const payload = { cluster_username: clusterUsername };
      // Only send SSH key if user pasted a new one
      if (clusterSshKey) {
        payload.cluster_ssh_key = clusterSshKey;
      }
      const resp = await updateClusterSettingsApi(payload);
      const data = resp.data.data || resp.data;
      setClusterStatus({
        connected: data.cluster_connected || false,
        enabled: data.cluster_enabled ?? clusterStatus.enabled,
        ssh_key_set: data.cluster_ssh_key_set || false
      });
      setClusterSshKey(""); // Clear the textarea after save
      showToast("Cluster settings saved", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to save cluster settings", { type: "error" });
    } finally {
      setSavingCluster(false);
    }
  };

  const handleTestConnection = async () => {
    try {
      setTesting(true);
      setTestMessage("");
      const resp = await testClusterConnectionApi();
      const data = resp.data.data || resp.data;
      setClusterStatus((prev) => ({ ...prev, connected: data.connected }));
      setTestMessage(data.message || (data.connected ? "Connected" : "Connection failed"));
      if (data.connected) {
        showToast("Cluster connection successful", { type: "success" });
      } else {
        showToast(data.message || "Connection failed", { type: "error" });
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Connection test failed";
      setTestMessage(msg);
      setClusterStatus((prev) => ({ ...prev, connected: false }));
      showToast(msg, { type: "error" });
    } finally {
      setTesting(false);
    }
  };

  const handleClearKey = async () => {
    try {
      setSavingCluster(true);
      await updateClusterSettingsApi({ cluster_ssh_key: "" });
      setClusterStatus((prev) => ({ ...prev, connected: false, enabled: false, ssh_key_set: false }));
      setClusterSshKey("");
      setTestMessage("");
      showToast("SSH key removed", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to remove SSH key", { type: "error" });
    } finally {
      setSavingCluster(false);
    }
  };

  const handleToggleEnabled = async () => {
    const newEnabled = !clusterStatus.enabled;
    try {
      setToggling(true);
      const resp = await updateClusterSettingsApi({ cluster_enabled: newEnabled });
      const data = resp.data.data || resp.data;
      setClusterStatus({
        connected: data.cluster_connected ?? clusterStatus.connected,
        enabled: data.cluster_enabled ?? newEnabled,
        ssh_key_set: data.cluster_ssh_key_set ?? clusterStatus.ssh_key_set
      });
      showToast(
        newEnabled ? "Cluster account enabled — jobs will use your credentials" : "Cluster account disabled — jobs will use default service account",
        { type: "success" }
      );
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to update cluster status", { type: "error" });
    } finally {
      setToggling(false);
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
            color: var(--color-text-secondary);
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
              <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <input
                  type="checkbox"
                  id="notify-email"
                  checked={notifyEmail}
                  onChange={(e) => setNotifyEmail(e.target.checked)}
                  style={{ width: "auto", margin: 0 }}
                />
                <label htmlFor="notify-email" style={{ marginBottom: 0, cursor: "pointer" }}>
                  <FiBell size={12} style={{ marginRight: 4 }} />
                  Email me when jobs complete or fail
                </label>
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

        {/* Cluster Settings Section — full width */}
        <div className="section-card" style={{ marginTop: 20 }}>
          <div className="section-title">
            <FiServer size={16} />
            <span>Cluster Settings</span>
            <div className={`cluster-status-badge ${clusterStatus.enabled ? "badge-enabled" : clusterStatus.connected ? "badge-tested" : ""}`}>
              {clusterStatus.enabled
                ? <><FiWifi size={12} /> <span>Enabled</span></>
                : clusterStatus.connected
                  ? <><FiWifi size={12} /> <span>Tested</span></>
                  : <><FiWifiOff size={12} /> <span>Not connected</span></>
              }
            </div>
          </div>
          <p style={{ fontSize: 12, color: "var(--color-text-muted)", margin: "0 0 14px" }}>
            Enter your SLURM cluster credentials. Jobs will be submitted under your cluster account.
          </p>
          <form onSubmit={handleSaveCluster}>
            <div className="form-row">
              <div className="form-group">
                <label>Cluster Username</label>
                <input
                  type="text"
                  value={clusterUsername}
                  onChange={(e) => setClusterUsername(e.target.value)}
                  placeholder="e.g. karunakar"
                />
              </div>
              <div className="form-group">
                <label>
                  SSH Private Key
                  {clusterStatus.ssh_key_set && (
                    <button
                      type="button"
                      onClick={handleClearKey}
                      className="clear-key-btn"
                      title="Remove stored SSH key"
                    >
                      <FiTrash2 size={11} /> Clear
                    </button>
                  )}
                </label>
                <textarea
                  value={clusterSshKey}
                  onChange={(e) => setClusterSshKey(e.target.value)}
                  placeholder={clusterStatus.ssh_key_set
                    ? "SSH key is saved. Paste a new key to replace it."
                    : "Paste your SSH private key here (-----BEGIN OPENSSH PRIVATE KEY-----...)"
                  }
                  rows={4}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    border: "1px solid var(--color-border)",
                    borderRadius: 6,
                    fontSize: 12,
                    fontFamily: "monospace",
                    resize: "vertical",
                    boxSizing: "border-box",
                    background: "var(--color-bg)",
                    color: "var(--color-text)",
                  }}
                />
              </div>
            </div>
            <div className="cluster-actions">
              <button type="submit" className="btn-primary" style={{ width: "auto", padding: "10px 20px" }} disabled={isSavingCluster}>
                {isSavingCluster ? <><FiLoader className="spinner" size={14} /> Saving...</> : <><FiSave size={14} /> Save</>}
              </button>
              <button
                type="button"
                className="btn-test"
                onClick={handleTestConnection}
                disabled={isTesting || !clusterStatus.ssh_key_set}
                title={!clusterStatus.ssh_key_set ? "Save your SSH key first" : "Test SSH connection to cluster"}
              >
                {isTesting ? <><FiLoader className="spinner" size={14} /> Testing...</> : <><FiWifi size={14} /> Test Connection</>}
              </button>
              <button
                type="button"
                className={`btn-toggle ${clusterStatus.enabled ? "btn-disconnect" : "btn-connect"}`}
                onClick={handleToggleEnabled}
                disabled={isToggling || (!clusterStatus.enabled && !clusterStatus.connected)}
                title={
                  !clusterStatus.connected && !clusterStatus.enabled
                    ? "Test your connection first before enabling"
                    : clusterStatus.enabled
                      ? "Disable your cluster account — jobs will use default service account"
                      : "Enable your cluster account — jobs will use your credentials"
                }
              >
                {isToggling
                  ? <><FiLoader className="spinner" size={14} /> {clusterStatus.enabled ? "Disabling..." : "Enabling..."}</>
                  : clusterStatus.enabled
                    ? <><FiWifiOff size={14} /> Disconnect</>
                    : <><FiWifi size={14} /> Connect</>
                }
              </button>
              {testMessage && (
                <span className={`test-result ${clusterStatus.connected ? "success" : "error"}`}>
                  {testMessage}
                </span>
              )}
            </div>
          </form>
        </div>
      </div>

      <style>{`
        .profile-page {
          min-height: calc(100vh - 48px);
          background: var(--color-bg);
          display: flex;
          align-items: flex-start;
          padding-top: 24px;
        }
        .profile-container {
          width: 100%;
          max-width: 800px;
          margin: 0 auto;
          padding: 0 24px 40px;
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
          color: var(--color-primary);
        }
        .user-info h1 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-heading);
        }
        .user-info span {
          font-size: 13px;
          color: var(--color-text-secondary);
        }
        .profile-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }
        .section-card {
          background: var(--color-bg-card);
          border-radius: 10px;
          border: 1px solid var(--color-border);
          padding: 20px;
        }
        .section-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 14px;
          font-weight: 600;
          color: var(--color-text);
          margin-bottom: 16px;
          padding-bottom: 12px;
          border-bottom: 1px solid var(--color-border-light);
        }
        .form-group {
          margin-bottom: 12px;
        }
        .form-group label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
          margin-bottom: 4px;
        }
        .form-group input, .form-group textarea {
          width: 100%;
          padding: 8px 10px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 13px;
          box-sizing: border-box;
          background: var(--color-bg);
          color: var(--color-text);
        }
        .form-group input:focus, .form-group textarea:focus {
          outline: none;
          border-color: var(--color-primary);
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
          color: var(--color-text-muted);
          cursor: pointer;
          padding: 2px;
        }
        .pwd-toggle:hover {
          color: var(--color-text-secondary);
        }
        .btn-primary {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          width: 100%;
          padding: 10px;
          background: var(--color-text-heading);
          color: white;
          border: none;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          margin-top: 8px;
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--color-text);
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

        /* Cluster Settings */
        .cluster-status-badge {
          display: flex;
          align-items: center;
          gap: 4px;
          margin-left: auto;
          font-size: 11px;
          font-weight: 500;
          padding: 3px 8px;
          border-radius: 12px;
          background: rgba(156,163,175,0.15);
          color: var(--color-text-muted);
        }
        .cluster-status-badge.badge-tested {
          background: rgba(59,130,246,0.1);
          color: #2563eb;
        }
        .cluster-status-badge.badge-enabled {
          background: rgba(34,197,94,0.1);
          color: #16a34a;
        }
        .clear-key-btn {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          background: none;
          border: none;
          color: var(--color-text-muted);
          font-size: 11px;
          cursor: pointer;
          padding: 0;
          margin-left: auto;
        }
        .clear-key-btn:hover {
          color: #dc2626;
        }
        .cluster-actions {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-top: 8px;
          flex-wrap: wrap;
        }
        .btn-test {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          background: transparent;
          color: var(--color-primary);
          border: 1px solid var(--color-primary);
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
        }
        .btn-test:hover:not(:disabled) {
          background: rgba(59,130,246,0.06);
        }
        .btn-test:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-toggle {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 13px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }
        .btn-toggle:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }
        .btn-connect {
          background: #16a34a;
          color: white;
        }
        .btn-connect:hover:not(:disabled) {
          background: #15803d;
        }
        .btn-disconnect {
          background: transparent;
          color: #dc2626;
          border: 1px solid #dc2626;
        }
        .btn-disconnect:hover:not(:disabled) {
          background: rgba(220,38,38,0.06);
        }
        .test-result {
          font-size: 12px;
          font-weight: 500;
        }
        .test-result.success { color: #16a34a; }
        .test-result.error { color: #dc2626; }

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
