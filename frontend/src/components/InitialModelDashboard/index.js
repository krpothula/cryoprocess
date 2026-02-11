import React, { useEffect, useState, useCallback } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getInitialModelResultsApi,
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
  FiDownload,
} from "react-icons/fi";
import MolstarViewer from "./MolstarViewer";

const InitialModelDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
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
      const iter = selectedIteration === "latest" ? (results?.latest_iteration || "") : selectedIteration;
      url = `${API_BASE_URL}/initialmodel/mrc/?job_id=${selectedJob?.id}&iteration=${iter}&class=${selectedClass}`;
    }
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.job_name || 'inimodel'}_class${String(selectedClass).padStart(3, '0')}.mrc`;
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
      const response = await getInitialModelResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load 3D initial model results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJob?.id]);

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
      }, 15000); // Poll every 15 seconds

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
      ? results.latest_iteration
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
      ? results.latest_iteration
      : parseInt(selectedIteration);
    const match = results.iterations.find(
      it => it.iteration === targetIter && it.class === selectedClass
    );
    return match?.file_path || null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black font-medium mt-4">
          Loading 3D initial model results...
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
                InitialModel/{selectedJob?.job_name || "Job"}
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

      {/* Stats Card - Two Rows with aligned columns */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        {/* Row 1 */}
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400 flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Iteration:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.latest_iteration !== null ? results.latest_iteration : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-gray-400 flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Classes:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.num_classes || 1}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiRotateCw className="text-gray-400 flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Symmetry:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.symmetry || results?.symmetry || "C1"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-gray-400 flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Mask:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.maskDiameter || results?.mask_diameter || 0} Å
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

          {/* Iteration and Class Selectors */}
          <div className="flex items-center gap-3">
            {results?.unique_iterations?.length > 0 && (
              <>
                <select
                  value={selectedIteration}
                  onChange={handleIterationChange}
                  className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
                  style={{ fontSize: "12px" }}
                >
                  <option value="latest">Latest (Iteration {results.latest_iteration})</option>
                  {results.unique_iterations.map((it) => (
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
                    className="px-3 py-1 border border-gray-200 rounded-lg focus:outline-none focus:border-blue-300"
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
              className="flex items-center gap-1 px-3 py-1 bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {results?.total_iterations > 0 && (
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
        {results?.total_iterations > 0 ? (
          <MolstarViewer
            key={`${selectedJob?.id}-${selectedIteration}-${selectedClass}`}
            jobId={selectedJob?.id}
            iteration={selectedIteration}
            classNum={selectedClass}
            mrcFilePath={getSelectedMrcPath()}
            isoValue={1.5}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No 3D Model Yet</p>
            <p className="text-sm text-center mt-2">
              The 3D density map will appear here once the first iteration completes.
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

export default InitialModelDashboard;
