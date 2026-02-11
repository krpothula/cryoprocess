import React, { useState, useEffect } from "react";
import { FiPlus, FiTrash2, FiKey, FiUser, FiShield, FiLoader, FiCopy, FiCheck, FiX } from "react-icons/fi";
import adminApi from "../../services/adminApi";
import useToast from "../../hooks/useToast";

const AdminUsers = () => {
  const [users, setUsers] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [resetConfirm, setResetConfirm] = useState(null);
  const [roleConfirm, setRoleConfirm] = useState(null);
  const [tempPassword, setTempPassword] = useState(null);
  const [copied, setCopied] = useState(false);
  const showToast = useToast();

  const [newUser, setNewUser] = useState({
    email: "",
    username: "",
    first_name: "",
    last_name: "",
    is_staff: false,
    is_superuser: false
  });

  useEffect(() => {
    loadUsers();
  }, []);

  const loadUsers = async () => {
    try {
      setLoading(true);
      const resp = await adminApi.getUsers();
      setUsers(resp.data.data || []);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load users", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    try {
      const resp = await adminApi.createUser(newUser);
      setTempPassword(resp.data.data?.temporary_password);
      setShowCreateModal(false);
      setNewUser({ email: "", username: "", first_name: "", last_name: "", is_staff: false, is_superuser: false });
      loadUsers();
      showToast("User created successfully", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to create user", { type: "error" });
    }
  };

  const handleResetPassword = async (userId) => {
    try {
      const resp = await adminApi.resetUserPassword(userId);
      setShowPasswordModal(userId);
      setTempPassword(resp.data.data?.temporary_password);
      showToast("Password reset successfully", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to reset password", { type: "error" });
    }
  };

  const handleDeleteUser = async (userId) => {
    try {
      await adminApi.deleteUser(userId);
      setDeleteConfirm(null);
      loadUsers();
      showToast("User deleted successfully", { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to delete user", { type: "error" });
    }
  };

  const handleToggleAdmin = async (user) => {
    try {
      await adminApi.updateUser(user.id, { is_superuser: !user.is_superuser });
      loadUsers();
      showToast(`Admin rights ${user.is_superuser ? 'removed' : 'granted'}`, { type: "success" });
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to update user", { type: "error" });
    }
  };

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (isLoading) {
    return (
      <div className="admin-loading">
        <FiLoader className="spinner" />
        <span>Loading users...</span>
      </div>
    );
  }

  return (
    <div className="admin-users-page">
      <div className="admin-container">
        <header className="admin-header">
          <div className="header-title">
            <h1>User Management</h1>
            <span className="header-subtitle">Manage user accounts and permissions</span>
          </div>
          <button className="btn-create" onClick={() => setShowCreateModal(true)}>
            <FiPlus />
            <span>Add User</span>
          </button>
        </header>

        <div className="users-table-container">
          <table className="users-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="user-info">
                      <div className="user-avatar">
                        {user.is_superuser ? <FiShield /> : <FiUser />}
                      </div>
                      <div>
                        <span className="user-name">
                          {user.first_name || user.last_name
                            ? `${user.first_name} ${user.last_name}`.trim()
                            : user.username}
                        </span>
                        <span className="user-username">@{user.username}</span>
                      </div>
                    </div>
                  </td>
                  <td>{user.email}</td>
                  <td>
                    <span className={`role-badge ${user.is_superuser ? 'admin' : user.is_staff ? 'staff' : 'user'}`}>
                      {user.is_superuser ? 'Admin' : user.is_staff ? 'Staff' : 'User'}
                    </span>
                  </td>
                  <td>
                    <span className={`status-badge ${user.is_active ? 'active' : 'inactive'}`}>
                      {user.is_active ? 'Active' : 'Inactive'}
                    </span>
                    {user.must_change_password && (
                      <span className="password-badge">Must change password</span>
                    )}
                  </td>
                  <td className="last-login">
                    {user.last_login
                      ? new Date(user.last_login).toLocaleDateString()
                      : 'Never'}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button
                        className="action-btn reset"
                        onClick={() => setResetConfirm(user)}
                        title="Reset Password"
                      >
                        <FiKey size={14} />
                        <span>Reset</span>
                      </button>
                      <button
                        className={`action-btn role ${user.is_superuser ? 'is-admin' : ''}`}
                        onClick={() => setRoleConfirm(user)}
                        title={user.is_superuser ? 'Remove Admin' : 'Make Admin'}
                      >
                        <FiShield size={14} />
                        <span>{user.is_superuser ? 'Demote' : 'Promote'}</span>
                      </button>
                      <button
                        className="action-btn delete"
                        onClick={() => setDeleteConfirm(user)}
                        title="Delete User"
                      >
                        <FiTrash2 size={14} />
                        <span>Delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create User Modal */}
      {showCreateModal && (
        <div className="modal-overlay" role="presentation">
          <div className="modal create-user-modal" role="dialog" aria-modal="true" aria-labelledby="create-user-title">
            <div className="modal-header">
              <h3 id="create-user-title">Create New User</h3>
              <button className="modal-close" onClick={() => setShowCreateModal(false)} aria-label="Close dialog">
                <FiX aria-hidden="true" />
              </button>
            </div>
            <form onSubmit={handleCreateUser}>
              <div className="form-grid">
                <div className="form-group">
                  <label>Email *</label>
                  <input
                    type="email"
                    value={newUser.email}
                    onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Username</label>
                  <input
                    type="text"
                    value={newUser.username}
                    onChange={(e) => setNewUser({ ...newUser, username: e.target.value })}
                    placeholder="Auto-generated from email"
                  />
                </div>
                <div className="form-group">
                  <label>First Name</label>
                  <input
                    type="text"
                    value={newUser.first_name}
                    onChange={(e) => setNewUser({ ...newUser, first_name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>Last Name</label>
                  <input
                    type="text"
                    value={newUser.last_name}
                    onChange={(e) => setNewUser({ ...newUser, last_name: e.target.value })}
                  />
                </div>
              </div>
              <div className="form-group role-group">
                <label>Role</label>
                <div className="role-options-horizontal">
                  <label className={`role-chip ${!newUser.is_staff && !newUser.is_superuser ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      checked={!newUser.is_staff && !newUser.is_superuser}
                      onChange={() => setNewUser({ ...newUser, is_staff: false, is_superuser: false })}
                    />
                    <span>User</span>
                  </label>
                  <label className={`role-chip ${newUser.is_staff && !newUser.is_superuser ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      checked={newUser.is_staff && !newUser.is_superuser}
                      onChange={() => setNewUser({ ...newUser, is_staff: true, is_superuser: false })}
                    />
                    <span>Staff</span>
                  </label>
                  <label className={`role-chip ${newUser.is_superuser ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="role"
                      checked={newUser.is_superuser}
                      onChange={() => setNewUser({ ...newUser, is_staff: true, is_superuser: true })}
                    />
                    <span>Admin</span>
                  </label>
                </div>
              </div>
              <div className="modal-actions">
                <button type="button" className="btn-cancel" onClick={() => setShowCreateModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="btn-submit">
                  Create User
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Temp Password Modal */}
      {tempPassword && (
        <div className="modal-overlay" role="presentation">
          <div className="modal password-modal" role="dialog" aria-modal="true" aria-labelledby="temp-password-title">
            <div className="modal-header">
              <h3 id="temp-password-title">Temporary Password</h3>
              <button className="modal-close" onClick={() => { setTempPassword(null); setShowPasswordModal(null); }} aria-label="Close dialog">
                <FiX aria-hidden="true" />
              </button>
            </div>
            <div className="password-display">
              <p>Share this temporary password with the user. They will be required to change it on first login.</p>
              <div className="password-box">
                <code>{tempPassword}</code>
                <button onClick={() => copyToClipboard(tempPassword)} className="btn-copy" aria-label="Copy password to clipboard">
                  {copied ? <FiCheck aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                </button>
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn-submit" onClick={() => { setTempPassword(null); setShowPasswordModal(null); }}>
                Done
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reset Password Confirm Modal */}
      {resetConfirm && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Reset password confirmation">
            <div className="confirm-icon reset-icon" aria-hidden="true">
              <FiKey size={24} />
            </div>
            <h3>Reset Password?</h3>
            <p>Generate a new temporary password for <strong>{resetConfirm.email}</strong>?</p>
            <p className="confirm-note">The user will need to change their password on next login.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setResetConfirm(null)}>Cancel</button>
              <button className="btn-primary" onClick={() => {
                handleResetPassword(resetConfirm.id);
                setResetConfirm(null);
              }}>Reset Password</button>
            </div>
          </div>
        </div>
      )}

      {/* Role Change Confirm Modal */}
      {roleConfirm && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label={roleConfirm.is_superuser ? 'Remove admin rights confirmation' : 'Grant admin rights confirmation'}>
            <div className={`confirm-icon ${roleConfirm.is_superuser ? 'demote-icon' : 'promote-icon'}`} aria-hidden="true">
              <FiShield size={24} />
            </div>
            <h3>{roleConfirm.is_superuser ? 'Remove Admin Rights?' : 'Grant Admin Rights?'}</h3>
            <p>
              {roleConfirm.is_superuser
                ? <>Remove admin privileges from <strong>{roleConfirm.email}</strong>?</>
                : <>Grant admin privileges to <strong>{roleConfirm.email}</strong>?</>
              }
            </p>
            <p className="confirm-note">
              {roleConfirm.is_superuser
                ? 'They will no longer be able to manage users.'
                : 'They will be able to create, edit, and delete users.'
              }
            </p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setRoleConfirm(null)}>Cancel</button>
              <button className={roleConfirm.is_superuser ? 'btn-warning' : 'btn-primary'} onClick={() => {
                handleToggleAdmin(roleConfirm);
                setRoleConfirm(null);
              }}>{roleConfirm.is_superuser ? 'Remove Admin' : 'Make Admin'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirm Modal */}
      {deleteConfirm && (
        <div className="modal-overlay" role="presentation">
          <div className="modal confirm-modal" role="alertdialog" aria-modal="true" aria-label="Delete user confirmation">
            <div className="confirm-icon delete-icon" aria-hidden="true">
              <FiTrash2 size={24} />
            </div>
            <h3>Delete User?</h3>
            <p>Are you sure you want to delete <strong>{deleteConfirm.email}</strong>?</p>
            <p className="confirm-note warning">This action cannot be undone. The user will lose access immediately.</p>
            <div className="modal-actions">
              <button className="btn-cancel" onClick={() => setDeleteConfirm(null)}>Cancel</button>
              <button className="btn-danger" onClick={() => handleDeleteUser(deleteConfirm.id)}>Delete User</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .admin-users-page {
          min-height: calc(100vh - 48px);
          background: #ffffff;
        }

        .admin-container {
          padding: 24px 32px;
        }

        .admin-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 24px;
        }

        .header-title h1 {
          font-size: 24px;
          font-weight: 600;
          color: #0f172a;
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          font-size: 14px;
          color: #64748b;
        }

        .btn-create {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-create:hover {
          background: #2563eb;
        }

        .users-table-container {
          background: white;
          border-radius: 12px;
          border: 1px solid #e2e8f0;
          overflow: hidden;
        }

        .users-table {
          width: 100%;
          border-collapse: collapse;
        }

        .users-table th {
          padding: 14px 20px;
          text-align: left;
          font-size: 12px;
          font-weight: 600;
          color: #64748b;
          text-transform: uppercase;
          background: #f8fafc;
          border-bottom: 1px solid #e2e8f0;
        }

        .users-table td {
          padding: 16px 20px;
          border-bottom: 1px solid #f1f5f9;
        }

        .users-table tr:last-child td {
          border-bottom: none;
        }

        .user-info {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .user-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: #f1f5f9;
          display: flex;
          align-items: center;
          justify-content: center;
          color: #64748b;
        }

        .user-name {
          display: block;
          font-weight: 500;
          color: #0f172a;
        }

        .user-username {
          display: block;
          font-size: 12px;
          color: #94a3b8;
        }

        .role-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .role-badge.admin {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .role-badge.staff {
          background: #fef3c7;
          color: #d97706;
        }

        .role-badge.user {
          background: #f1f5f9;
          color: #64748b;
        }

        .status-badge {
          padding: 4px 10px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 500;
        }

        .status-badge.active {
          background: #dcfce7;
          color: #16a34a;
        }

        .status-badge.inactive {
          background: #fee2e2;
          color: #dc2626;
        }

        .password-badge {
          display: inline-block;
          margin-left: 8px;
          padding: 2px 8px;
          background: #fef3c7;
          color: #d97706;
          border-radius: 8px;
          font-size: 11px;
        }

        .last-login {
          color: #64748b;
          font-size: 13px;
        }

        .action-buttons {
          display: flex;
          gap: 8px;
        }

        .action-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 10px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 6px;
          cursor: pointer;
          font-size: 12px;
          font-weight: 500;
          transition: all 0.15s;
        }

        .action-btn span {
          display: inline;
        }

        .action-btn.reset {
          color: #0369a1;
          border-color: #bae6fd;
          background: #f0f9ff;
        }

        .action-btn.reset:hover {
          background: #e0f2fe;
          border-color: #7dd3fc;
        }

        .action-btn.role {
          color: #7c3aed;
          border-color: #ddd6fe;
          background: #f5f3ff;
        }

        .action-btn.role:hover {
          background: #ede9fe;
          border-color: #c4b5fd;
        }

        .action-btn.role.is-admin {
          color: #ea580c;
          border-color: #fed7aa;
          background: #fff7ed;
        }

        .action-btn.role.is-admin:hover {
          background: #ffedd5;
          border-color: #fdba74;
        }

        .action-btn.delete {
          color: #dc2626;
          border-color: #fecaca;
          background: #fef2f2;
        }

        .action-btn.delete:hover {
          background: #fee2e2;
          border-color: #fca5a5;
        }

        .admin-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 400px;
          color: #64748b;
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal {
          background: white;
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          padding: 24px;
        }

        .create-user-modal {
          max-width: 520px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 12px 16px;
        }

        .role-group {
          margin-top: 4px;
        }

        .role-options-horizontal {
          display: flex;
          gap: 10px;
        }

        .role-chip {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          border: 1px solid #e2e8f0;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.15s;
          font-size: 13px;
          font-weight: 500;
          color: #64748b;
        }

        .role-chip input[type="radio"] {
          display: none;
        }

        .role-chip:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .role-chip.selected {
          background: #eff6ff;
          border-color: #3b82f6;
          color: #1d4ed8;
        }

        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 20px;
        }

        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          color: #0f172a;
        }

        .modal-close {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 4px;
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group label {
          display: block;
          font-size: 14px;
          font-weight: 500;
          color: #334155;
          margin-bottom: 6px;
        }

        .form-group input[type="text"],
        .form-group input[type="email"] {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          font-size: 14px;
          box-sizing: border-box;
        }

        .form-group input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .role-options {
          display: flex;
          flex-direction: column;
          gap: 8px;
        }

        .role-option {
          display: flex;
          align-items: flex-start;
          gap: 10px;
          padding: 12px;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s;
        }

        .role-option:hover {
          background: #f8fafc;
        }

        .role-option input[type="radio"] {
          margin-top: 2px;
        }

        .role-option input[type="radio"]:checked + .role-label strong {
          color: #3b82f6;
        }

        .role-label {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }

        .role-label strong {
          font-size: 14px;
          color: #0f172a;
        }

        .role-label small {
          font-size: 12px;
          color: #64748b;
        }

        .modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        .btn-cancel {
          padding: 10px 20px;
          background: #f1f5f9;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
        }

        .btn-submit {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-submit:hover {
          background: #2563eb;
        }

        .btn-danger {
          padding: 10px 20px;
          background: #dc2626;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .password-display p {
          color: #64748b;
          font-size: 14px;
          margin-bottom: 16px;
        }

        .password-box {
          display: flex;
          align-items: center;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 12px 16px;
        }

        .password-box code {
          flex: 1;
          font-size: 16px;
          font-family: monospace;
          color: #0f172a;
        }

        .btn-copy {
          background: none;
          border: none;
          cursor: pointer;
          color: #64748b;
          padding: 4px;
        }

        .btn-copy:hover {
          color: #0f172a;
        }

        .confirm-modal {
          text-align: center;
          max-width: 400px;
        }

        .confirm-icon {
          width: 56px;
          height: 56px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 16px;
        }

        .confirm-icon.reset-icon {
          background: #e0f2fe;
          color: #0369a1;
        }

        .confirm-icon.promote-icon {
          background: #ede9fe;
          color: #7c3aed;
        }

        .confirm-icon.demote-icon {
          background: #ffedd5;
          color: #ea580c;
        }

        .confirm-icon.delete-icon {
          background: #fee2e2;
          color: #dc2626;
        }

        .confirm-modal h3 {
          margin: 0 0 12px;
          font-size: 18px;
          color: #0f172a;
        }

        .confirm-modal p {
          color: #475569;
          margin: 0 0 8px;
          font-size: 14px;
        }

        .confirm-modal p strong {
          color: #0f172a;
        }

        .confirm-note {
          font-size: 13px !important;
          color: #64748b !important;
          margin-bottom: 20px !important;
        }

        .confirm-note.warning {
          color: #dc2626 !important;
        }

        .confirm-modal .modal-actions {
          justify-content: center;
          margin-top: 20px;
        }

        .btn-primary {
          padding: 10px 20px;
          background: #3b82f6;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-primary:hover {
          background: #2563eb;
        }

        .btn-warning {
          padding: 10px 20px;
          background: #f97316;
          color: white;
          border: none;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
        }

        .btn-warning:hover {
          background: #ea580c;
        }
      `}</style>
    </div>
  );
};

export default AdminUsers;
