import React, { useState, useEffect, useMemo } from "react";
import { FiX, FiLoader } from "react-icons/fi";
import { getJobDetailsApi, getJobsApi } from "../../services/builders/jobs";
import { useBuilder } from "../../context/BuilderContext";

// Parameters to hide from comparison (not meaningful to users)
const HIDDEN_PARAMS = ["projectId"];

// Convert camelCase/PascalCase key to readable label
// e.g. "writeFOMMaps" → "Write FOM Maps", "lowpassFilterReference" → "Lowpass Filter Reference"
const formatKey = (key) => {
  return key
    .replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
};

const formatValue = (val) => {
  if (val === undefined || val === null) return "\u2014";
  if (val === "") return '""';
  if (typeof val === "boolean") return val ? "Yes" : "No";
  if (typeof val === "object") return JSON.stringify(val);
  return String(val);
};

const JobComparisonModal = ({ jobId, jobName, jobType, onClose }) => {
  const { projectId } = useBuilder();
  const [baseJob, setBaseJob] = useState(null);
  const [compareJob, setCompareJob] = useState(null);
  const [sameTypeJobs, setSameTypeJobs] = useState([]);
  const [selectedCompareJobId, setSelectedCompareJobId] = useState("");
  const [isLoadingBase, setLoadingBase] = useState(true);
  const [isLoadingCompare, setLoadingCompare] = useState(false);
  const [isLoadingJobs, setLoadingJobs] = useState(true);
  const [error, setError] = useState("");
  const [showOnlyDiffs, setShowOnlyDiffs] = useState(false);

  // Fetch base job parameters
  useEffect(() => {
    setLoadingBase(true);
    getJobDetailsApi(jobId)
      .then((res) => {
        if (res?.data?.status === "success") {
          setBaseJob(res.data.data);
        } else {
          setError("Failed to load job parameters");
        }
      })
      .catch((err) => setError(err.message || "Failed to load job"))
      .finally(() => setLoadingBase(false));
  }, [jobId]);

  // Fetch all jobs for project, filter by same type
  useEffect(() => {
    setLoadingJobs(true);
    getJobsApi(projectId, 0, 1000)
      .then((res) => {
        const allJobs = res?.data?.data || [];
        const filtered = allJobs.filter(
          (j) => j.jobType === jobType && j.id !== jobId
        );
        setSameTypeJobs(filtered);
      })
      .catch(() => setSameTypeJobs([]))
      .finally(() => setLoadingJobs(false));
  }, [projectId, jobType, jobId]);

  // Fetch compare job parameters when selected
  useEffect(() => {
    if (!selectedCompareJobId) {
      setCompareJob(null);
      return;
    }
    setLoadingCompare(true);
    setError("");
    getJobDetailsApi(selectedCompareJobId)
      .then((res) => {
        if (res?.data?.status === "success") {
          setCompareJob(res.data.data);
        }
      })
      .catch(() => setError("Failed to load comparison job"))
      .finally(() => setLoadingCompare(false));
  }, [selectedCompareJobId]);

  // Merge all parameter keys from both jobs
  const paramRows = useMemo(() => {
    const baseParams = baseJob?.parameters || {};
    const compareParams = compareJob?.parameters || {};
    const allKeys = [
      ...new Set([...Object.keys(baseParams), ...Object.keys(compareParams)]),
    ].filter((k) => !HIDDEN_PARAMS.includes(k));

    allKeys.sort();

    return allKeys.map((key) => {
      const baseVal = baseParams[key];
      const compVal = compareParams[key];
      const isDiff =
        compareJob && String(baseVal ?? "") !== String(compVal ?? "");
      return { key, baseVal, compVal, isDiff };
    });
  }, [baseJob, compareJob]);

  const filteredRows = showOnlyDiffs
    ? paramRows.filter((r) => r.isDiff)
    : paramRows;

  const diffCount = paramRows.filter((r) => r.isDiff).length;

  const compareJobName = sameTypeJobs.find(
    (j) => j.id === selectedCompareJobId
  )?.jobName;

  return (
    <div style={S.overlay} onClick={onClose}>
      <div style={S.modal} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Compare Job Parameters</h2>
            <span style={S.subtitle}>
              See what changed between two runs
            </span>
          </div>
          <button onClick={onClose} style={S.closeBtn}>
            <FiX size={18} />
          </button>
        </div>

        {/* Job selectors */}
        <div style={S.selectorBar}>
          <div style={S.selectorCol}>
            <label style={S.selectorLabel}>Base Job</label>
            <div style={S.selectorValue}>
              <span style={S.jobBadge}>{jobName}</span>
              {baseJob && (
                <span style={statusBadgeStyle(baseJob.status)}>
                  {baseJob.status}
                </span>
              )}
            </div>
          </div>
          <div style={S.vsCircle}>vs</div>
          <div style={S.selectorCol}>
            <label style={S.selectorLabel}>Compare With</label>
            {isLoadingJobs ? (
              <FiLoader
                size={14}
                style={{ animation: "spin 1s linear infinite" }}
              />
            ) : sameTypeJobs.length === 0 ? (
              <span style={{ fontSize: 12, color: "var(--color-text-muted)" }}>
                No other {jobType} jobs to compare
              </span>
            ) : (
              <select
                value={selectedCompareJobId}
                onChange={(e) => setSelectedCompareJobId(e.target.value)}
                style={S.select}
              >
                <option value="">Select a job...</option>
                {sameTypeJobs.map((j) => (
                  <option key={j.id} value={j.id}>
                    {j.jobName} \u2014 {j.status}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>

        {/* Diff toggle */}
        {compareJob && (
          <div style={S.filterBar}>
            <label style={S.filterLabel}>
              <input
                type="checkbox"
                checked={showOnlyDiffs}
                onChange={(e) => setShowOnlyDiffs(e.target.checked)}
                style={{ marginRight: 6 }}
              />
              Show only differences
            </label>
            <span
              style={{
                ...S.diffBadge,
                ...(diffCount === 0 ? S.diffBadgeZero : {}),
              }}
            >
              {diffCount === 0
                ? "Identical"
                : `${diffCount} difference${diffCount !== 1 ? "s" : ""}`}
            </span>
          </div>
        )}

        {error && <div style={S.errorBar}>{error}</div>}

        {/* Parameter table */}
        <div style={S.tableWrap}>
          <div style={S.tableHeader}>
            <span style={{ flex: 2 }}>Parameter</span>
            <span style={{ flex: 2, textAlign: "center" }}>{jobName}</span>
            <span style={{ flex: 2, textAlign: "center" }}>
              {compareJobName || "\u2014"}
            </span>
          </div>
          <div style={S.tableBody}>
            {isLoadingBase || isLoadingCompare ? (
              <div style={S.emptyState}>
                <FiLoader
                  size={16}
                  style={{ animation: "spin 1s linear infinite" }}
                />
                <span>Loading parameters...</span>
              </div>
            ) : filteredRows.length === 0 ? (
              <div style={S.emptyState}>
                <span style={{ color: "var(--color-text-muted)" }}>
                  {showOnlyDiffs
                    ? "No differences \u2014 parameters are identical"
                    : compareJob
                    ? "No parameters found"
                    : "Select a job to compare"}
                </span>
              </div>
            ) : (
              filteredRows.map((row) => (
                <div
                  key={row.key}
                  style={{
                    ...S.row,
                    ...(row.isDiff ? S.rowDiff : {}),
                  }}
                >
                  <span style={S.paramName}>{formatKey(row.key)}</span>
                  <span style={S.paramValue}>
                    {formatValue(row.baseVal)}
                  </span>
                  <span
                    style={{
                      ...S.paramValue,
                      ...(row.isDiff ? S.paramValueChanged : {}),
                    }}
                  >
                    {compareJob ? formatValue(row.compVal) : "\u2014"}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Footer */}
        <div style={S.footer}>
          <span style={{ fontSize: 11, color: "var(--color-text-muted)" }}>
            {paramRows.length} total parameter{paramRows.length !== 1 ? "s" : ""}
            {compareJob ? ` \u00b7 ${diffCount} different` : ""}
          </span>
          <button onClick={onClose} style={S.doneBtn}>
            Done
          </button>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );
};

// Dynamic status badge style
const statusBadgeStyle = (status) => ({
  fontSize: 10,
  fontWeight: 600,
  textTransform: "uppercase",
  letterSpacing: 0.5,
  padding: "2px 8px",
  borderRadius: 10,
  color:
    status === "success"
      ? "var(--color-success-text)"
      : status === "failed"
      ? "var(--color-danger-text)"
      : "var(--color-warning-text)",
  background:
    status === "success"
      ? "var(--color-success-bg)"
      : status === "failed"
      ? "var(--color-danger-bg)"
      : "var(--color-warning-bg)",
});

// Styles (following FolderBrowserPopup pattern)
const S = {
  overlay: {
    position: "fixed",
    inset: 0,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "var(--color-bg-overlay)",
    backdropFilter: "blur(4px)",
    zIndex: 50,
  },
  modal: {
    background: "var(--color-bg-card)",
    width: "min(960px, 92vw)",
    height: "min(680px, 88vh)",
    borderRadius: 16,
    boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
    display: "flex",
    flexDirection: "column",
    overflow: "hidden",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "16px 24px",
    borderBottom: "1px solid var(--color-border-light)",
  },
  title: { margin: 0, fontSize: 16, fontWeight: 600, color: "var(--color-text-heading)" },
  subtitle: { fontSize: 12, color: "var(--color-text-muted)", marginTop: 2 },
  closeBtn: {
    width: 32,
    height: 32,
    borderRadius: 8,
    border: "none",
    background: "transparent",
    color: "var(--color-text-muted)",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  },
  selectorBar: {
    display: "flex",
    alignItems: "center",
    gap: 16,
    padding: "16px 24px",
    borderBottom: "1px solid var(--color-border-light)",
    background: "var(--color-bg)",
  },
  selectorCol: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    gap: 6,
  },
  selectorLabel: {
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  selectorValue: {
    display: "flex",
    alignItems: "center",
    gap: 8,
  },
  jobBadge: {
    fontSize: 13,
    fontWeight: 600,
    color: "var(--color-text)",
    padding: "4px 10px",
    background: "var(--color-bg-hover)",
    borderRadius: 6,
  },
  vsCircle: {
    width: 32,
    height: 32,
    borderRadius: "50%",
    background: "var(--color-border)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: 11,
    fontWeight: 700,
    color: "var(--color-text-secondary)",
    flexShrink: 0,
  },
  select: {
    padding: "6px 10px",
    fontSize: 13,
    border: "1px solid var(--color-border)",
    borderRadius: 8,
    background: "var(--color-bg-card)",
    color: "var(--color-text)",
    cursor: "pointer",
    width: "100%",
    outline: "none",
  },
  filterBar: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "10px 24px",
    borderBottom: "1px solid var(--color-border-light)",
  },
  filterLabel: {
    fontSize: 13,
    color: "var(--color-text-secondary)",
    display: "flex",
    alignItems: "center",
    cursor: "pointer",
  },
  diffBadge: {
    fontSize: 12,
    fontWeight: 600,
    color: "var(--color-warning)",
    padding: "2px 10px",
    background: "var(--color-warning-bg)",
    borderRadius: 10,
  },
  diffBadgeZero: {
    color: "var(--color-success)",
    background: "var(--color-success-bg)",
  },
  errorBar: {
    margin: "12px 24px 0",
    fontSize: 12,
    color: "var(--color-danger-text)",
    background: "var(--color-danger-bg)",
    padding: "8px 12px",
    borderRadius: 8,
    border: "1px solid var(--color-danger)",
  },
  tableWrap: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    margin: "12px 24px 0",
    border: "1px solid var(--color-border)",
    borderRadius: 10,
    overflow: "hidden",
    minHeight: 0,
  },
  tableHeader: {
    display: "flex",
    alignItems: "center",
    padding: "10px 16px",
    background: "var(--color-bg)",
    borderBottom: "1px solid var(--color-border)",
    fontSize: 11,
    fontWeight: 600,
    color: "var(--color-text-secondary)",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    flexShrink: 0,
    gap: 8,
  },
  tableBody: { flex: 1, overflowY: "auto", minHeight: 0 },
  row: {
    display: "flex",
    alignItems: "center",
    padding: "8px 16px",
    gap: 8,
    borderBottom: "1px solid var(--color-bg)",
    fontSize: 13,
  },
  rowDiff: {
    background: "var(--color-warning-bg)",
    borderLeft: "3px solid var(--color-warning)",
  },
  paramName: {
    flex: 2,
    fontWeight: 500,
    color: "var(--color-text)",
    fontSize: 12,
  },
  paramValue: {
    flex: 2,
    textAlign: "center",
    color: "var(--color-text-secondary)",
    fontSize: 12,
    fontFamily: "monospace",
    wordBreak: "break-all",
  },
  paramValueChanged: {
    color: "var(--color-warning-text)",
    fontWeight: 600,
  },
  emptyState: {
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    height: 120,
    color: "var(--color-text-secondary)",
    fontSize: 13,
  },
  footer: {
    padding: "12px 24px",
    borderTop: "1px solid var(--color-border-light)",
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  doneBtn: {
    padding: "8px 20px",
    borderRadius: 8,
    border: "none",
    background: "var(--color-primary)",
    color: "#fff",
    fontSize: 13,
    fontWeight: 500,
    cursor: "pointer",
  },
};

export default JobComparisonModal;
