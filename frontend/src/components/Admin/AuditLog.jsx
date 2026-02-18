import React, { useState, useEffect, useCallback } from "react";
import { FiFilter, FiLoader, FiChevronLeft, FiChevronRight } from "react-icons/fi";
import api from "../../services/config";

const ACTION_LABELS = {
  login: "Login",
  logout: "Logout",
  register: "Register",
  password_change: "Password Change",
  password_reset: "Password Reset",
  forgot_password: "Forgot Password",
  project_create: "Project Create",
  project_update: "Project Update",
  project_delete: "Project Delete",
  project_archive: "Project Archive",
  project_restore: "Project Restore",
  job_submit: "Job Submit",
  job_cancel: "Job Cancel",
  admin_create_user: "Admin Create User",
  admin_update_user: "Admin Update User",
  admin_delete_user: "Admin Delete User",
  admin_reset_password: "Admin Reset Password",
  admin_generate_api_key: "Admin Generate API Key",
  admin_revoke_api_key: "Admin Revoke API Key",
};

const ACTION_COLORS = {
  login: "info",
  logout: "muted",
  register: "success",
  password_change: "warning",
  password_reset: "warning",
  forgot_password: "warning",
  project_create: "success",
  project_update: "info",
  project_delete: "danger",
  job_submit: "success",
  job_cancel: "danger",
  admin_create_user: "success",
  admin_update_user: "info",
  admin_delete_user: "danger",
  admin_reset_password: "warning",
  admin_generate_api_key: "info",
  admin_revoke_api_key: "danger",
};

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [filterAction, setFilterAction] = useState("");
  const [filterUsername, setFilterUsername] = useState("");
  const limit = 50;

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ page, limit });
      if (filterAction) params.append("action", filterAction);
      if (filterUsername) params.append("username", filterUsername);

      const resp = await api.get(`/api/admin/audit?${params}`);
      const data = resp.data;
      setLogs(data.data || []);
      setTotal(data.pagination?.total || 0);
      setTotalPages(data.pagination?.pages || 1);
    } catch {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterUsername]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const handleFilter = (e) => {
    e.preventDefault();
    setPage(1);
    fetchLogs();
  };

  return (
    <div className="audit-page">
      <div className="audit-container">
        <header className="audit-header">
          <div className="header-title">
            <h1>Audit Log</h1>
            <span className="header-subtitle">{total} events (retained 90 days)</span>
          </div>
        </header>

        <form className="audit-filters" onSubmit={handleFilter}>
          <div className="filter-group">
            <FiFilter size={14} />
            <select
              value={filterAction}
              onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            >
              <option value="">All Actions</option>
              {Object.entries(ACTION_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            </select>
          </div>
          <div className="filter-group">
            <input
              type="text"
              placeholder="Filter by username..."
              value={filterUsername}
              onChange={(e) => setFilterUsername(e.target.value)}
              onBlur={() => { setPage(1); fetchLogs(); }}
              onKeyDown={(e) => { if (e.key === "Enter") { setPage(1); fetchLogs(); } }}
            />
          </div>
        </form>

        {loading ? (
          <div className="audit-loading">
            <FiLoader className="spinner" />
            <span>Loading audit logs...</span>
          </div>
        ) : logs.length === 0 ? (
          <div className="audit-empty">No audit events found.</div>
        ) : (
          <>
            <div className="audit-table-container">
              <table className="audit-table">
                <thead>
                  <tr>
                    <th>Time</th>
                    <th>User</th>
                    <th>Action</th>
                    <th>Resource</th>
                    <th>Details</th>
                    <th>IP</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log, i) => (
                    <tr key={log._id || i}>
                      <td className="col-time">
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td className="col-user">{log.username || "-"}</td>
                      <td>
                        <span className={`action-badge ${ACTION_COLORS[log.action] || "muted"}`}>
                          {ACTION_LABELS[log.action] || log.action}
                        </span>
                      </td>
                      <td className="col-resource">
                        {log.resourceType ? (
                          <span>{log.resourceType} {log.resourceId ? `#${log.resourceId}` : ""}</span>
                        ) : "-"}
                      </td>
                      <td className="col-details">{log.details || "-"}</td>
                      <td className="col-ip">{log.ipAddress || "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {totalPages > 1 && (
              <div className="audit-pagination">
                <button
                  disabled={page <= 1}
                  onClick={() => setPage(p => Math.max(1, p - 1))}
                >
                  <FiChevronLeft size={16} />
                  Prev
                </button>
                <span>Page {page} of {totalPages}</span>
                <button
                  disabled={page >= totalPages}
                  onClick={() => setPage(p => p + 1)}
                >
                  Next
                  <FiChevronRight size={16} />
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .audit-page {
          min-height: calc(100vh - 48px);
          background: var(--color-bg);
        }

        .audit-container {
          padding: 24px 32px;
        }

        .audit-header {
          margin-bottom: 20px;
        }

        .audit-header h1 {
          font-size: 24px;
          font-weight: 600;
          color: var(--color-text-heading);
          margin: 0 0 4px 0;
        }

        .header-subtitle {
          font-size: 14px;
          color: var(--color-text-secondary);
        }

        .audit-filters {
          display: flex;
          gap: 12px;
          margin-bottom: 16px;
          align-items: center;
        }

        .filter-group {
          display: flex;
          align-items: center;
          gap: 6px;
          color: var(--color-text-secondary);
        }

        .filter-group select,
        .filter-group input {
          padding: 7px 10px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 13px;
          background: var(--color-bg-card);
          color: var(--color-text);
        }

        .filter-group select:focus,
        .filter-group input:focus {
          outline: none;
          border-color: var(--color-primary);
        }

        .audit-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 12px;
          height: 300px;
          color: var(--color-text-secondary);
        }

        .spinner {
          animation: spin 1s linear infinite;
        }

        @keyframes spin {
          to { transform: rotate(360deg); }
        }

        .audit-empty {
          text-align: center;
          padding: 60px 20px;
          color: var(--color-text-muted);
          font-size: 14px;
        }

        .audit-table-container {
          background: var(--color-bg-card);
          border-radius: 12px;
          border: 1px solid var(--color-border);
          overflow: hidden;
        }

        .audit-table {
          width: 100%;
          border-collapse: collapse;
        }

        .audit-table th {
          padding: 12px 16px;
          text-align: left;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          background: var(--color-bg-hover);
          border-bottom: 1px solid var(--color-border);
        }

        .audit-table td {
          padding: 10px 16px;
          font-size: 13px;
          border-bottom: 1px solid var(--color-border-light);
          color: var(--color-text);
        }

        .audit-table tr:last-child td {
          border-bottom: none;
        }

        .col-time {
          white-space: nowrap;
          color: var(--color-text-secondary);
          font-size: 12px;
        }

        .col-user {
          font-weight: 500;
        }

        .col-resource {
          font-size: 12px;
          color: var(--color-text-secondary);
        }

        .col-details {
          max-width: 250px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }

        .col-ip {
          font-family: monospace;
          font-size: 12px;
          color: var(--color-text-muted);
        }

        .action-badge {
          display: inline-block;
          padding: 3px 8px;
          border-radius: 10px;
          font-size: 11px;
          font-weight: 500;
          white-space: nowrap;
        }

        .action-badge.info {
          background: var(--color-info-bg);
          color: var(--color-info-text);
        }

        .action-badge.success {
          background: var(--color-success-bg);
          color: var(--color-success-text);
        }

        .action-badge.warning {
          background: var(--color-warning-bg);
          color: var(--color-warning-text);
        }

        .action-badge.danger {
          background: var(--color-danger-bg);
          color: var(--color-danger-text, var(--color-danger));
        }

        .action-badge.muted {
          background: var(--color-bg-hover);
          color: var(--color-text-muted);
        }

        .audit-pagination {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 16px;
          margin-top: 16px;
          font-size: 13px;
          color: var(--color-text-secondary);
        }

        .audit-pagination button {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 6px 12px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          background: var(--color-bg-card);
          color: var(--color-text);
          cursor: pointer;
          font-size: 13px;
        }

        .audit-pagination button:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .audit-pagination button:not(:disabled):hover {
          background: var(--color-bg-hover);
        }
      `}</style>
    </div>
  );
};

export default AuditLog;
