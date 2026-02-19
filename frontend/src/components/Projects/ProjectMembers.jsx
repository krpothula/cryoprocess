import React, { useState, useEffect, useRef } from "react";
import {
  FiUsers,
  FiUserPlus,
  FiTrash2,
  FiLoader,
  FiX,
  FiSearch,
  FiShield,
  FiEdit3,
  FiEye,
  FiStar
} from "react-icons/fi";
import {
  getProjectMembersApi,
  addProjectMemberApi,
  updateProjectMemberApi,
  removeProjectMemberApi,
  searchUsersApi
} from "../../services/projects/projects";
import useToast from "../../hooks/useToast";

const ProjectMembers = ({ projectId, projectName, isOwner, onClose }) => {
  const [members, setMembers] = useState([]);
  const [owner, setOwner] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [selectedRole, setSelectedRole] = useState("viewer");
  const [removeConfirm, setRemoveConfirm] = useState(null);
  const [editingMember, setEditingMember] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const searchTimeoutRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    loadMembers();
  }, [projectId]);

  const loadMembers = async () => {
    try {
      setLoading(true);
      const resp = await getProjectMembersApi(projectId);
      setOwner(resp.data.data?.owner || null);
      setMembers(resp.data.data?.members || []);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load members", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  // Debounced user search
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([]);
      return;
    }

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(async () => {
      try {
        setIsSearching(true);
        const resp = await searchUsersApi(searchQuery);
        const existingIds = [owner?.userId, ...members.map(m => m.userId)];
        const filtered = (resp.data.data || []).filter(u => !existingIds.includes(u.id));
        setSearchResults(filtered);
      } catch (error) {
        console.error("Search error:", error);
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current);
      }
    };
  }, [searchQuery, owner, members]);

  const handleAddMember = async () => {
    if (!selectedUser) {
      showToast("Please select a user", { type: "error" });
      return;
    }

    try {
      setIsAdding(true);
      await addProjectMemberApi(projectId, {
        userId: selectedUser.id,
        role: selectedRole
      });
      showToast("Member added successfully", { type: "success" });
      setSelectedUser(null);
      setSearchQuery("");
      setSelectedRole("viewer");
      loadMembers();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to add member", { type: "error" });
    } finally {
      setIsAdding(false);
    }
  };

  const handleUpdateRole = async (userId, newRole) => {
    try {
      await updateProjectMemberApi(projectId, userId, newRole);
      showToast("Role updated successfully", { type: "success" });
      setEditingMember(null);
      loadMembers();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to update role", { type: "error" });
    }
  };

  const handleRemoveMember = async (userId) => {
    try {
      await removeProjectMemberApi(projectId, userId);
      showToast("Member removed successfully", { type: "success" });
      setRemoveConfirm(null);
      loadMembers();
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to remove member", { type: "error" });
    }
  };

  const getRoleIcon = (role) => {
    switch (role) {
      case "owner": return <FiStar size={14} />;
      case "admin": return <FiShield size={14} />;
      case "editor": return <FiEdit3 size={14} />;
      default: return <FiEye size={14} />;
    }
  };

  const getRoleBadgeClass = (role) => {
    switch (role) {
      case "owner": return "owner";
      case "admin": return "admin";
      case "editor": return "editor";
      default: return "viewer";
    }
  };

  if (isLoading) {
    return (
      <div className="members-modal-overlay">
        <div className="members-modal two-column">
          <div className="members-loading">
            <FiLoader className="spinner" />
            <span>Loading...</span>
          </div>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  return (
    <div className="members-modal-overlay">
      <div className="members-modal two-column">
        {/* Close Button */}
        <button className="modal-close-btn" onClick={onClose}>
          <FiX size={20} />
        </button>

        {/* Left Column - Project & Members */}
        <div className="left-column">
          <div className="project-header">
            <FiUsers size={18} />
            <div>
              <h3>{projectName}</h3>
              <span className="member-count">{members.length + 1} members</span>
            </div>
          </div>

          <div className="members-list">
            {/* Owner */}
            {owner && (
              <div className="member-item owner-item">
                <div className="member-info">
                  <div className="member-avatar owner">
                    <FiStar size={14} />
                  </div>
                  <div className="member-details">
                    <span className="member-name">
                      {owner.firstName || owner.lastName
                        ? `${owner.firstName} ${owner.lastName}`.trim()
                        : owner.username}
                    </span>
                    <span className="member-email">{owner.email}</span>
                  </div>
                </div>
                <span className="role-badge owner">Owner</span>
              </div>
            )}

            {/* Members */}
            {members.map((member) => (
              <div key={member.id} className="member-item">
                <div className="member-info">
                  <div className={`member-avatar ${member.role}`}>
                    {getRoleIcon(member.role)}
                  </div>
                  <div className="member-details">
                    <span className="member-name">
                      {member.firstName || member.lastName
                        ? `${member.firstName} ${member.lastName}`.trim()
                        : member.username}
                    </span>
                    <span className="member-email">{member.email}</span>
                  </div>
                </div>
                <div className="member-actions">
                  {editingMember === member.userId ? (
                    <select
                      value={member.role}
                      onChange={(e) => handleUpdateRole(member.userId, e.target.value)}
                      onBlur={() => setEditingMember(null)}
                      autoFocus
                      className="role-select"
                    >
                      <option value="viewer">Viewer</option>
                      <option value="editor">Editor</option>
                    </select>
                  ) : (
                    <span
                      className={`role-badge ${getRoleBadgeClass(member.role)} ${isOwner ? 'clickable' : ''}`}
                      onClick={() => isOwner && setEditingMember(member.userId)}
                      title={isOwner ? "Click to change role" : ""}
                    >
                      {member.role}
                    </span>
                  )}
                  {isOwner && (
                    <button
                      className="btn-remove"
                      onClick={() => setRemoveConfirm(member)}
                      title="Remove member"
                    >
                      <FiTrash2 size={12} />
                    </button>
                  )}
                </div>
              </div>
            ))}

            {members.length === 0 && (
              <div className="no-members">
                <p>No members yet</p>
              </div>
            )}
          </div>
        </div>

        {/* Right Column - Add Member */}
        {isOwner && (
          <div className="right-column">
            <div className="add-header">
              <FiUserPlus size={16} />
              <h4>Add Member</h4>
            </div>

            {/* Search */}
            <div className="search-container">
              <FiSearch className="search-icon" />
              <input
                type="text"
                placeholder="Search by username or email..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
              {isSearching && <FiLoader className="spinner search-spinner" />}
            </div>

            {/* Search Results or Selected User */}
            {selectedUser ? (
              <div className="selected-user">
                <div className="user-info">
                  <div className="user-avatar">
                    <FiUsers size={12} />
                  </div>
                  <div>
                    <span className="user-name">{selectedUser.username}</span>
                    <span className="user-email">{selectedUser.email}</span>
                  </div>
                </div>
                <button className="btn-clear" onClick={() => setSelectedUser(null)}>
                  <FiX size={14} />
                </button>
              </div>
            ) : searchResults.length > 0 ? (
              <div className="search-results">
                {searchResults.slice(0, 4).map((user) => (
                  <div
                    key={user.id}
                    className="search-result-item"
                    onClick={() => {
                      setSelectedUser(user);
                      setSearchQuery("");
                      setSearchResults([]);
                    }}
                  >
                    <div className="user-avatar small">
                      <FiUsers size={10} />
                    </div>
                    <div className="user-details">
                      <span className="user-name">{user.username}</span>
                      <span className="user-email">{user.email}</span>
                    </div>
                  </div>
                ))}
              </div>
            ) : searchQuery.length >= 2 && !isSearching ? (
              <div className="no-results">No users found</div>
            ) : (
              <div className="search-hint">Type to search users</div>
            )}

            {/* Role Selection */}
            <div className="role-selection">
              <span className="role-label">Role</span>
              <div className="role-chips">
                <button
                  className={`role-chip ${selectedRole === 'viewer' ? 'selected' : ''}`}
                  onClick={() => setSelectedRole('viewer')}
                >
                  <FiEye size={12} />
                  Viewer
                </button>
                <button
                  className={`role-chip ${selectedRole === 'editor' ? 'selected' : ''}`}
                  onClick={() => setSelectedRole('editor')}
                >
                  <FiEdit3 size={12} />
                  Editor
                </button>
              </div>
            </div>

            {/* Add Button */}
            <button
              className="btn-add"
              onClick={handleAddMember}
              disabled={!selectedUser || isAdding}
            >
              {isAdding ? <FiLoader className="spinner" /> : <FiUserPlus size={14} />}
              <span>{isAdding ? 'Adding...' : 'Add Member'}</span>
            </button>
          </div>
        )}
      </div>

      {/* Remove Confirm Modal */}
      {removeConfirm && (
        <div className="confirm-overlay">
          <div className="confirm-modal">
            <div className="confirm-icon">
              <FiTrash2 size={24} />
            </div>
            <h3>Remove Member?</h3>
            <p>
              Remove <strong>{removeConfirm.username}</strong> from this project?
            </p>
            <div className="confirm-actions">
              <button className="btn-cancel" onClick={() => setRemoveConfirm(null)}>
                Cancel
              </button>
              <button
                className="btn-danger"
                onClick={() => handleRemoveMember(removeConfirm.userId)}
              >
                Remove
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{styles}</style>
    </div>
  );
};

const styles = `
  .members-modal-overlay {
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

  .members-modal.two-column {
    background: var(--color-bg-card);
    border-radius: 12px;
    width: 100%;
    max-width: 700px;
    display: flex;
    position: relative;
    overflow: hidden;
  }

  .modal-close-btn {
    position: absolute;
    top: 12px;
    right: 12px;
    background: none;
    border: none;
    color: var(--color-text-muted);
    cursor: pointer;
    padding: 4px;
    z-index: 10;
  }

  .modal-close-btn:hover {
    color: var(--color-text-secondary);
  }

  /* Left Column */
  .left-column {
    flex: 1;
    padding: 20px;
    border-right: 1px solid var(--color-border);
    max-height: 400px;
    display: flex;
    flex-direction: column;
  }

  .project-header {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-bottom: 16px;
    color: var(--color-text-heading);
  }

  .project-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 600;
  }

  .member-count {
    font-size: 12px;
    color: var(--color-text-secondary);
  }

  .members-list {
    flex: 1;
    overflow-y: auto;
  }

  .member-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 0;
    border-bottom: 1px solid var(--color-border-light);
  }

  .member-item:last-child {
    border-bottom: none;
  }

  .member-info {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .member-avatar {
    width: 32px;
    height: 32px;
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .member-avatar.owner { background: #fef3c7; color: #d97706; }
  .member-avatar.admin { background: #dbeafe; color: #1d4ed8; }
  .member-avatar.editor { background: #dcfce7; color: #16a34a; }
  .member-avatar.viewer { background: var(--color-bg-hover); color: var(--color-text-secondary); }

  .member-details {
    display: flex;
    flex-direction: column;
  }

  .member-name {
    font-weight: 500;
    color: var(--color-text-heading);
    font-size: 13px;
  }

  .member-email {
    font-size: 11px;
    color: var(--color-text-muted);
  }

  .member-actions {
    display: flex;
    align-items: center;
    gap: 6px;
  }

  .role-badge {
    padding: 3px 8px;
    border-radius: 10px;
    font-size: 11px;
    font-weight: 500;
    text-transform: capitalize;
  }

  .role-badge.clickable { cursor: pointer; }
  .role-badge.clickable:hover { opacity: 0.8; }
  .role-badge.owner { background: #fef3c7; color: #d97706; }
  .role-badge.admin { background: #dbeafe; color: #1d4ed8; }
  .role-badge.editor { background: #dcfce7; color: #16a34a; }
  .role-badge.viewer { background: var(--color-bg-hover); color: var(--color-text-secondary); }

  .role-select {
    padding: 3px 6px;
    border: 1px solid var(--color-border);
    border-radius: 6px;
    font-size: 11px;
    outline: none;
    background: var(--color-bg-card);
    color: var(--color-text);
  }

  .btn-remove {
    padding: 4px;
    background: none;
    border: 1px solid #fecaca;
    border-radius: 4px;
    color: var(--color-danger-text);
    cursor: pointer;
  }

  .btn-remove:hover { background: #fee2e2; }

  .no-members {
    text-align: center;
    padding: 20px;
    color: var(--color-text-muted);
    font-size: 13px;
  }

  /* Right Column */
  .right-column {
    width: 280px;
    padding: 20px;
    background: var(--color-bg);
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .add-header {
    display: flex;
    align-items: center;
    gap: 8px;
    color: var(--color-text-heading);
  }

  .add-header h4 {
    margin: 0;
    font-size: 14px;
    font-weight: 600;
  }

  .search-container {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 0 10px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
  }

  .search-container:focus-within {
    border-color: var(--color-primary);
  }

  .search-icon {
    color: var(--color-text-muted);
    flex-shrink: 0;
    width: 15px;
    height: 15px;
  }

  .search-container input {
    flex: 1;
    border: none !important;
    outline: none !important;
    box-shadow: none !important;
    padding: 10px 0;
    font-size: 13px;
    background: transparent;
    min-width: 0;
    appearance: none;
    color: var(--color-text);
  }

  .search-spinner {
    color: var(--color-text-muted);
    flex-shrink: 0;
    width: 14px;
    height: 14px;
  }

  .search-results {
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
    max-height: 120px;
    overflow-y: auto;
  }

  .search-result-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 8px 10px;
    cursor: pointer;
  }

  .search-result-item:hover { background: var(--color-bg); }

  .user-avatar {
    width: 24px;
    height: 24px;
    border-radius: 50%;
    background: var(--color-bg-hover);
    display: flex;
    align-items: center;
    justify-content: center;
    color: var(--color-text-secondary);
  }

  .user-avatar.small { width: 20px; height: 20px; }

  .user-details {
    display: flex;
    flex-direction: column;
  }

  .user-name {
    font-weight: 500;
    color: var(--color-text-heading);
    font-size: 12px;
  }

  .user-email {
    font-size: 10px;
    color: var(--color-text-muted);
  }

  .no-results, .search-hint {
    padding: 12px;
    text-align: center;
    color: var(--color-text-muted);
    font-size: 12px;
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: 8px;
  }

  .selected-user {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 10px;
    background: var(--color-primary-bg);
    border: 1px solid #bfdbfe;
    border-radius: 8px;
  }

  .selected-user .user-info {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .btn-clear {
    padding: 2px;
    background: none;
    border: none;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .role-selection {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .role-label {
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-label);
  }

  .role-chips {
    display: flex;
    gap: 6px;
  }

  .role-chip {
    flex: 1;
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 4px;
    padding: 8px;
    border: 1px solid var(--color-border);
    border-radius: 8px;
    background: var(--color-bg-card);
    font-size: 12px;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
    transition: all 0.15s;
  }

  .role-chip:hover {
    border-color: var(--color-border-hover);
  }

  .role-chip.selected {
    border-color: var(--color-primary);
    background: var(--color-primary-bg);
    color: #1d4ed8;
  }

  .btn-add {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 10px;
    background: var(--color-primary);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s;
    margin-top: auto;
  }

  .btn-add:hover { background: var(--color-primary-hover); }
  .btn-add:disabled { opacity: 0.5; cursor: not-allowed; }

  .members-loading {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 12px;
    padding: 60px;
    color: var(--color-text-secondary);
    width: 100%;
  }

  .spinner { animation: spin 1s linear infinite; }
  @keyframes spin { to { transform: rotate(360deg); } }

  /* Confirm Modal */
  .confirm-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(0, 0, 0, 0.5);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 1001;
  }

  .confirm-modal {
    background: var(--color-bg-card);
    border-radius: 12px;
    width: 100%;
    max-width: 320px;
    padding: 24px;
    text-align: center;
  }

  .confirm-icon {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: #fee2e2;
    color: var(--color-danger-text);
    display: flex;
    align-items: center;
    justify-content: center;
    margin: 0 auto 12px;
  }

  .confirm-modal h3 {
    margin: 0 0 8px;
    font-size: 16px;
    color: var(--color-text-heading);
  }

  .confirm-modal p {
    color: var(--color-text-label);
    margin: 0 0 16px;
    font-size: 13px;
  }

  .confirm-actions {
    display: flex;
    justify-content: center;
    gap: 10px;
  }

  .btn-cancel {
    padding: 8px 16px;
    background: var(--color-bg-hover);
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    color: var(--color-text-secondary);
    cursor: pointer;
  }

  .btn-danger {
    padding: 8px 16px;
    background: var(--color-danger-text);
    color: white;
    border: none;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 500;
    cursor: pointer;
  }
`;

export default ProjectMembers;
