import { useEffect, useState, useRef } from "react";
import { getProjectListApi, deleteProjectApi, archiveProjectApi, restoreProjectApi } from "../../services/projects/projects";
import { formatDateString } from "../../utils/datetime";
import { FiArrowUpRight, FiLoader, FiInbox, FiMoreVertical, FiTrash2, FiUser, FiUsers, FiZap, FiArchive, FiRefreshCw, FiLink } from "react-icons/fi";
import useToast from "../../hooks/useToast";
import Pagination from "../Tabs/common/Pagination";
import { Link } from "react-router-dom";
import ProjectMembers from "./ProjectMembers";
import ProjectWebhooks from "./ProjectWebhooks";

const PAGE_SIZE = 10;

const EmptyState = ({ hasSearch }) => (
  <div className="empty-state">
    <div className="empty-icon">
      <FiInbox />
    </div>
    <h3>{hasSearch ? "No results found" : "No projects yet"}</h3>
    <p>
      {hasSearch
        ? "Try a different search term"
        : "Create your first project to get started"}
    </p>
  </div>
);

const LoadingState = () => (
  <div className="loading-state">
    <FiLoader className="spinner" />
    <span>Loading projects...</span>
  </div>
);

const ProjectsList = ({ searchTerm = "", showArchived = false }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [archiveConfirm, setArchiveConfirm] = useState(null);
  const [sharingProject, setSharingProject] = useState(null);
  const [webhookProject, setWebhookProject] = useState(null);
  const dropdownRef = useRef(null);
  const showToast = useToast();
  const totalPages = Math.ceil(totalRecords / PAGE_SIZE) || 0;

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setOpenDropdown(null);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleDelete = async (project) => {
    if (deleteConfirm !== project.id) {
      setDeleteConfirm(project.id);
      setOpenDropdown(null);
      return;
    }

    try {
      await deleteProjectApi(project.id, true);
      setProjects(projects.filter(p => p.id !== project.id));
      showToast(`Project "${project.project_name}" deleted successfully`, { type: "success" });
      setDeleteConfirm(null);
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to delete project", { type: "error" });
    }
  };

  const handleShare = (project) => {
    setOpenDropdown(null);
    setSharingProject(project);
  };

  const handleArchive = async (project) => {
    if (archiveConfirm !== project.id) {
      setArchiveConfirm(project.id);
      setOpenDropdown(null);
      return;
    }

    try {
      await archiveProjectApi(project.id);
      showToast(`Project "${project.project_name}" is being archived`, { type: "success" });
      setArchiveConfirm(null);
      // Refresh list
      setLoading(true);
      getProjectListApi({ limit, skip, include_archived: showArchived ? 'true' : 'false' })
        .then((resp) => {
          setProjects(resp?.data?.data || []);
          setTotalRecords(resp?.data?.count || 0);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to archive project", { type: "error" });
    }
  };

  const handleRestore = async (project) => {
    try {
      await restoreProjectApi(project.id);
      showToast(`Project "${project.project_name}" is being restored`, { type: "success" });
      setOpenDropdown(null);
      // Refresh list
      setLoading(true);
      getProjectListApi({ limit, skip, include_archived: showArchived ? 'true' : 'false' })
        .then((resp) => {
          setProjects(resp?.data?.data || []);
          setTotalRecords(resp?.data?.count || 0);
        })
        .finally(() => setLoading(false));
    } catch (error) {
      showToast(error.response?.data?.error || "Failed to restore project", { type: "error" });
    }
  };

  const limit = PAGE_SIZE;
  const skip = (currentPage - 1) * PAGE_SIZE;

  const filteredProjects = projects.filter(project =>
    project.project_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    project.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handlePage = (page) => {
    setCurrentPage(page + 1);
  };

  useEffect(() => {
    setLoading(true);
    getProjectListApi({ limit, skip, include_archived: showArchived ? 'true' : 'false' })
      .then((resp) => {
        setProjects(resp?.data?.data || []);
        setTotalRecords(resp?.data?.count || 0);
      })
      .catch(() => {
        setProjects([]);
        showToast(
          "Something went wrong while fetching the projects, please try again.",
          { type: "error" }
        );
      })
      .finally(() => {
        setLoading(false);
      });
  }, [currentPage, showArchived]);

  if (isLoading) {
    return <LoadingState />;
  }

  if (filteredProjects.length === 0) {
    return <EmptyState hasSearch={searchTerm.length > 0} />;
  }

  return (
    <div className="list-container">
      <table className="data-table">
        <thead>
          <tr>
            <th className="col-name">Project Name</th>
            <th className="col-type">Type</th>
            <th className="col-desc">Description</th>
            <th className="col-user">Created By</th>
            <th className="col-date">Created</th>
            <th className="col-action">Actions</th>
          </tr>
        </thead>
        <tbody>
          {filteredProjects.map((project, index) => (
            <tr key={project.id} style={{ animationDelay: `${index * 0.03}s`, position: openDropdown === project.id ? 'relative' : undefined, zIndex: openDropdown === project.id ? 10 : undefined }}>
              <td className="col-name">
                <span className="project-name">{project.project_name}</span>
              </td>
              <td className="col-type">
                <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {project.live_session_id ? (
                    <span className="type-badge type-live">
                      <FiZap size={11} />
                      Live
                      {project.live_session_status && (
                        <span className={`live-status-dot live-status-${project.live_session_status}`} />
                      )}
                    </span>
                  ) : (
                    <span className="type-badge type-regular">Pipeline</span>
                  )}
                  {project.is_archived && (
                    <span className="type-badge type-archived">
                      <FiArchive size={10} />
                      Archived
                    </span>
                  )}
                </div>
              </td>
              <td className="col-desc">
                <span className="project-desc">
                  {project.description || "No description"}
                </span>
              </td>
              <td className="col-user">
                <div className="user-badge">
                  <FiUser className="user-icon" />
                  <span className="user-name">{project.created_name || "Unknown"}</span>
                </div>
              </td>
              <td className="col-date">
                <span className="project-date">
                  {formatDateString(project.creation_date)}
                </span>
              </td>
              <td className="col-action">
                <div className="action-buttons">
                  <Link
                    to={project.live_session_id
                      ? `/live/${project.live_session_id}`
                      : `/project/${project.id}`}
                    className={`open-btn ${project.live_session_id ? "open-btn-live" : ""}`}
                  >
                    Open
                    <FiArrowUpRight />
                  </Link>
                  <div className="dropdown-container" ref={openDropdown === project.id ? dropdownRef : null}>
                    <button
                      className={`more-btn ${!project.is_owner ? 'more-btn-disabled' : ''}`}
                      onClick={() => project.is_owner && setOpenDropdown(openDropdown === project.id ? null : project.id)}
                      disabled={!project.is_owner}
                    >
                      <FiMoreVertical />
                      <span>Advanced Options</span>
                    </button>
                    {project.is_owner && openDropdown === project.id && (
                      <div className="dropdown-menu" style={{ bottom: index >= filteredProjects.length - 2 ? '100%' : 'auto', top: index >= filteredProjects.length - 2 ? 'auto' : '100%', marginBottom: index >= filteredProjects.length - 2 ? '4px' : '0', marginTop: index >= filteredProjects.length - 2 ? '0' : '4px' }}>
                        <button
                          className="dropdown-item"
                          onClick={() => handleShare(project)}
                        >
                          <FiUsers />
                          Share
                        </button>
                        <button
                          className="dropdown-item"
                          onClick={() => { setOpenDropdown(null); setWebhookProject(project); }}
                        >
                          <FiLink />
                          Webhooks
                        </button>
                        {project.is_archived ? (
                          <button
                            className="dropdown-item"
                            onClick={() => handleRestore(project)}
                          >
                            <FiRefreshCw />
                            Restore
                          </button>
                        ) : (
                          <button
                            className="dropdown-item"
                            onClick={() => handleArchive(project)}
                          >
                            <FiArchive />
                            Archive
                          </button>
                        )}
                        <button
                          className="dropdown-item delete-item"
                          onClick={() => handleDelete(project)}
                        >
                          <FiTrash2 />
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="pagination-wrapper">
          <Pagination pageCount={totalPages} gotoPage={handlePage} />
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirm && (() => {
        const project = filteredProjects.find(p => p.id === deleteConfirm);
        if (!project) return null;
        return (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-modal">
              <h4>Delete Project?</h4>
              <p>This will permanently delete "{project.project_name}" including all jobs and files. This action cannot be undone.</p>
              <div className="delete-confirm-actions">
                <button className="cancel-btn" onClick={() => setDeleteConfirm(null)}>Cancel</button>
                <button className="confirm-delete-btn" onClick={() => handleDelete(project)}>Delete</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Archive Confirmation Modal */}
      {archiveConfirm && (() => {
        const project = filteredProjects.find(p => p.id === archiveConfirm);
        if (!project) return null;
        return (
          <div className="delete-confirm-overlay">
            <div className="delete-confirm-modal">
              <h4>Archive Project?</h4>
              <p>This will move "{project.project_name}" to archive storage. You can restore it later, but no new jobs can be submitted while archived.</p>
              <div className="delete-confirm-actions">
                <button className="cancel-btn" onClick={() => setArchiveConfirm(null)}>Cancel</button>
                <button className="confirm-archive-btn" onClick={() => handleArchive(project)}>Archive</button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Project Members Modal */}
      {sharingProject && (
        <ProjectMembers
          projectId={sharingProject.id}
          projectName={sharingProject.project_name}
          isOwner={sharingProject.is_owner}
          onClose={() => setSharingProject(null)}
        />
      )}

      {/* Project Webhooks Modal */}
      {webhookProject && (
        <ProjectWebhooks
          projectId={webhookProject.id}
          projectName={webhookProject.project_name}
          onClose={() => setWebhookProject(null)}
        />
      )}

      <style>{`
        .list-container {
          width: 100%;
          overflow: visible;
          position: relative;
        }

        .data-table {
          width: 100%;
          border-collapse: collapse;
          overflow: visible;
        }

        .data-table thead {
          background: var(--color-bg-hover);
          border-bottom: 1px solid var(--color-border);
        }

        .data-table th {
          padding: 14px 24px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .data-table th.col-action {
          text-align: right;
        }

        .data-table tbody tr {
          border-bottom: 1px solid var(--color-border-light);
          transition: background 0.15s ease;
          animation: fadeIn 0.3s ease forwards;
          opacity: 0;
        }

        @keyframes fadeIn {
          to { opacity: 1; }
        }

        .data-table tbody tr:last-child {
          border-bottom: none;
        }

        .data-table tbody tr:hover {
          background: var(--color-bg-hover);
        }

        .data-table td {
          padding: 18px 24px;
          vertical-align: middle;
        }

        .project-name-cell {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .project-name {
          font-size: 10px;
          font-weight: 600;
          color: var(--color-text-heading);
        }

        .role-tag {
          display: inline-flex;
          align-items: center;
          gap: 3px;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 9px;
          font-weight: 600;
          text-transform: uppercase;
        }

        .role-tag.owner {
          background: var(--color-warning-bg);
          color: var(--color-warning-text);
        }

        .role-tag.admin {
          background: var(--color-info-bg);
          color: var(--color-info-text);
        }

        .role-tag.editor {
          background: var(--color-success-bg);
          color: var(--color-success-text);
        }

        .role-tag.viewer {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
        }

        .project-desc {
          font-size: 9px;
          color: var(--color-text-secondary);
          max-width: 320px;
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
          line-height: 1.4;
          word-break: break-word;
        }

        .project-date {
          font-size: 10px;
          color: var(--color-text-muted);
        }

        .action-buttons {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 8px;
        }

        .open-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 16px;
          font-size: 10px;
          font-weight: 500;
          color: var(--color-primary);
          background: var(--color-primary-bg);
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .open-btn:hover {
          background: var(--color-info-bg);
          color: var(--color-primary-hover);
        }

        .open-btn svg {
          font-size: 14px;
          transition: transform 0.2s ease;
        }

        .open-btn:hover svg {
          transform: translate(2px, -2px);
        }

        .dropdown-container {
          position: relative;
        }

        .more-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          padding: 8px 12px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          border-radius: 8px;
          cursor: pointer;
          color: var(--color-text-secondary);
          font-size: 10px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .more-btn svg {
          font-size: 16px;
        }

        .more-btn:hover:not(:disabled) {
          background: var(--color-bg-hover);
          color: var(--color-text);
          border-color: var(--color-border-hover);
        }

        .more-btn-disabled {
          opacity: 0.4;
          cursor: not-allowed !important;
        }

        .dropdown-menu {
          position: absolute;
          right: 0;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.15);
          min-width: 180px;
          z-index: 1000;
          overflow: hidden;
        }

        .dropdown-item {
          display: flex;
          align-items: center;
          gap: 10px;
          width: 100%;
          padding: 10px 14px;
          border: none;
          background: none;
          cursor: pointer;
          font-size: 10px;
          color: var(--color-text);
          text-align: left;
          transition: background 0.15s ease;
        }

        .dropdown-item:hover {
          background: var(--color-bg-hover);
        }

        .dropdown-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dropdown-item svg {
          font-size: 15px;
          color: var(--color-text-secondary);
        }

        .dropdown-item.delete-item {
          color: var(--color-danger);
        }

        .dropdown-item.delete-item svg {
          color: var(--color-danger);
        }

        .dropdown-item.delete-item:hover {
          background: var(--color-danger-bg);
        }

        .delete-confirm-overlay {
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

        .delete-confirm-modal {
          background: var(--color-bg-card);
          border-radius: 12px;
          padding: 24px;
          max-width: 400px;
          width: 90%;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }

        .delete-confirm-modal h4 {
          margin: 0 0 12px;
          font-size: 18px;
          font-weight: 600;
          color: var(--color-text-heading);
        }

        .delete-confirm-modal p {
          margin: 0 0 20px;
          font-size: 14px;
          color: var(--color-text-secondary);
          line-height: 1.5;
        }

        .delete-confirm-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .cancel-btn {
          padding: 10px 20px;
          border: 1px solid var(--color-border);
          background: var(--color-bg-card);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover {
          background: var(--color-bg-hover);
          border-color: var(--color-border-hover);
        }

        .confirm-delete-btn {
          padding: 10px 20px;
          border: none;
          background: var(--color-danger);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-delete-btn:hover {
          background: var(--color-danger-text);
        }

        .confirm-archive-btn {
          padding: 10px 20px;
          border: none;
          background: var(--color-warning-text);
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-archive-btn:hover {
          opacity: 0.85;
        }

        .empty-state {
          padding: 80px 40px;
          text-align: center;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          background: var(--color-bg-hover);
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .empty-icon svg {
          font-size: 28px;
          color: var(--color-text-muted);
        }

        .empty-state h3 {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 8px;
        }

        .empty-state p {
          font-size: 14px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 80px 40px;
          color: var(--color-text-secondary);
          font-size: 14px;
        }

        .spinner {
          font-size: 20px;
          color: var(--color-primary);
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pagination-wrapper {
          padding: 20px 24px;
          border-top: 1px solid var(--color-border-light);
          display: flex;
          justify-content: center;
        }

        .col-name { width: 18%; }
        .col-type { width: 10%; }
        .col-desc { width: 25%; }
        .col-user { width: 14%; }
        .col-date { width: 12%; }
        .col-action { width: 21%; }

        .type-badge {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 3px 10px;
          border-radius: 12px;
          font-size: 10px;
          font-weight: 500;
        }

        .type-regular {
          background: var(--color-bg-hover);
          color: var(--color-text-secondary);
        }

        .type-live {
          background: var(--color-success-bg);
          color: var(--color-success-text);
        }

        .type-archived {
          background: var(--color-warning-bg);
          color: var(--color-warning-text);
        }

        .live-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          margin-left: 2px;
        }

        .live-status-running {
          background: var(--color-success-text);
          box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
          animation: pulse-dot 1.5s infinite;
        }

        .live-status-pending {
          background: var(--color-warning-text);
        }

        .live-status-paused {
          background: var(--color-primary);
        }

        .live-status-completed {
          background: var(--color-text-muted);
        }

        .live-status-stopped {
          background: var(--color-danger);
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .open-btn-live {
          color: var(--color-success-text) !important;
          background: var(--color-success-bg) !important;
        }

        .open-btn-live:hover {
          background: var(--color-success-bg) !important;
          color: var(--color-success-text) !important;
        }

        .user-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: var(--color-bg-hover);
          border-radius: 16px;
        }

        .user-icon {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .user-name {
          font-size: 10px;
          color: var(--color-text);
          font-weight: 500;
        }

        .data-table {
          overflow: visible;
        }

        .data-table tbody {
          overflow: visible;
        }

        .data-table td.col-action {
          overflow: visible;
          position: relative;
        }
      `}</style>
    </div>
  );
};

export default ProjectsList;
