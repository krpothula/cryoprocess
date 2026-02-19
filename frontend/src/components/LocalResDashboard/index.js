import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiBox,
  FiTarget,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiImage,
  FiZap,
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getLocalResResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/localres/results/?jobId=${jobId}`);
};

// Continuous gradient color scale legend for resolution values
const ResolutionColorScale = ({ minRes, maxRes }) => (
  <div className="flex items-center gap-1.5" style={{ fontSize: "10px" }}>
    <span className="text-[var(--color-text-secondary)] font-medium">{minRes?.toFixed(1) || "?"} Å</span>
    <div
      className="rounded overflow-hidden"
      style={{
        width: "100px",
        height: "10px",
        background: "linear-gradient(to right, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF0000)",
      }}
    />
    <span className="text-[var(--color-text-secondary)] font-medium">{maxRes?.toFixed(1) || "?"} Å</span>
  </div>
);

const LocalResDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [colorMode, setColorMode] = useState("colored"); // "colored" (resolution-colored) or "uniform"
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const handleDownload = (type) => {
    const url = `${API_BASE_URL}/localres/mrc/?type=${type}&jobId=${selectedJob?.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.jobName || 'localres'}_${type}.mrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
      const response = await getLocalResResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load local resolution results");
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
        return <FiClock className="text-slate-400 text-xl" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading local resolution results...
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

  // The filtered map is the actual density - we color it using values from the locres map
  const hasFilteredMap = results?.hasLocresFiltered;
  const hasLocresMap = results?.hasLocresMap;

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                LocalRes/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success"
                  ? "var(--color-success-text)"
                  : status === "failed"
                  ? "var(--color-danger-text)"
                  : status === "pending"
                  ? "var(--color-text-muted)"
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

      {/* Stats Card */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Mean Resolution:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.resolution ? `${pStats.resolution.toFixed(2)} Å` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiZap className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>B-factor:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.bfactor != null ? `${pStats.bfactor} Å²` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiImage className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.pixelSize ? `${pStats.pixelSize} Å` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Visualization - Filtered Map with Resolution Coloring */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
              <FiBox className="text-blue-500" size={13} />
              Volume Viewer
            </h3>

            {/* Continuous resolution color scale legend */}
            {colorMode === "colored" && hasLocresMap && results?.minResolution && results?.maxResolution && (
              <ResolutionColorScale
                minRes={results.minResolution}
                maxRes={results.maxResolution}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Color mode toggle buttons */}
            {hasFilteredMap && hasLocresMap && (
              <div className="flex items-center bg-[var(--color-bg-hover)] rounded-md p-0.5">
                <button
                  onClick={() => setColorMode("colored")}
                  className={`px-3 py-1 rounded transition-all ${
                    colorMode === "colored"
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)]"
                  }`}
                  style={{ fontSize: "12px", fontWeight: 500 }}
                >
                  Resolution Colored
                </button>
                <button
                  onClick={() => setColorMode("uniform")}
                  className={`px-3 py-1 rounded transition-all ${
                    colorMode === "uniform"
                      ? "bg-[var(--color-primary)] text-white shadow-sm"
                      : "bg-[var(--color-bg-card)] text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)]"
                  }`}
                  style={{ fontSize: "12px", fontWeight: 500 }}
                >
                  Uniform Color
                </button>
              </div>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {(hasFilteredMap || hasLocresMap) && (
              <button
                onClick={() => handleDownload(hasFilteredMap ? "filtered" : "locres")}
                className="flex items-center gap-1 px-3 py-1 bg-[var(--color-info-bg)] hover:bg-[var(--color-info-bg)] text-[var(--color-info-text)] rounded-lg transition-colors"
                style={{ fontSize: "12px" }}
                title="Download local resolution map (.mrc)"
              >
                <FiDownload size={13} />
                Download
              </button>
            )}
          </div>
        </div>

        {/* MolstarViewer - filtered map for surface, locres map for resolution coloring */}
        {(hasFilteredMap || hasLocresMap) ? (
          <div className="border-b border-[var(--color-border)] overflow-hidden">
            <div className="h-[550px]">
              <MolstarViewer
                key={`${selectedJob?.id}-${colorMode}`}
                jobId={selectedJob?.id}
                iteration="latest"
                classNum={1}
                apiEndpoint={hasFilteredMap ? "/localres/mrc/?type=filtered" : "/localres/mrc/?type=locres"}
                colorByResolution={colorMode === "colored" && hasLocresMap}
                colorVolumeEndpoint={colorMode === "colored" && hasLocresMap ? "/localres/mrc/?type=locres" : null}
                minResolution={results?.minResolution ?? null}
                maxResolution={results?.maxResolution ?? null}
              />
            </div>
          </div>
        ) : (
          /* No maps available */
          <div className="h-[500px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Local Resolution Map Yet</p>
            <p className="text-sm text-center mt-2">
              The local resolution map will appear here once calculation completes.
              {status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}

      </div>

    </div>
  );
};

export default LocalResDashboard;
