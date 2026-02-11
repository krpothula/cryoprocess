import React, { useEffect, useState, useCallback } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { getManualSelectResultsApi } from "../../services/builders/manual-select/manual-select";
import { BiLoader } from "react-icons/bi";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiLayers,
  FiFilter,
  FiTrash2,
  FiCopy,
  FiSliders,
  FiTerminal,
  FiChevronDown,
  FiChevronUp,
  FiClock,
} from "react-icons/fi";

const SubsetDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Fetch results
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getManualSelectResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load subset results");
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

  // Copy command to clipboard
  const copyCommand = () => {
    const command = results?.command || selectedJob?.command;
    if (command) {
      navigator.clipboard.writeText(command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Get status icon based on job status
  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <BiLoader className="animate-spin text-blue-500 text-xl" />;
      case "failed":
        return <FiAlertCircle className="text-red-500 text-xl" />;
      case "pending":
        return <FiClock className="text-yellow-500 text-xl" />;
      default:
        return <FiCheckCircle className="text-green-500 text-xl" />;
    }
  };

  // Determine operation type from parameters
  const params = selectedJob?.parameters || {};
  const isDuplicateRemoval = params.removeDuplicates === "Yes";
  const isMetadataFilter = params.metaDataValues === "Yes";
  const isRandomSubset = params.split === "Yes" || (params.subsetSize > 0 && params.subsetSize < 100);
  const isRegrouping = params.regroupParticles === "Yes";

  // Get operation info
  const getOperationInfo = () => {
    if (isDuplicateRemoval) {
      return { name: "Duplicate Removal", icon: FiCopy };
    }
    if (isMetadataFilter) {
      return { name: "Metadata Filtering", icon: FiSliders };
    }
    if (isRandomSubset) {
      return { name: "Random Subset", icon: FiFilter };
    }
    if (isRegrouping) {
      return { name: "Particle Regrouping", icon: FiLayers };
    }
    return { name: "Subset Selection", icon: FiFilter };
  };

  const operationInfo = getOperationInfo();

  // Calculate stats
  const particlesBefore = results?.particles_before || 0;
  const particlesAfter = results?.particle_count || 0;
  const particlesRemoved = particlesBefore - particlesAfter;
  const retentionPercent = particlesBefore > 0 ? ((particlesAfter / particlesBefore) * 100).toFixed(1) : 0;
  const removalPercent = particlesBefore > 0 ? ((particlesRemoved / particlesBefore) * 100).toFixed(1) : 0;

  const command = results?.command || selectedJob?.command;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-blue-500 text-4xl" />
        <p className="text-lg text-gray-700 font-medium mt-4">
          Loading subset results...
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
                Select/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "#16a34a"
                  : selectedJob?.status === "error" || selectedJob?.status === "failed"
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
                  : selectedJob?.status === "error" || selectedJob?.status === "failed"
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
            {showCommand && command && (
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
              {command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <operationInfo.icon className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Operation:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {operationInfo.name}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Input:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {particlesBefore > 0 ? particlesBefore.toLocaleString() : "—"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilter className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
              {particlesAfter.toLocaleString()}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>({retentionPercent}%)</span>
          </div>
          <div className="flex items-center gap-2">
            <FiTrash2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Removed:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#dc2626" }}>
              {particlesBefore > 0 ? particlesRemoved.toLocaleString() : "—"}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>({removalPercent}%)</span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default SubsetDashboard;
