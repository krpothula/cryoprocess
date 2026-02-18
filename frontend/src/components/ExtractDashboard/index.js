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
import { getJobProgress } from "../../services/jobs";
import useJobNotification from "../../hooks/useJobNotification";
import useJobProgress from "../../hooks/useJobProgress";

const ExtractDashboard = () => {
  const { selectedJob } = useBuilder();
  const wsProgress = useJobProgress(selectedJob?.id);
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState(null);
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

  // Fetch progress stats (for running jobs)
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;
    try {
      const response = await getJobProgress(selectedJob.id);
      if (response?.data?.success && response?.data?.data && mountedRef.current) {
        setLiveStats(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }, [selectedJob?.id]);

  // Polling for running jobs
  useEffect(() => {
    if (selectedJob?.status === "running") {
      fetchLiveStats();
      const interval = setInterval(() => {
        fetchResults();
        fetchLiveStats();
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchResults, fetchLiveStats]);

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
          Loading particle extraction results...
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

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                Extract/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success" ? "var(--color-success-text)"
                  : status === "failed" ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {status === "success" ? "Success"
                  : status === "running" ? "Running..."
                  : status === "pending" ? "Pending"
                  : status === "failed" ? "Error"
                  : status}
              </p>
            </div>
          </div>
        </div>

        {/* RELION Command Section */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] -mx-4 px-4">
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

      {/* Stats Card — DB only */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particle Stacks:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {liveStats?.processed ?? wsProgress?.particleCount ?? pStats.micrographCount ?? 0}{liveStats?.total ? `/${liveStats.total}` : ""}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.particleCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Avg/Mic:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.micrographCount > 0 ? Math.round((pStats.particleCount ?? 0) / pStats.micrographCount) : 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Rescaled:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {["Yes", "yes", "true", true].includes(params.rescaleParticles) ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.boxSize ?? 0} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCrosshair className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.pixelSize ? `${pStats.pixelSize.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ExtractDashboard;
