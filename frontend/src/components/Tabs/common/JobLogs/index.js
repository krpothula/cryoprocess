import { useState, useEffect, useRef, useCallback } from "react";
import { getJobLogs, streamJobLogs, getJobIssues } from "../../../../services/slurmApi";
import {
  FiAlertCircle,
  FiAlertTriangle,
  FiCheckCircle,
  FiClock,
  FiCopy,
  FiChevronDown,
  FiTerminal,
  FiFileText,
} from "react-icons/fi";
import "./JobLogs.css";

// Job type display names
const JOB_TYPE_NAMES = {
  LinkMovies: "Link Movies",
  Import: "Import",
  MotionCorr: "Motion Correction",
  CtfFind: "CTF Estimation",
  ManualPick: "Manual Picking",
  AutoPick: "Auto-Picking",
  Extract: "Particle Extraction",
  Class2D: "2D Classification",
  Class3D: "3D Classification",
  InitialModel: "3D Initial Model",
  AutoRefine: "3D Auto-Refine",
  Multibody: "3D Multi-Body",
  Subset: "Subset Selection",
  CtfRefine: "CTF Refinement",
  Polish: "Bayesian Polishing",
  MaskCreate: "Mask Creation",
  PostProcess: "Post-Processing",
  JoinStar: "Join Star Files",
  Subtract: "Particle Subtraction",
  LocalRes: "Local Resolution",
  Dynamight: "DynaMight",
  ModelAngelo: "ModelAngelo",
  ManualSelect: "Select Classes",
};

const STATUS_CONFIG = {
  success: { label: "SUCCESS", color: "#10b981", bg: "#ecfdf5" },
  failed: { label: "FAILED", color: "#ef4444", bg: "#fef2f2" },
  error: { label: "ERROR", color: "#ef4444", bg: "#fef2f2" },
  running: { label: "RUNNING", color: "#f59e0b", bg: "#fffbeb" },
  pending: { label: "PENDING", color: "#6366f1", bg: "#eef2ff" },
  cancelled: { label: "CANCELLED", color: "#6b7280", bg: "#f1f5f9" },
};

function formatDuration(start, end) {
  if (!start) return null;
  const s = new Date(start);
  const e = end ? new Date(end) : new Date();
  const ms = e - s;
  if (ms < 1000) return "<1s";
  const secs = Math.floor(ms / 1000);
  if (secs < 60) return `${secs}s`;
  const mins = Math.floor(secs / 60);
  const remSecs = secs % 60;
  if (mins < 60) return `${mins}m ${remSecs}s`;
  const hrs = Math.floor(mins / 60);
  const remMins = mins % 60;
  return `${hrs}h ${remMins}m`;
}

/**
 * JobLogs Component - Structured log viewer with tabs for Output, Errors, and Issues
 */
