import React, { useEffect, useState, useCallback } from "react";
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

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getPolishResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load polishing results");
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
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchResults]);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-blue-500 text-xl animate-pulse" />;
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
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                Polish/{selectedJob?.job_name || "Job"}
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
            <FiImage className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.particles_polished?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilm className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.micrographs_processed || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Frames:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.first_frame || 1} - {results?.last_frame === -1 ? "All" : results?.last_frame}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCheckCircle className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: results?.has_output ? "#16a34a" : "#1e293b" }}>
              {results?.has_output ? "Ready" : "Pending"}
            </span>
          </div>
        </div>
      </div>

      {/* Motion Parameters */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiSettings className="text-blue-500" />
          Motion Parameters
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-gray-50 rounded-lg p-4">
            <span className="text-sm text-gray-500">Sigma Velocity</span>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {results?.sigma_velocity || 0.2}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <span className="text-sm text-gray-500">Sigma Divergence</span>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {results?.sigma_divergence || 5000}
            </p>
          </div>
          <div className="bg-gray-50 rounded-lg p-4">
            <span className="text-sm text-gray-500">Sigma Acceleration</span>
            <p className="text-xl font-bold text-gray-800 mt-1">
              {results?.sigma_acceleration || 2}
            </p>
          </div>
        </div>
      </div>

      {/* Status Info */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiActivity className="text-green-500" />
          Job Status
        </h3>
        <div className="flex items-center gap-4">
          {results?.has_output ? (
            <div className="flex items-center gap-2 text-green-600">
              <FiCheckCircle />
              <span>Polished particles available at: <code className="text-sm bg-gray-100 px-2 py-1 rounded">{results?.output_dir}/shiny.star</code></span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <FiClock />
              <span>Waiting for output...</span>
            </div>
          )}
          <button
            onClick={fetchResults}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
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
