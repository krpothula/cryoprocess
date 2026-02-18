import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getInitialModelResultsApi,
  getInitialModelLiveStatsApi,
} from "../../services/builders/3d-initialmodel/3d-initialmodel";
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
  FiCircle,
  FiGrid,
  FiCrosshair,
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "./MolstarViewer";
import useJobNotification from "../../hooks/useJobNotification";
import useJobProgress from "../../hooks/useJobProgress";

const InitialModelDashboard = () => {
  const { selectedJob } = useBuilder();
  const wsProgress = useJobProgress(selectedJob?.id);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState("latest");
  const [selectedClass, setSelectedClass] = useState(1);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

  const handleDownload = () => {
    const mrcPath = getSelectedMrcPath();
    let url;
    if (mrcPath) {
      url = `${API_BASE_URL}/initialmodel/mrc/?file_path=${encodeURIComponent(mrcPath)}`;
    } else {
      const iter = selectedIteration === "latest" ? (results?.latestIteration || "") : selectedIteration;
      url = `${API_BASE_URL}/initialmodel/mrc/?job_id=${selectedJob?.id}&iteration=${iter}&class=${selectedClass}`;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.jobName || 'inimodel'}_class${String(selectedClass).padStart(3, '0')}.mrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

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
      const response = await getInitialModelResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load 3D initial model results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  // Fetch live stats for running jobs
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getInitialModelLiveStatsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success" && response?.data?.data) {
        setLiveStats(response.data.data);

        // If job just completed, refresh full results
        if (response.data.data.jobStatus === "success" && selectedJob?.status === "running") {
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

  // Get available classes for the selected iteration
  const getClassesForIteration = () => {
    if (!results?.iterations) return [];
    const targetIter = selectedIteration === "latest"
      ? results.latestIteration
      : parseInt(selectedIteration);
    const classes = results.iterations
      .filter(it => it.iteration === targetIter)
      .map(it => it.class);
    return [...new Set(classes)].sort((a, b) => a - b);
  };

  // Get the MRC file path for selected iteration and class
  const getSelectedMrcPath = () => {
    if (!results?.iterations) return null;
    const targetIter = selectedIteration === "latest"
      ? results.latestIteration
      : parseInt(selectedIteration);
    const match = results.iterations.find(
      it => it.iteration === targetIter && it.class === selectedClass
    );
    return match?.filePath || null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading 3D initial model results...
        </p>
      </div>
    );
  }

  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  const totalIterations = liveStats?.totalIterations ?? params.numberOfVdam ?? pStats.totalIterations ?? 200;
  const currentIteration = liveStats?.currentIteration ?? wsProgress?.iterationCount ?? pStats.iterationCount ?? 0;

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
                InitialModel/{selectedJob?.jobName || "Job"}
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

      {/* Stats Card - Two Rows with aligned columns */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        {/* Row 1: Iteration, Classes, Particles, Micrographs */}
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Iteration:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: status === "running" ? "var(--color-warning)" : "var(--color-text-heading)" }}>
              {currentIteration}/{totalIterations}
            </span>
            {status === "running" && liveStats?.progressPercent > 0 && (
              <span style={{ fontSize: "11px", color: "var(--color-warning)" }}>
                ({liveStats.progressPercent}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Classes:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.numberOfClasses ?? pStats.classCount ?? 1}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.particleCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.micrographCount ?? 0}
            </span>
          </div>
        </div>
        {/* Row 2: Pixel Size, Box Size, Mask, Symmetry */}
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <FiCrosshair className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.pixelSize ? `${pStats.pixelSize.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.boxSize ?? 0} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Mask:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.maskDiameter ?? pStats.maskDiameter ?? 0} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiRotateCw className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Symmetry:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.symmetry ?? pStats.symmetry ?? "C1"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Model Visualization with Molstar */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          {/* Iteration and Class Selectors */}
          <div className="flex items-center gap-3">
            {results?.uniqueIterations?.length > 0 && (
              <>
                <select
                  value={selectedIteration}
                  onChange={handleIterationChange}
                  className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                  style={{ fontSize: "12px" }}
                >
                  <option value="latest">Latest (Iteration {results.latestIteration})</option>
                  {results.uniqueIterations.map((it) => (
                    <option key={it} value={it}>
                      Iteration {it}
                    </option>
                  ))}
                </select>

                {/* Class Selector - only show if multiple classes */}
                {getClassesForIteration().length > 1 && (
                  <select
                    value={selectedClass}
                    onChange={handleClassChange}
                    className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                    style={{ fontSize: "12px" }}
                  >
                    {getClassesForIteration().map((cls) => (
                      <option key={cls} value={cls}>
                        Class {cls}
                      </option>
                    ))}
                  </select>
                )}
              </>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {(results?.totalIterations > 0 || currentIteration > 0) && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1 bg-[var(--color-info-bg)] hover:bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-lg transition-colors"
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
        {(results?.totalIterations > 0 || (liveStats?.hasModel && currentIteration > 0)) ? (
          <MolstarViewer
            key={`${selectedJob?.id}-${selectedIteration}-${selectedClass}`}
            jobId={selectedJob?.id}
            iteration={selectedIteration}
            classNum={selectedClass}
            mrcFilePath={getSelectedMrcPath()}
            isoValue={1.5}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No 3D Model Yet</p>
            <p className="text-sm text-center mt-2">
              The 3D density map will appear here once the first iteration completes.
              {status === "running" && currentIteration > 0 && (
                <span className="block mt-2 text-amber-500">Iteration {currentIteration}/{totalIterations} in progress...</span>
              )}
              {status === "running" && currentIteration === 0 && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

    </div>
  );
};

export default InitialModelDashboard;
