import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { getLinkMoviesResultsApi } from "../../services/builders/link-movies/link-movies";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiLink,
  FiFile,
  FiFolder,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
} from "react-icons/fi";
import useJobNotification from "../../hooks/useJobNotification";

const LinkMoviesDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Copy command to clipboard
  const copyCommand = () => {
    if (command) {
      navigator.clipboard.writeText(command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Fetch results
  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getLinkMoviesResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load Link Movies results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  // Initial load and polling
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();

      // Poll for updates if job is running/pending
      const interval = setInterval(() => {
        if (selectedJob?.status === "running" || selectedJob?.status === "pending") {
          fetchResults();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Trigger immediate fetch on WebSocket job_update (supplements polling)
  useJobNotification(selectedJob?.id, fetchResults);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-amber-500 text-xl animate-pulse" />;
      case "failed":
      case "error":
        return <FiAlertCircle className="text-red-500 text-xl" />;
      default:
        return <FiClock className="text-yellow-500 text-xl" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading Link Movies results...
        </p>
      </div>
    );
  }

  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  if (error && status !== "running" && status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-[var(--color-danger-bg)] m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-[var(--color-danger-text)] font-medium mt-4">{error}</p>
      </div>
    );
  }

  const linkedCount = pStats.movieCount ?? results?.linkedCount ?? 0;
  const linkedFiles = results?.linkedFiles || [];
  const summary = results?.summary || {};

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status || results?.jobStatus)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                Import/{selectedJob?.jobName || results?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success"
                  ? "var(--color-success-text)"
                  : status === "failed"
                  ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {status === "success"
                  ? "Success"
                  : status === "running"
                  ? "Running..."
                  : status === "pending"
                  ? "Pending"
                  : status === "failed"
                  ? "Error"
                  : status || results?.jobStatus}
              </p>
            </div>
          </div>
        </div>

        {/* Command Section */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] -mx-4 px-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-[var(--color-bg)] rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-[var(--color-text-muted)]" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>Shell Script</span>
              {showCommand ? (
                <FiChevronUp className="text-[var(--color-text-muted)]" size={12} />
              ) : (
                <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />
              )}
            </button>
            {showCommand && command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-[var(--color-text-muted)]" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "var(--color-success-text)" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.4'
              }}
            >
              {command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLink className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Files Linked:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {linkedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFolder className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Destination:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }} title={results?.destinationFolder}>
              {results?.destinationFolder?.split("/").slice(-2).join("/") || "Movies"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiExternalLink className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Link Type:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {summary["Link Type"] || "Symlink"}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Files List */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiFile className="text-blue-500" />
          Linked Files ({linkedFiles.length})
        </h3>

        {linkedFiles.length === 0 ? (
          <div className="text-center py-8 text-[var(--color-text-muted)]">
            <FiFile className="text-4xl mx-auto mb-2" />
            <p>No files linked yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-[var(--color-bg)] sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-[var(--color-text-secondary)]">Name</th>
                  <th className="text-left p-2 font-medium text-[var(--color-text-secondary)]">Type</th>
                  <th className="text-left p-2 font-medium text-[var(--color-text-secondary)]">Target</th>
                </tr>
              </thead>
              <tbody>
                {linkedFiles.map((file, idx) => (
                  <tr key={idx} className="border-t border-[var(--color-border)] hover:bg-[var(--color-bg-hover)]">
                    <td className="p-2 flex items-center gap-2">
                      <FiFile className="text-[var(--color-text-muted)]" />
                      <span className="truncate max-w-[200px]" title={file.name}>
                        {file.name}
                      </span>
                    </td>
                    <td className="p-2">
                      {file.isSymlink ? (
                        <span className="text-blue-600 flex items-center gap-1">
                          <FiExternalLink className="text-xs" />
                          Symlink
                        </span>
                      ) : (
                        <span className="text-green-600">Copy</span>
                      )}
                    </td>
                    <td className="p-2 text-[var(--color-text-secondary)] truncate max-w-[300px]" title={file.target}>
                      {file.target || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkMoviesDashboard;
