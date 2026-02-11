import React, { useEffect, useState, useCallback } from "react";
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
  FiTrendingUp,
  FiZap,
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getPostProcessResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/postprocess/results/?job_id=${jobId}`);
};

const PostProcessDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [mapType, setMapType] = useState("masked");
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const handleDownload = () => {
    const url = `${API_BASE_URL}/postprocess/mrc/?type=${mapType}&job_id=${selectedJob?.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.job_name || 'postprocess'}_${mapType}.mrc`;
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

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getPostProcessResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load post-processing results");
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
      }, 10000);
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
          Loading post-processing results...
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
                PostProcess/{selectedJob?.job_name || "Job"}
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
            <FiTarget className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Resolution:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
              {results?.final_resolution ? `${results.final_resolution.toFixed(2)} Å` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiZap className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>B-factor:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.bfactor ? `${Math.abs(results.bfactor).toFixed(0)} Å²` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Masked Map:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.has_masked_map ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTrendingUp className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>FSC Curve:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.has_fsc ? "Available" : "N/A"}
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
            <select
              value={mapType}
              onChange={(e) => setMapType(e.target.value)}
              className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
              style={{ fontSize: "12px" }}
            >
              <option value="masked">Masked Map</option>
              <option value="unmasked">Unmasked Map</option>
            </select>

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {(results?.has_masked_map || results?.has_unmasked_map) && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
                style={{ fontSize: "12px" }}
                title={`Download ${mapType} map (.mrc)`}
              >
                <FiDownload size={13} />
                Download
              </button>
            )}
          </div>
        </div>

        {results?.has_masked_map || results?.has_unmasked_map ? (
          <MolstarViewer
            jobId={selectedJob?.id}
            iteration="latest"
            classNum={1}
            apiEndpoint={`/postprocess/mrc/?type=${mapType}`}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Volume Yet</p>
            <p className="text-sm text-center mt-2">
              The volume will appear here once post-processing completes.
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

export default PostProcessDashboard;
