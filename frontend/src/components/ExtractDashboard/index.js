import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getExtractResultsApi,
} from "../../services/builders/particle-extraction/particle-extraction";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiLayers,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiBox,
  FiCircle,
  FiMaximize2,
  FiCrosshair,
} from "react-icons/fi";
import useJobNotification from "../../hooks/useJobNotification";

const ExtractDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Copy command to clipboard
  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
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
      const response = await getExtractResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      // Don't show error if job is still running/pending
      if (selectedJob?.status !== "running" && selectedJob?.status !== "pending") {
        setError("Failed to load particle extraction results");
      }
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id, selectedJob?.status]);

  // Initial load
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
    }
  }, [selectedJob?.id, fetchResults]);

  // Polling for running jobs
  useEffect(() => {
    if (selectedJob?.status === "running") {
      const interval = setInterval(() => {
        fetchResults();
      }, 10000); // Poll every 10 seconds

      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchResults]);

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
        <p className="text-lg text-black dark:text-slate-100 font-medium mt-4">
          Loading particle extraction results...
        </p>
      </div>
    );
  }

  // Show error only if job is not running/pending
  const isJobInProgress = selectedJob?.status === "running" || selectedJob?.status === "pending";
  if (error && !isJobInProgress) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-red-50 m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-red-600 font-medium mt-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                Extract/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success-text)"
                  : selectedJob?.status === "failed"
                  ? "var(--color-danger-text)"
                  : selectedJob?.status === "running"
                  ? "var(--color-warning)"
                  : "var(--color-warning)"
              }}>
                {selectedJob?.status === "success"
                  ? "Success"
                  : selectedJob?.status === "running"
                  ? "Running..."
                  : selectedJob?.status === "pending"
                  ? "Pending"
                  : selectedJob?.status === "failed"
                  ? "Error"
                  : selectedJob?.status}
              </p>
            </div>
          </div>
        </div>

        {/* RELION Command Section */}
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 -mx-4 px-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-[var(--color-bg)] rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-[var(--color-text-muted)]" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-[var(--color-text-muted)]" size={12} />
              ) : (
                <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />
              )}
            </button>
            {showCommand && selectedJob?.command && (
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
              {selectedJob?.command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      {(() => {
        const stats = selectedJob?.pipeline_stats || {};
        return (
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.micrograph_count || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-success-text)" }}>
              {(stats.particle_count || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.box_size || 0} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Avg/Mic:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.micrograph_count > 0 ? Math.round((stats.particle_count || 0) / stats.micrograph_count) : 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Rescaled:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.rescaled_size ? `${stats.rescaled_size} px` : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCrosshair className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.pixel_size ? `${stats.pixel_size.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
        </div>
      </div>
        );
      })()}

    </div>
  );
};

export default ExtractDashboard;
