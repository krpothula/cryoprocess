import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiImage,
  FiFilm,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiSettings,
  FiLayers,
} from "react-icons/fi";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getPolishResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/polish/results/?job_id=${jobId}`);
};

const PolishDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getPolishResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load polishing results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
    }
  }, [selectedJob?.id, fetchResults]);

  useEffect(() => {
    if (selectedJob?.status === "running") {
      const interval = setInterval(() => {
        fetchResults();
      }, 15000);
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
          Loading polishing results...
        </p>
      </div>
    );
  }

  if (error) {
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
                Polish/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success-text)"
                  : selectedJob?.status === "error"
                  ? "var(--color-danger-text)"
                  : selectedJob?.status === "running"
                  ? "var(--color-warning-text)"
                  : "var(--color-warning-text)"
              }}>
                {selectedJob?.status === "success"
                  ? "Success"
                  : selectedJob?.status === "running"
                  ? "Running..."
                  : selectedJob?.status === "pending"
                  ? "Pending"
                  : selectedJob?.status === "error"
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
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiImage className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.particles_polished?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilm className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.micrographs_processed || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Frames:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.first_frame || 1} - {results?.last_frame === -1 ? "All" : results?.last_frame}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: results?.has_output ? "var(--color-success-text)" : "var(--color-text-heading)" }}>
              {results?.has_output ? "Ready" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Motion Parameters */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiSettings className="text-blue-500" />
          Motion Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-[var(--color-bg)] rounded-lg p-4">
            <span className="text-sm text-[var(--color-text-secondary)]">Sigma Velocity</span>
            <p className="text-xl font-bold text-[var(--color-text-heading)] mt-1">
              {results?.sigma_velocity || 0.2}
            </p>
          </div>
          <div className="bg-[var(--color-bg)] rounded-lg p-4">
            <span className="text-sm text-[var(--color-text-secondary)]">Sigma Divergence</span>
            <p className="text-xl font-bold text-[var(--color-text-heading)] mt-1">
              {results?.sigma_divergence || 5000}
            </p>
          </div>
          <div className="bg-[var(--color-bg)] rounded-lg p-4">
            <span className="text-sm text-[var(--color-text-secondary)]">Sigma Acceleration</span>
            <p className="text-xl font-bold text-[var(--color-text-heading)] mt-1">
              {results?.sigma_acceleration || 2}
            </p>
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiActivity className="text-green-500" />
          Job Status
        </h3>
        <div className="flex items-center gap-4">
          {results?.has_output ? (
            <div className="flex items-center gap-2 text-green-600">
              <FiCheckCircle />
              <span>Polished particles available at: <code className="text-sm bg-[var(--color-bg-hover)] px-2 py-1 rounded">{results?.output_dir}/shiny.star</code></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <FiClock />
              <span>Waiting for output...</span>
            </div>
          )}
          <button
            onClick={fetchResults}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
          >
            <FiRefreshCw />
            Refresh
          </button>
        </div>
      </div>
    </div>
  );
};

export default PolishDashboard;
