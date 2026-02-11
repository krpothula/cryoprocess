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
  FiImage,
  FiZap,
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import axiosInstance from "../../services/config";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getLocalResResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/localres/results/?job_id=${jobId}`);
};

// Continuous gradient color scale legend for resolution values
const ResolutionColorScale = ({ minRes, maxRes }) => (
  <div className="flex items-center gap-1.5" style={{ fontSize: "10px" }}>
    <span className="text-gray-500 font-medium">{minRes?.toFixed(1) || "?"} Å</span>
    <div
      className="rounded overflow-hidden"
      style={{
        width: "100px",
        height: "10px",
        background: "linear-gradient(to right, #0000FF, #00FFFF, #00FF00, #FFFF00, #FF0000)",
      }}
    />
    <span className="text-gray-500 font-medium">{maxRes?.toFixed(1) || "?"} Å</span>
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
    const url = `${API_BASE_URL}/localres/mrc/?type=${type}&job_id=${selectedJob?.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.job_name || 'localres'}_${type}.mrc`;
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
      const response = await getLocalResResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load local resolution results");
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
          Loading local resolution results...
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

  // The filtered map is the actual density - we color it using values from the locres map
  const hasFilteredMap = results?.has_locres_filtered;
  const hasLocresMap = results?.has_locres_map;

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                LocalRes/{selectedJob?.job_name || "Job"}
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
            <span style={{ fontSize: "12px", color: "#64748b" }}>Mean Resolution:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
              {results?.mean_resolution ? `${results.mean_resolution.toFixed(2)} Å` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Local Res Map:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: results?.has_locres_map ? "#16a34a" : "#1e293b" }}>
              {results?.has_locres_map ? "Available" : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiImage className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Filtered Map:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: results?.has_locres_filtered ? "#16a34a" : "#1e293b" }}>
              {results?.has_locres_filtered ? "Available" : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiZap className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>B-factor:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.b_factor || -100} Å²
            </span>
          </div>
        </div>
      </div>

      {/* 3D Visualization - Filtered Map with Resolution Coloring */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <h3 className="font-bold text-gray-700 flex items-center gap-2" style={{ fontSize: "12px" }}>
              <FiBox className="text-blue-500" size={13} />
              Volume Viewer
            </h3>

            {/* Continuous resolution color scale legend */}
            {colorMode === "colored" && hasLocresMap && results?.min_resolution && results?.max_resolution && (
              <ResolutionColorScale
                minRes={results.min_resolution}
                maxRes={results.max_resolution}
              />
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* Color mode toggle buttons */}
            {hasFilteredMap && hasLocresMap && (
              <div className="flex items-center bg-gray-100 rounded-md p-0.5">
                <button
                  onClick={() => setColorMode("colored")}
                  className={`px-3 py-1 rounded transition-all ${
                    colorMode === "colored"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 hover:text-gray-800"
                  }`}
                  style={{ fontSize: "12px", fontWeight: 500 }}
                >
                  Resolution Colored
                </button>
                <button
                  onClick={() => setColorMode("uniform")}
                  className={`px-3 py-1 rounded transition-all ${
                    colorMode === "uniform"
                      ? "bg-blue-600 text-white shadow-sm"
                      : "bg-white text-gray-600 hover:text-gray-800"
                  }`}
                  style={{ fontSize: "12px", fontWeight: 500 }}
                >
                  Uniform Color
                </button>
              </div>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {(hasFilteredMap || hasLocresMap) && (
              <button
                onClick={() => handleDownload(hasFilteredMap ? "filtered" : "locres")}
                className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
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
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <div className="h-[550px]">
              <MolstarViewer
                key={`${selectedJob?.id}-${colorMode}`}
                jobId={selectedJob?.id}
                iteration="latest"
                classNum={1}
                apiEndpoint={hasFilteredMap ? "/localres/mrc/?type=filtered" : "/localres/mrc/?type=locres"}
                colorByResolution={colorMode === "colored" && hasLocresMap}
                colorVolumeEndpoint={colorMode === "colored" && hasLocresMap ? "/localres/mrc/?type=locres" : null}
                minResolution={results?.min_resolution || null}
                maxResolution={results?.max_resolution || null}
              />
            </div>
          </div>
        ) : (
          /* No maps available */
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Local Resolution Map Yet</p>
            <p className="text-sm text-center mt-2">
              The local resolution map will appear here once calculation completes.
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

export default LocalResDashboard;
