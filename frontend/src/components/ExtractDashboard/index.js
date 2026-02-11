import React, { useEffect, useState, useCallback } from "react";
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
} from "react-icons/fi";

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
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getExtractResultsApi(selectedJob.id);
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
      setLoading(false);
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
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                Extract/{selectedJob?.job_name || "Job"}
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
            <span style={{ fontSize: "12px", color: "#64748b" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.stats?.micrographs || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
              {results?.stats?.totalParticles?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.particleBoxSize || selectedJob?.parameters?.extractSize || selectedJob?.parameters?.extract_size || 0} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Avg/Mic:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.stats?.avgPerMicrograph || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Rescaled:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.rescaleParticles === "Yes" ? `${selectedJob?.parameters?.rescaledBoxSize || selectedJob?.parameters?.rescaledSize || selectedJob?.parameters?.rescaled_size || 0} px` : "No"}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default ExtractDashboard;