const JobLogs = ({ jobId, autoRefresh = true, refreshInterval = 3000 }) => {
  const [logs, setLogs] = useState({ stdout: "", stderr: "" });
  const [jobMeta, setJobMeta] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isComplete, setIsComplete] = useState(false);
  const [streamOffset, setStreamOffset] = useState(0);
  const [activeTab, setActiveTab] = useState("output");

  // Issues state (lazy-loaded)
  const [issues, setIssues] = useState(null);
  const [issuesLoading, setIssuesLoading] = useState(false);
  const [issuesSummary, setIssuesSummary] = useState(null);
  const [slurmDetails, setSlurmDetails] = useState(null);
  const [expandedIssues, setExpandedIssues] = useState(new Set());

  const [copied, setCopied] = useState(false);

  const intervalRef = useRef(null);
  const logEndRef = useRef(null);

  // Fetch initial logs
  useEffect(() => {
    if (!jobId) return;

    const fetchLogs = async () => {
      setLoading(true);
      setError(null);
      setIssues(null);
      setIssuesSummary(null);
      setSlurmDetails(null);
      setActiveTab("output");
      setExpandedIssues(new Set());

      const result = await getJobLogs(jobId, { tail: 500 });

      if (result.success) {
        setLogs(result.logs || { stdout: "", stderr: "" });
        setJobMeta(result.job || null);
        if (result.logs?.stdout) {
          setStreamOffset(result.logs.stdout.length);
        }
        // Auto-switch to errors tab if job failed and stderr has content
        if (
          result.job?.status === "failed" &&
          result.logs?.stderr?.trim()
        ) {
          setActiveTab("errors");
        }
      } else {
        setError(result.error || "Failed to fetch logs");
      }

      setLoading(false);
    };

    fetchLogs();
  }, [jobId]);

  // Stream updates for running jobs
  useEffect(() => {
    if (!jobId || !autoRefresh || isComplete) return;

    const streamUpdates = async () => {
      const result = await streamJobLogs(jobId, streamOffset);

      if (result.success) {
        if (result.content) {
          setLogs((prev) => ({
            ...prev,
            stdout: prev.stdout + result.content,
          }));
          setStreamOffset(result.offset);
        }
        if (result.complete) {
          setIsComplete(true);
          // Re-fetch full logs to get final stderr + job metadata
          const fullResult = await getJobLogs(jobId, { tail: 500 });
          if (fullResult.success) {
            setLogs(fullResult.logs || { stdout: "", stderr: "" });
            setJobMeta(fullResult.job || null);
          }
        }
      }
    };

    intervalRef.current = setInterval(streamUpdates, refreshInterval);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [jobId, autoRefresh, isComplete, streamOffset, refreshInterval]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (activeTab === "output" && logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: "smooth" });
    }
  }, [logs.stdout, activeTab]);

  // Fetch issues when Issues tab is first activated
  const fetchIssues = useCallback(async () => {
    if (!jobId || issues !== null) return;
    setIssuesLoading(true);
    const result = await getJobIssues(jobId, { includeWarnings: true });
    if (result.success) {
      setIssues(result.issues || []);
      setIssuesSummary(result.summary || { total: 0, errors: 0, warnings: 0 });
      setSlurmDetails(result.slurm || null);
    } else {
      setIssues([]);
      setIssuesSummary({ total: 0, errors: 0, warnings: 0 });
    }
    setIssuesLoading(false);
  }, [jobId, issues]);

  useEffect(() => {
    if (activeTab === "issues") {
      fetchIssues();
    }
  }, [activeTab, fetchIssues]);

  const handleCopyError = () => {
    if (!jobMeta) return;
    const text = [
      `Job: ${jobMeta.job_name}`,
      `Type: ${JOB_TYPE_NAMES[jobMeta.job_type] || jobMeta.job_type}`,
      `Status: ${jobMeta.status?.toUpperCase()}`,
      jobMeta.slurm_job_id ? `SLURM ID: ${jobMeta.slurm_job_id}` : null,
      jobMeta.error_message ? `Error: ${jobMeta.error_message}` : null,
      jobMeta.command ? `Command: ${jobMeta.command}` : null,
      slurmDetails ? `SLURM State: ${slurmDetails.state}` : null,
      slurmDetails?.exitCode ? `Exit Code: ${slurmDetails.exitCode}` : null,
      slurmDetails?.elapsed ? `Elapsed: ${slurmDetails.elapsed}` : null,
      slurmDetails?.maxRSS ? `Max RSS: ${slurmDetails.maxRSS}` : null,
      logs.stderr ? `\n--- stderr ---\n${logs.stderr.slice(0, 2000)}` : null,
    ]
      .filter(Boolean)
      .join("\n");

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };

  const toggleIssue = (idx) => {
    setExpandedIssues((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const stderrLineCount = logs.stderr
    ? logs.stderr.split("\n").filter((l) => l.trim()).length
    : 0;

  const statusCfg = STATUS_CONFIG[jobMeta?.status] || STATUS_CONFIG.pending;
  const duration = formatDuration(jobMeta?.start_time, jobMeta?.end_time);
  const isFailed = jobMeta?.status === "failed" || jobMeta?.status === "error";

  // ─── Render helpers ──────────────────────────────────────────

  const renderJobHeader = () => {
    if (!jobMeta) return null;
    return (
      <div style={styles.header}>
        <div style={styles.headerRow}>
          <span style={styles.jobName}>{jobMeta.job_name}</span>
          <span style={styles.dot}>·</span>
          <span style={styles.jobType}>
            {JOB_TYPE_NAMES[jobMeta.job_type] || jobMeta.job_type}
          </span>
          <span
            style={{
              ...styles.statusPill,
              color: statusCfg.color,
              background: statusCfg.bg,
            }}
          >
            {statusCfg.label}
          </span>
          {jobMeta.slurm_job_id && (
            <span style={styles.slurmBadge}>
              SLURM: {jobMeta.slurm_job_id}
            </span>
          )}
        </div>
        <div style={styles.headerMeta}>
          {duration && (
            <span style={styles.metaItem}>
              <FiClock size={12} /> {duration}
            </span>
          )}
          {jobMeta.start_time && (
            <span style={styles.metaItem}>
              Started: {new Date(jobMeta.start_time).toLocaleTimeString()}
            </span>
          )}
          {isFailed && (
            <button onClick={handleCopyError} style={styles.copyBtn}>
              <FiCopy size={12} />
              {copied ? "Copied!" : "Copy Details"}
            </button>
          )}
        </div>
      </div>
    );
  };

  const renderErrorBanner = () => {
    if (!isFailed || !jobMeta?.error_message) return null;
    return (
      <div style={styles.errorBanner}>
        <FiAlertCircle size={16} style={{ flexShrink: 0 }} />
        <span style={styles.errorBannerText}>{jobMeta.error_message}</span>
      </div>
    );
  };

  const renderTabs = () => (
    <div style={styles.tabBar}>
      <button
        onClick={() => setActiveTab("output")}
        style={{
          ...styles.tab,
          ...(activeTab === "output" ? styles.tabActive : {}),
        }}
      >
        <FiTerminal size={14} />
        Output
      </button>
      <button
        onClick={() => setActiveTab("errors")}
        style={{
          ...styles.tab,
          ...(activeTab === "errors" ? styles.tabActive : {}),
          ...(stderrLineCount > 0 && activeTab !== "errors"
            ? { color: "#ef4444" }
            : {}),
        }}
      >
        <FiAlertCircle size={14} />
        Errors
        {stderrLineCount > 0 && (
          <span style={styles.tabBadgeError}>{stderrLineCount}</span>
        )}
      </button>
      <button
        onClick={() => setActiveTab("issues")}
        style={{
          ...styles.tab,
          ...(activeTab === "issues" ? styles.tabActive : {}),
        }}
      >
        <FiFileText size={14} />
        Issues
        {issuesSummary && issuesSummary.total > 0 && (
          <span
            style={
              issuesSummary.errors > 0
                ? styles.tabBadgeError
                : styles.tabBadgeWarning
            }
          >
            {issuesSummary.total}
          </span>
        )}
      </button>
    </div>
  );

  const renderOutputTab = () => {
    const content = logs.stdout;
    if (loading && !content) {
      return (
        <div className="jl-loading">
          <div className="jl-spinner"></div>
          <span>Loading logs...</span>
        </div>
      );
    }
    if (!content) {
      return (
        <div className="jl-empty-state">
          <div className="jl-empty-icon">
            <FiTerminal size={40} />
          </div>
          <div className="jl-empty-title">No output yet</div>
          <div className="jl-empty-desc">
            Logs will appear here when the job starts running
          </div>
        </div>
      );
    }
    return (
      <div className="jl-log-content" style={{ background: "#ffffff" }}>
        <pre style={styles.logPre}>{content}<span ref={logEndRef} /></pre>
      </div>
    );
  };

  const renderErrorsTab = () => {
    const content = logs.stderr;
    if (!content || !content.trim()) {
      return (
        <div className="jl-empty-state success">
          <div className="jl-empty-icon">
            <FiCheckCircle size={40} />
          </div>
          <div className="jl-empty-title">No errors</div>
          <div className="jl-empty-desc">
            No stderr output from this job
          </div>
        </div>
      );
    }
    return (
      <div className="jl-log-content" style={{ background: "#fff5f5" }}>
        <pre style={{ ...styles.logPre, color: "#dc2626", background: "#fff5f5" }}>
          {content}
        </pre>
      </div>
    );
  };

  const renderIssuesTab = () => {
    if (issuesLoading) {
      return (
        <div className="jl-loading">
          <div className="jl-spinner"></div>
          <span>Analyzing logs...</span>
        </div>
      );
    }

    if (!issues || issues.length === 0) {
      return (
        <div className="jl-empty-state success">
          <div className="jl-empty-icon">
            <FiCheckCircle size={40} />
          </div>
          <div className="jl-empty-title">No issues detected</div>
          <div className="jl-empty-desc">
            No errors or warnings found in the log files
          </div>
        </div>
      );
    }

    return (
      <div style={styles.issuesContainer}>
        {/* Summary bar */}
        <div style={styles.issuesSummary}>
          {issuesSummary?.errors > 0 && (
            <span style={styles.summaryChipError}>
              <FiAlertCircle size={12} /> {issuesSummary.errors} error
              {issuesSummary.errors !== 1 ? "s" : ""}
            </span>
          )}
          {issuesSummary?.warnings > 0 && (
            <span style={styles.summaryChipWarning}>
              <FiAlertTriangle size={12} /> {issuesSummary.warnings} warning
              {issuesSummary.warnings !== 1 ? "s" : ""}
            </span>
          )}
          {slurmDetails && (
            <span style={styles.slurmInfo}>
              SLURM: {slurmDetails.state}
              {slurmDetails.exitCode && slurmDetails.exitCode !== "0:0"
                ? ` (exit: ${slurmDetails.exitCode})`
                : ""}
              {slurmDetails.elapsed ? ` · ${slurmDetails.elapsed}` : ""}
              {slurmDetails.maxRSS ? ` · RSS: ${slurmDetails.maxRSS}` : ""}
            </span>
          )}
        </div>

        {/* Issue cards */}
        <div className="jl-issues-list">
          {issues.map((issue, idx) => {
            const isExpanded = expandedIssues.has(idx);
            const isError = issue.severity === "error";
            return (
              <div
                key={idx}
                className={`jl-issue-item ${isError ? "error" : "warning"} ${
                  isExpanded ? "expanded" : ""
                }`}
                onClick={() => toggleIssue(idx)}
              >
                <div className="jl-issue-header">
                  <div
                    className={`jl-issue-severity ${
                      isError ? "error" : "warning"
                    }`}
                  >
                    {isError ? (
                      <FiAlertCircle size={14} />
                    ) : (
                      <FiAlertTriangle size={14} />
                    )}
                  </div>
                  <div className="jl-issue-info">
                    <span className="jl-issue-category">{issue.category}</span>
                    <span
                      className={`jl-issue-source ${
                        issue.source === "stderr"
                          ? "stderr"
                          : "stdout"
                      }`}
                    >
                      {issue.source === "stderr" ? "STDERR" : "STDOUT"}
                    </span>
                    <span className="jl-issue-line">line {issue.line}</span>
                  </div>
                  <div className="jl-issue-expand">
                    <FiChevronDown
                      size={16}
                      style={{
                        transform: isExpanded
                          ? "rotate(180deg)"
                          : "rotate(0deg)",
                        transition: "transform 0.15s ease",
                      }}
                    />
                  </div>
                </div>
                <div className="jl-issue-message">{issue.message}</div>
                {isExpanded && issue.context && (
                  <div className="jl-issue-context">
                    <pre>{issue.context}</pre>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  return (
    <div className="jl-container" style={{ background: "#ffffff" }}>
      {renderJobHeader()}
      {renderErrorBanner()}

      {error && (
        <div className="jl-error-banner">
          <FiAlertCircle size={14} />
          {error}
        </div>
      )}

      {renderTabs()}

      <div className="jl-content" style={{ background: "#ffffff" }}>
        {activeTab === "output" && renderOutputTab()}
        {activeTab === "errors" && renderErrorsTab()}
        {activeTab === "issues" && renderIssuesTab()}
      </div>
    </div>
  );
};

// ─── Inline styles ──────────────────────────────────────────

const styles = {
  header: {
    padding: "14px 18px 10px",
    borderBottom: "1px solid #e2e8f0",
    background: "#f8fafc",
  },
  headerRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    flexWrap: "wrap",
    marginBottom: "6px",
  },
  jobName: {
    fontSize: "14px",
    fontWeight: 700,
    color: "#1e293b",
  },
  dot: {
    color: "#94a3b8",
    fontSize: "14px",
  },
  jobType: {
    fontSize: "13px",
    color: "#64748b",
    fontWeight: 500,
  },
  statusPill: {
    fontSize: "11px",
    fontWeight: 600,
    padding: "2px 8px",
    borderRadius: "12px",
    textTransform: "uppercase",
    letterSpacing: "0.3px",
  },
  slurmBadge: {
    fontSize: "11px",
    color: "#64748b",
    background: "#e2e8f0",
    padding: "2px 8px",
    borderRadius: "4px",
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
  },
  headerMeta: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
    fontSize: "12px",
    color: "#64748b",
  },
  metaItem: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
  },
  copyBtn: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    marginLeft: "auto",
    padding: "4px 10px",
    fontSize: "11px",
    fontWeight: 500,
    color: "#64748b",
    background: "#ffffff",
    border: "1px solid #e2e8f0",
    borderRadius: "6px",
    cursor: "pointer",
  },
  errorBanner: {
    display: "flex",
    alignItems: "flex-start",
    gap: "10px",
    padding: "12px 18px",
    background: "#fef2f2",
    color: "#dc2626",
    fontSize: "13px",
    lineHeight: 1.5,
    borderBottom: "1px solid #fecaca",
  },
  errorBannerText: {
    wordBreak: "break-word",
    flex: 1,
  },
  tabBar: {
    display: "flex",
    alignItems: "center",
    padding: "0 18px",
    background: "#ffffff",
    borderBottom: "1px solid #e2e8f0",
    gap: "0",
  },
  tab: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    padding: "10px 14px",
    background: "transparent",
    border: "none",
    borderBottom: "2px solid transparent",
    color: "#64748b",
    fontSize: "13px",
    fontWeight: 500,
    cursor: "pointer",
    marginBottom: "-1px",
    transition: "color 0.15s ease",
  },
  tabActive: {
    color: "#3b82f6",
    borderBottomColor: "#3b82f6",
    fontWeight: 600,
  },
  tabBadgeError: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "9px",
    fontSize: "10px",
    fontWeight: 600,
    background: "#dc2626",
    color: "#ffffff",
  },
  tabBadgeWarning: {
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    minWidth: "18px",
    height: "18px",
    padding: "0 5px",
    borderRadius: "9px",
    fontSize: "10px",
    fontWeight: 600,
    background: "#f59e0b",
    color: "#ffffff",
  },
  logPre: {
    background: "#ffffff",
    color: "#1e293b",
    margin: 0,
    padding: "16px",
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    fontSize: "13px",
    lineHeight: 1.8,
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  issuesContainer: {
    padding: "0",
  },
  issuesSummary: {
    display: "flex",
    alignItems: "center",
    gap: "10px",
    padding: "12px 18px",
    background: "#f8fafc",
    borderBottom: "1px solid #e2e8f0",
    flexWrap: "wrap",
  },
  summaryChipError: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#dc2626",
    background: "#fef2f2",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  summaryChipWarning: {
    display: "flex",
    alignItems: "center",
    gap: "4px",
    fontSize: "12px",
    fontWeight: 600,
    color: "#d97706",
    background: "#fffbeb",
    padding: "4px 10px",
    borderRadius: "6px",
  },
  slurmInfo: {
    fontSize: "12px",
    color: "#64748b",
    fontFamily: "'JetBrains Mono', 'Consolas', monospace",
    marginLeft: "auto",
  },
};

export default JobLogs;
