import { useEffect, useState, useRef } from "react";
import { getProjectListApi, deleteProjectApi } from "../../services/projects/projects";
import { formatDateString } from "../../utils/datetime";
import { FiArrowUpRight, FiLoader, FiInbox, FiMoreVertical, FiTrash2, FiUser, FiUsers, FiZap } from "react-icons/fi";
import useToast from "../../hooks/useToast";
import Pagination from "../Tabs/common/Pagination";
import { Link } from "react-router-dom";
import ProjectMembers from "./ProjectMembers";

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

const ProjectsList = ({ searchTerm = "" }) => {
  const [projects, setProjects] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalRecords, setTotalRecords] = useState(0);
  const [openDropdown, setOpenDropdown] = useState(null);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [sharingProject, setSharingProject] = useState(null);
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
    getProjectListApi({ limit, skip })
      .then((resp) => {
        if (resp?.data?.data?.length) {
          setProjects(resp?.data?.data);
          setTotalRecords(resp?.data?.count);
        }
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
  }, [currentPage]);

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

      {/* Project Members Modal */}
      {sharingProject && (
        <ProjectMembers
          projectId={sharingProject.id}
          projectName={sharingProject.project_name}
          isOwner={sharingProject.is_owner}
          onClose={() => setSharingProject(null)}
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
          background: #fafbfc;
          border-bottom: 1px solid #e2e8f0;
        }

        .data-table th {
          padding: 14px 24px;
          text-align: left;
          font-size: 11px;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.6px;
        }

        .data-table th.col-action {
          text-align: right;
        }

        .data-table tbody tr {
          border-bottom: 1px solid #f1f5f9;
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
          background: #f8fafc;
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
          color: #0f172a;
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
          background: #fef3c7;
          color: #d97706;
        }

        .role-tag.admin {
          background: #dbeafe;
          color: #1d4ed8;
        }

        .role-tag.editor {
          background: #dcfce7;
          color: #16a34a;
        }

        .role-tag.viewer {
          background: #f1f5f9;
          color: #64748b;
        }

        .project-desc {
          font-size: 9px;
          color: #64748b;
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
          color: #94a3b8;
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
          color: #3b82f6;
          background: #eff6ff;
          text-decoration: none;
          border-radius: 8px;
          transition: all 0.2s ease;
        }

        .open-btn:hover {
          background: #dbeafe;
          color: #2563eb;
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
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          cursor: pointer;
          color: #64748b;
          font-size: 10px;
          font-weight: 500;
          transition: all 0.2s ease;
          white-space: nowrap;
        }

        .more-btn svg {
          font-size: 16px;
        }

        .more-btn:hover:not(:disabled) {
          background: #f8fafc;
          color: #334155;
          border-color: #cbd5e1;
        }

        .more-btn-disabled {
          opacity: 0.4;
          cursor: not-allowed !important;
        }

        .dropdown-menu {
          position: absolute;
          right: 0;
          background: white;
          border: 1px solid #e2e8f0;
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
          color: #334155;
          text-align: left;
          transition: background 0.15s ease;
        }

        .dropdown-item:hover {
          background: #f8fafc;
        }

        .dropdown-item:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .dropdown-item svg {
          font-size: 15px;
          color: #64748b;
        }

        .dropdown-item.delete-item {
          color: #dc2626;
        }

        .dropdown-item.delete-item svg {
          color: #dc2626;
        }

        .dropdown-item.delete-item:hover {
          background: #fef2f2;
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
          background: white;
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
          color: #0f172a;
        }

        .delete-confirm-modal p {
          margin: 0 0 20px;
          font-size: 14px;
          color: #64748b;
          line-height: 1.5;
        }

        .delete-confirm-actions {
          display: flex;
          gap: 12px;
          justify-content: flex-end;
        }

        .cancel-btn {
          padding: 10px 20px;
          border: 1px solid #e2e8f0;
          background: white;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: #64748b;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-btn:hover {
          background: #f8fafc;
          border-color: #cbd5e1;
        }

        .confirm-delete-btn {
          padding: 10px 20px;
          border: none;
          background: #dc2626;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .confirm-delete-btn:hover {
          background: #b91c1c;
        }

        .empty-state {
          padding: 80px 40px;
          text-align: center;
        }

        .empty-icon {
          width: 64px;
          height: 64px;
          background: #f1f5f9;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto 20px;
        }

        .empty-icon svg {
          font-size: 28px;
          color: #94a3b8;
        }

        .empty-state h3 {
          font-size: 16px;
          font-weight: 600;
          color: #334155;
          margin: 0 0 8px;
        }

        .empty-state p {
          font-size: 14px;
          color: #64748b;
          margin: 0;
        }

        .loading-state {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          padding: 80px 40px;
          color: #64748b;
          font-size: 14px;
        }

        .spinner {
          font-size: 20px;
          color: #3b82f6;
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        .pagination-wrapper {
          padding: 20px 24px;
          border-top: 1px solid #f1f5f9;
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
          background: #f1f5f9;
          color: #64748b;
        }

        .type-live {
          background: #ecfdf5;
          color: #047857;
        }

        .live-status-dot {
          width: 7px;
          height: 7px;
          border-radius: 50%;
          display: inline-block;
          margin-left: 2px;
        }

        .live-status-running {
          background: #22c55e;
          box-shadow: 0 0 4px rgba(34, 197, 94, 0.5);
          animation: pulse-dot 1.5s infinite;
        }

        .live-status-pending {
          background: #f59e0b;
        }

        .live-status-paused {
          background: #3b82f6;
        }

        .live-status-completed {
          background: #94a3b8;
        }

        .live-status-stopped {
          background: #ef4444;
        }

        @keyframes pulse-dot {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.4; }
        }

        .open-btn-live {
          color: #047857 !important;
          background: #ecfdf5 !important;
        }

        .open-btn-live:hover {
          background: #d1fae5 !important;
          color: #065f46 !important;
        }

        .user-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 4px 10px;
          background: #f1f5f9;
          border-radius: 16px;
        }

        .user-icon {
          font-size: 12px;
          color: #64748b;
        }

        .user-name {
          font-size: 10px;
          color: #475569;
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
