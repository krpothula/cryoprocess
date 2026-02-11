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
  FiImage,
  FiFilm,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";

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

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getDynamightResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load DynaMight results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
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

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black font-medium mt-4">
          Loading DynaMight results...
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
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                DynaMight/{selectedJob?.job_name || "Job"}
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
            <span style={{ fontSize: "12px", color: "#64748b" }}>Iteration:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.latest_iteration || 0}/{results?.num_iterations || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiImage className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.num_particles?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Maps:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.mrc_files?.length || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilm className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Movies:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.has_movies ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          <div className="flex items-center gap-3">
            {results?.num_iterations > 0 && (
              <select
                value={selectedIteration}
                onChange={(e) => setSelectedIteration(e.target.value)}
                className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
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
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
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
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-green-500" />
            Output Files
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            {results.mrc_files.map((file, index) => (
              <div key={index} className="p-2 bg-gray-50 rounded text-xs text-gray-600 truncate">
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
