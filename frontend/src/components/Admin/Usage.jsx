import React, { useState, useEffect } from "react";
import { FiDownload, FiLoader, FiBarChart2, FiCalendar, FiUsers, FiFolder, FiClock } from "react-icons/fi";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LineChart, Line } from "recharts";
import { getUsageReport, downloadUsageCsv } from "../../services/usageApi";
import useToast from "../../hooks/useToast";

const GROUP_OPTIONS = [
  { value: "user", label: "By User", icon: FiUsers },
  { value: "project", label: "By Project", icon: FiFolder },
  { value: "month", label: "By Month", icon: FiCalendar },
];

const AdminUsage = () => {
  const [data, setData] = useState(null);
  const [isLoading, setLoading] = useState(true);
  const [groupBy, setGroupBy] = useState("user");
  const [startDate, setStartDate] = useState(() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 6);
    return d.toISOString().split("T")[0];
  });
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [isExporting, setExporting] = useState(false);
  const showToast = useToast();

  useEffect(() => {
    fetchData();
  }, [groupBy, startDate, endDate]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const resp = await getUsageReport({
        group_by: groupBy,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + "T23:59:59").toISOString(),
      });
      setData(resp.data.data || resp.data);
    } catch (error) {
      showToast(error.response?.data?.message || "Failed to load usage data", { type: "error" });
    } finally {
      setLoading(false);
    }
  };

  const handleExport = async () => {
    try {
      setExporting(true);
      await downloadUsageCsv({
        group_by: groupBy,
        start_date: new Date(startDate).toISOString(),
        end_date: new Date(endDate + "T23:59:59").toISOString(),
      });
      showToast("CSV downloaded", { type: "success" });
    } catch (error) {
      showToast("Failed to export CSV", { type: "error" });
    } finally {
      setExporting(false);
    }
  };

  const rows = data?.rows || [];
  const totals = data?.totals || {};

  // Chart data
  const chartData = rows.map((row) => ({
    name: groupBy === "user" ? row.username : groupBy === "project" ? row.project_name : row.label,
    hours: row.total_hours,
    jobs: row.total_jobs,
  }));

  return (
    <div className="usage-page">
      <div className="usage-container">
        {/* Header */}
        <div className="usage-header">
          <div className="usage-title-row">
            <FiBarChart2 size={20} />
            <h2>Usage Report</h2>
          </div>
          <p className="usage-subtitle">Compute hours and job statistics for billing and capacity planning.</p>
        </div>

        {/* Controls */}
        <div className="usage-controls">
          <div className="usage-group-btns">
            {GROUP_OPTIONS.map((opt) => {
              const Icon = opt.icon;
              return (
                <button
                  key={opt.value}
                  className={`usage-group-btn ${groupBy === opt.value ? "active" : ""}`}
                  onClick={() => setGroupBy(opt.value)}
                >
                  <Icon size={13} />
                  {opt.label}
                </button>
              );
            })}
          </div>
          <div className="usage-date-range">
            <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
            <span className="usage-date-sep">to</span>
            <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <button className="usage-export-btn" onClick={handleExport} disabled={isExporting || isLoading}>
            {isExporting ? <FiLoader className="usage-spinner" size={14} /> : <FiDownload size={14} />}
            Export CSV
          </button>
        </div>

        {/* Summary Cards */}
        {!isLoading && data && (
          <div className="usage-summary">
            <div className="usage-card">
              <span className="usage-card-label">Total Compute</span>
              <span className="usage-card-value">{totals.total_hours ?? 0}h</span>
            </div>
            <div className="usage-card">
              <span className="usage-card-label">Total Jobs</span>
              <span className="usage-card-value">{totals.total_jobs ?? 0}</span>
            </div>
            <div className="usage-card">
              <span className="usage-card-label">Successful</span>
              <span className="usage-card-value usage-success">{totals.successful_jobs ?? 0}</span>
            </div>
            <div className="usage-card">
              <span className="usage-card-label">Failed</span>
              <span className="usage-card-value usage-failed">{totals.failed_jobs ?? 0}</span>
            </div>
          </div>
        )}

        {/* Chart */}
        {!isLoading && chartData.length > 0 && (
          <div className="usage-chart-container">
            <h3 className="usage-section-title">
              <FiClock size={14} />
              Compute Hours
            </h3>
            <ResponsiveContainer width="100%" height={260}>
              {groupBy === "month" ? (
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Line type="monotone" dataKey="hours" stroke="#3b82f6" strokeWidth={2} dot={{ r: 3 }} name="Hours" />
                  <Line type="monotone" dataKey="jobs" stroke="#8b5cf6" strokeWidth={2} dot={{ r: 3 }} name="Jobs" />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="name" tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} angle={-30} textAnchor="end" height={60} />
                  <YAxis tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }} />
                  <Tooltip
                    contentStyle={{ background: "var(--color-bg-card)", border: "1px solid var(--color-border)", borderRadius: 8, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Bar dataKey="hours" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Hours" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
        )}

        {/* Table */}
        {isLoading ? (
          <div className="usage-loading">
            <FiLoader className="usage-spinner" />
            Loading...
          </div>
        ) : rows.length === 0 ? (
          <div className="usage-empty">No usage data for the selected period.</div>
        ) : (
          <div className="usage-table-wrap">
            <table className="usage-table">
              <thead>
                <tr>
                  <th>{groupBy === "user" ? "User" : groupBy === "project" ? "Project" : "Month"}</th>
                  <th>Total Jobs</th>
                  <th>Successful</th>
                  <th>Failed</th>
                  <th>Compute Hours</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="usage-name-cell">
                      {groupBy === "user" ? (
                        <span>{row.name || row.username}</span>
                      ) : groupBy === "project" ? (
                        <span>{row.project_name}</span>
                      ) : (
                        <span>{row.label}</span>
                      )}
                    </td>
                    <td>{row.total_jobs}</td>
                    <td className="usage-success">{row.successful_jobs}</td>
                    <td className="usage-failed">{row.failed_jobs}</td>
                    <td><strong>{row.total_hours}h</strong></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <style>{`
        .usage-page {
          padding: 24px;
          max-width: 960px;
          margin: 0 auto;
        }
        .usage-container {
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 24px;
        }
        .usage-header { margin-bottom: 20px; }
        .usage-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          color: var(--color-text-heading);
        }
        .usage-title-row h2 { margin: 0; font-size: 18px; font-weight: 600; }
        .usage-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 4px 0 0;
        }
        .usage-controls {
          display: flex;
          align-items: center;
          gap: 12px;
          flex-wrap: wrap;
          margin-bottom: 20px;
        }
        .usage-group-btns {
          display: flex;
          gap: 4px;
          background: var(--color-bg);
          border-radius: 8px;
          padding: 3px;
        }
        .usage-group-btn {
          display: flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          font-size: 12px;
          font-weight: 500;
          border: none;
          border-radius: 6px;
          background: transparent;
          color: var(--color-text-secondary);
          cursor: pointer;
          transition: all 0.15s;
        }
        .usage-group-btn:hover { color: var(--color-text); }
        .usage-group-btn.active {
          background: var(--color-bg-card);
          color: var(--color-primary);
          font-weight: 600;
          box-shadow: 0 1px 3px rgba(0,0,0,0.1);
        }
        .usage-date-range {
          display: flex;
          align-items: center;
          gap: 6px;
          margin-left: auto;
        }
        .usage-date-range input {
          padding: 6px 10px;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          font-size: 12px;
          background: var(--color-bg-card);
          color: var(--color-text);
        }
        .usage-date-sep { font-size: 12px; color: var(--color-text-muted); }
        .usage-export-btn {
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 6px 14px;
          font-size: 12px;
          font-weight: 500;
          border: 1px solid var(--color-border);
          border-radius: 6px;
          background: var(--color-bg-card);
          color: var(--color-text-secondary);
          cursor: pointer;
        }
        .usage-export-btn:hover:not(:disabled) {
          border-color: var(--color-primary);
          color: var(--color-primary);
        }
        .usage-export-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .usage-summary {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 12px;
          margin-bottom: 20px;
        }
        .usage-card {
          display: flex;
          flex-direction: column;
          gap: 4px;
          padding: 14px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 8px;
        }
        .usage-card-label {
          font-size: 11px;
          font-weight: 500;
          color: var(--color-text-muted);
          text-transform: uppercase;
          letter-spacing: 0.3px;
        }
        .usage-card-value {
          font-size: 22px;
          font-weight: 700;
          color: var(--color-text-heading);
        }
        .usage-success { color: var(--color-success-text); }
        .usage-failed { color: var(--color-danger-text); }
        .usage-chart-container {
          margin-bottom: 20px;
          padding: 16px;
          background: var(--color-bg);
          border: 1px solid var(--color-border);
          border-radius: 8px;
        }
        .usage-section-title {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 13px;
          font-weight: 600;
          color: var(--color-text-heading);
          margin: 0 0 12px;
        }
        .usage-table-wrap {
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        }
        .usage-table {
          width: 100%;
          border-collapse: collapse;
        }
        .usage-table thead {
          background: var(--color-bg-hover);
        }
        .usage-table th {
          padding: 10px 16px;
          font-size: 11px;
          font-weight: 600;
          color: var(--color-text-secondary);
          text-transform: uppercase;
          text-align: left;
          letter-spacing: 0.3px;
        }
        .usage-table td {
          padding: 10px 16px;
          font-size: 13px;
          color: var(--color-text);
          border-top: 1px solid var(--color-border-light);
        }
        .usage-table tbody tr:hover {
          background: var(--color-bg-hover);
        }
        .usage-name-cell { font-weight: 500; }
        .usage-loading {
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 10px;
          padding: 60px;
          color: var(--color-text-secondary);
          font-size: 13px;
        }
        .usage-empty {
          padding: 60px;
          text-align: center;
          color: var(--color-text-muted);
          font-size: 13px;
        }
        .usage-spinner { animation: usage-spin 1s linear infinite; }
        @keyframes usage-spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

export default AdminUsage;
