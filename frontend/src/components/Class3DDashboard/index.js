import React, { useEffect, useState, useCallback } from "react";
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
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getClass3DResultsApi(selectedJob.id);
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
      setLoading(false);
    }
  }, [selectedJob?.id, selectedJob?.status]);

  // Fetch live stats for running jobs
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getClass3DLiveStatsApi(selectedJob.id);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-amber-500 text-xl animate-pulse" />;
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
        <p className="text-lg text-black font-medium mt-4">
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
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                Class3D/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "#16a34a"
                  : selectedJob?.status === "error"
                  ? "#dc2626"
                  : selectedJob?.status === "running"
                  ? "#f59e0b"
                  : "#ca8a04"
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
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-gray-400" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} />
              )}
            </button>
            {showCommand && selectedJob?.command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-gray-400" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "#16a34a" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: '#475569',
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
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Iterations:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: selectedJob?.status === "running" ? "#f59e0b" : "#1e293b" }}>
              {currentIteration}/{totalIterations}
            </span>
            {selectedJob?.status === "running" && liveStats?.progress_percent && (
              <span style={{ fontSize: "11px", color: "#f59e0b" }}>
                ({liveStats.progress_percent}%)
              </span>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Classes:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {numClasses}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiRotateCw className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Symmetry:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {symmetry}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Mask:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {maskDiameter} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {particleCount > 0 ? particleCount.toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Model Visualization with Molstar */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          {/* Iteration and Class Selector */}
          <div className="flex items-center gap-3">
            {(results?.unique_iterations?.length > 0 || currentIteration > 0) && (
              <select
                value={selectedIteration}
                onChange={handleIterationChange}
                className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
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
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
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
