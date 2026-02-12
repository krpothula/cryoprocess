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
  FiImage,
  FiFilm,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getDynamightResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/dynamight/results/?job_id=${jobId}`);
};

const DynamightDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState("latest");
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
      const response = await getDynamightResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load DynaMight results");
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
      }, 20000); // Poll every 20 seconds
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
          Loading DynaMight results...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-red-50 dark:bg-red-900/30 m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-red-600 dark:text-red-400 font-medium mt-4">{error}</p>
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
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>
                DynaMight/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success)"
                  : selectedJob?.status === "error"
                  ? "var(--color-danger-text)"
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
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-slate-700 -mx-4 px-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-gray-50 dark:hover:bg-slate-700 rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-gray-400 dark:text-slate-500" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400 dark:text-slate-500" size={12} />
              ) : (
                <FiChevronDown className="text-gray-400 dark:text-slate-500" size={12} />
              )}
            </button>
            {showCommand && selectedJob?.command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 dark:hover:bg-slate-700 rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-gray-400 dark:text-slate-500" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "var(--color-success)" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: 'var(--color-text-label)',
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
            <FiLayers className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Iteration:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {results?.latest_iteration || 0}/{results?.num_iterations || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiImage className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {results?.num_particles?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Maps:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {results?.mrc_files?.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilm className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Movies:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {results?.has_movies ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700 dark:text-slate-200 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          <div className="flex items-center gap-3">
            {results?.num_iterations > 0 && (
              <select
                value={selectedIteration}
                onChange={(e) => setSelectedIteration(e.target.value)}
                className="px-3 py-1 border border-gray-200 dark:border-slate-700 rounded-lg focus:outline-none focus:border-blue-300 dark:bg-slate-800 dark:text-slate-200"
                style={{ fontSize: "12px" }}
              >
                <option value="latest">Latest (Iteration {results.latest_iteration})</option>
                {Array.from({ length: results.num_iterations }, (_, i) => i + 1).map((it) => (
                  <option key={it} value={it}>
                    Iteration {it}
                  </option>
                ))}
              </select>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 dark:bg-slate-800 hover:bg-gray-200 dark:hover:bg-slate-700 rounded-lg transition-colors dark:text-slate-200"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>
          </div>
        </div>

        {results?.has_output ? (
          <MolstarViewer
            key={`${selectedJob?.id}-${selectedIteration}`}
            jobId={selectedJob?.id}
            iteration={selectedIteration}
            classNum={1}
            apiEndpoint={`/dynamight/mrc/?iteration=${selectedIteration}&class=1`}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Volume Yet</p>
            <p className="text-sm text-center mt-2">
              The flexibility analysis results will appear here once processing completes.
              {selectedJob?.status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Output Files */}
      {results?.mrc_files?.length > 0 && (
        <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
          <h3 className="font-bold text-gray-700 dark:text-slate-200 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-green-500" />
            Output Files
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {results.mrc_files.map((file, index) => (
              <div key={index} className="p-2 bg-[var(--color-bg)] rounded text-xs text-gray-600 dark:text-slate-300 truncate">
                {file}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default DynamightDashboard;
