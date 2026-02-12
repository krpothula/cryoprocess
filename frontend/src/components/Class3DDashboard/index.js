import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiBox,
  FiLayers,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiRotateCw,
  FiMaximize2,
  FiTarget,
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getClass3DResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/class3d/results/?job_id=${jobId}`);
};

const getClass3DLiveStatsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/class3d/live-stats/?job_id=${jobId}`);
};

const Class3DDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState("latest");
  const [selectedClass, setSelectedClass] = useState(1);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const handleDownload = () => {
    const iter = selectedIteration === "latest" ? currentIteration : selectedIteration;
    const mrcPath = selectedIteration === "latest"
      ? (selectedClass === 1 ? results?.latest_mrc_path : results?.iterations?.find(it => it.iteration === currentIteration && it.class === selectedClass)?.file)
      : results?.iterations?.find(it => it.iteration === parseInt(selectedIteration) && it.class === selectedClass)?.file;

    let url;
    if (mrcPath) {
      url = `${API_BASE_URL}/class3d/mrc/?file_path=${encodeURIComponent(mrcPath)}`;
    } else {
      url = `${API_BASE_URL}/class3d/mrc/?job_id=${selectedJob?.id}&iteration=${iter}&class=${selectedClass}`;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.job_name || 'class3d'}_it${String(iter).padStart(3, '0')}_class${String(selectedClass).padStart(3, '0')}.mrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
      const response = await getClass3DResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      // Don't show error if job is running/pending
      if (selectedJob?.status !== "running" && selectedJob?.status !== "pending") {
        setError("Failed to load 3D classification results");
      }
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id, selectedJob?.status]);

  // Fetch live stats for running jobs
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getClass3DLiveStatsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success" && response?.data?.data) {
        setLiveStats(response.data.data);

        // If job just completed, refresh results
        if (response.data.data.job_status === "success" && selectedJob?.status === "running") {
          fetchResults();
        }
      }
    } catch (err) {
      console.error("Error fetching live stats:", err);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Initial load
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
      fetchLiveStats();
    }
  }, [selectedJob?.id, fetchResults, fetchLiveStats]);

  // Polling for running jobs - every 5 seconds
  useEffect(() => {
    if (selectedJob?.status === "running") {
      const interval = setInterval(() => {
        fetchLiveStats();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchLiveStats]);

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

  const handleIterationChange = (e) => {
    setSelectedIteration(e.target.value);
  };

  const handleClassChange = (e) => {
    setSelectedClass(parseInt(e.target.value));
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black dark:text-slate-100 font-medium mt-4">
          Loading 3D classification results...
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

  // Get stats from job parameters with fallback to results
  const numClasses = selectedJob?.parameters?.numberOfClasses || selectedJob?.parameters?.numberClasses || results?.num_classes || 1;
  const symmetry = selectedJob?.parameters?.symmetry || results?.symmetry || "C1";
  const maskDiameter = selectedJob?.parameters?.maskDiameter || selectedJob?.parameters?.particleDiameter || results?.mask_diameter || 200;
  const totalIterations = selectedJob?.parameters?.numberOfIterations || selectedJob?.parameters?.numberIterations || results?.total_iterations || 25;
  const currentIteration = liveStats?.current_iteration ?? results?.latest_iteration ?? 0;
  const particleCount = selectedJob?.pipeline_stats?.particle_count || 0;

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                Class3D/{selectedJob?.job_name || "Job"}
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
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Iterations:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: selectedJob?.status === "running" ? "var(--color-warning-text)" : "var(--color-text-heading)" }}>
              {currentIteration}/{totalIterations}
            </span>
            {selectedJob?.status === "running" && liveStats?.progress_percent && (
              <span style={{ fontSize: "11px", color: "var(--color-warning-text)" }}>
                ({liveStats.progress_percent}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Classes:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {numClasses}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiRotateCw className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Symmetry:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {symmetry}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Mask:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {maskDiameter} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {particleCount > 0 ? particleCount.toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Model Visualization with Molstar */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          {/* Iteration and Class Selector */}
          <div className="flex items-center gap-3">
            {(results?.unique_iterations?.length > 0 || currentIteration > 0) && (
              <select
                value={selectedIteration}
                onChange={handleIterationChange}
                className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-blue-300"
                style={{ fontSize: "12px" }}
              >
                <option value="latest">Latest (Iteration {currentIteration})</option>
                {results?.unique_iterations?.map((it) => (
                  <option key={it} value={it}>
                    Iteration {it}
                  </option>
                ))}
              </select>
            )}

            {numClasses >= 1 && (
              <select
                value={selectedClass}
                onChange={handleClassChange}
                className="px-3 py-1 border border-blue-300 rounded-lg focus:outline-none focus:border-blue-500 bg-blue-50 font-medium"
                style={{ fontSize: "12px" }}
              >
                {Array.from({ length: numClasses }, (_, i) => i + 1).map((cls) => (
                  <option key={cls} value={cls}>
                    Class {cls}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {currentIteration > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                style={{ fontSize: "12px" }}
                title={`Download Class ${selectedClass} volume (.mrc)`}
              >
                <FiDownload size={13} />
                Download
              </button>
            )}
          </div>
        </div>

        {/* Molstar Viewer */}
        {currentIteration > 0 ? (
          <MolstarViewer
            key={`${selectedJob?.id}-${selectedIteration}-${selectedClass}`}
            jobId={selectedJob?.id}
            iteration={selectedIteration}
            classNum={selectedClass}
            apiEndpoint="/class3d/mrc/"
            isoValue={1.5}
            mrcFilePath={
              selectedIteration === "latest"
                ? (selectedClass === 1 ? results?.latest_mrc_path : results?.iterations?.find(it => it.iteration === currentIteration && it.class === selectedClass)?.file)
                : results?.iterations?.find(it => it.iteration === parseInt(selectedIteration) && it.class === selectedClass)?.file
            }
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No 3D Classes Yet</p>
            <p className="text-sm text-center mt-2">
              The 3D class maps will appear here once the first iteration completes.
              {selectedJob?.status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default Class3DDashboard;
