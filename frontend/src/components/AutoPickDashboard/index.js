import React, { useEffect, useState, useCallback } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getAutoPickResultsApi,
  getAutoPickImageApi,
} from "../../services/builders/auto-pick/auto-pick";
import { getJobProgress } from "../../services/jobs";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiTarget,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiList,
  FiImage,
  FiMinimize2,
  FiMaximize2,
  FiZoomIn,
  FiZoomOut,
  FiEye,
  FiEyeOff,
} from "react-icons/fi";
import MicrographList from "./MicrographList";
import MicrographViewer from "./MicrographViewer";

const AutoPickDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedMicrograph, setSelectedMicrograph] = useState(null);
  const [micrographImage, setMicrographImage] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [showPicks, setShowPicks] = useState(true);
  const [circleRadius, setCircleRadius] = useState(50);
  const [autoSelectDone, setAutoSelectDone] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);

  // Zoom controls
  const handleZoomIn = () => setViewerZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setViewerZoom((z) => Math.max(z - 0.25, 0.5));

  // Copy command to clipboard
  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Fetch full results
  // NOTE: Must be defined BEFORE fetchLiveStats due to dependency
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getAutoPickResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load autopick results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJob?.id]);

  // Fetch progress stats (for running jobs)
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getJobProgress(selectedJob.id);
      if (response?.data?.success && response?.data?.data) {
        const progressData = response.data.data;
        setLiveStats(progressData);
        setError(null);

        // If job just completed, refresh results
        if (progressData.status === "success" && selectedJob?.status === "running") {
          fetchResults();
        }
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Fetch micrograph image + coordinates once per micrograph selection
  // showPicks/circleRadius are rendered client-side via SVG overlay in MicrographViewer
  const fetchMicrographImage = useCallback(async (micrographName) => {
    if (!selectedJob?.id || !micrographName) return;

    try {
      setImageLoading(true);
      const response = await getAutoPickImageApi(
        selectedJob.id,
        micrographName,
        true,
        50
      );
      if (response?.data?.status === "success") {
        setMicrographImage(response.data.data);
      }
    } catch (err) {
      setMicrographImage(null);
    } finally {
      setImageLoading(false);
    }
  }, [selectedJob?.id]);

  // Initial load and polling
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
      fetchLiveStats();

      // Poll for live stats if job is running
      const interval = setInterval(() => {
        if (selectedJob?.status === "running") {
          fetchLiveStats();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults, fetchLiveStats]);

  // Fetch image only when micrograph selection changes (not on UI toggle/slider)
  useEffect(() => {
    if (selectedMicrograph) {
      fetchMicrographImage(selectedMicrograph);
    }
  }, [selectedMicrograph, fetchMicrographImage]);

  // Auto-select first micrograph when results load (show image by default)
  useEffect(() => {
    if (results?.micrographs?.length > 0 && !autoSelectDone && !selectedMicrograph) {
      // Select the first micrograph (sorted by particle count - highest first)
      setSelectedMicrograph(results.micrographs[0].micrograph_name);
      setAutoSelectDone(true);
    }
  }, [results, autoSelectDone, selectedMicrograph]);

  // Reset zoom when micrograph changes
  useEffect(() => {
    setViewerZoom(1);
  }, [selectedMicrograph]);

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
          Loading autopick results...
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

  const stats = results?.summary_stats;

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                AutoPick/{selectedJob?.job_name || "Job"}
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

      {/* Stats Card */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiImage className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {liveStats?.processed ?? stats?.total_micrographs ?? 0}/{liveStats?.total ?? stats?.total_micrographs ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Method:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.useTopaz === "Yes"
                ? selectedJob?.parameters?.performTopazTraining === "Yes"
                  ? "Topaz Train"
                  : "Topaz"
                : selectedJob?.parameters?.laplacianGaussian === "Yes"
                ? "LoG"
                : selectedJob?.parameters?.templateMatching === "Yes"
                ? "Template"
                : "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMinimize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Min Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.minDiameter || 200} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Max Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.maxDiameter || 250} Å
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div
        className="flex border border-gray-200 rounded-lg overflow-hidden"
        style={{ height: "411px" }}
      >
        {/* Micrograph List */}
        <div className="flex-1 min-w-0 bg-white border-r border-gray-200 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiList className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Processed Micrographs</span>
          </div>
          <div className="flex-1 min-h-0">
            <MicrographList
              micrographs={results?.micrographs || []}
              selectedMicrograph={selectedMicrograph}
              onSelect={setSelectedMicrograph}
              totalMicrographs={stats?.total_micrographs || 0}
            />
          </div>
        </div>

        {/* Micrograph Viewer - Square */}
        <div className="bg-white flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiImage className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-gray-100 rounded ml-1" title="Zoom Out">
              <FiZoomOut className="text-gray-600" size={12} />
            </button>
            <span className="text-[9px] text-gray-500">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-gray-100 rounded" title="Zoom In">
              <FiZoomIn className="text-gray-600" size={12} />
            </button>
            {/* Marker toggle and circle size slider */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowPicks(!showPicks)}
                className={`p-0.5 rounded transition-colors ${showPicks ? "hover:bg-gray-100" : "hover:bg-gray-100 opacity-50"}`}
                title={showPicks ? "Hide markers" : "Show markers"}
              >
                {showPicks ? (
                  <FiEye className="text-green-600" size={12} />
                ) : (
                  <FiEyeOff className="text-gray-400" size={12} />
                )}
              </button>
              <span className={`text-xs ml-2 ${showPicks ? "text-gray-500" : "text-gray-300"}`}>Size:</span>
              <input
                type="range"
                min="20"
                max="100"
                value={circleRadius}
                onChange={(e) => setCircleRadius(parseInt(e.target.value))}
                disabled={!showPicks}
                className={`w-16 h-1.5 rounded-lg ${showPicks ? "bg-gray-200 cursor-pointer" : "bg-gray-100 cursor-not-allowed opacity-40"}`}
              />
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MicrographViewer
              imageData={micrographImage}
              loading={imageLoading}
              selectedMicrograph={selectedMicrograph}
              zoom={viewerZoom}
              showPicks={showPicks}
              circleRadius={circleRadius}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPickDashboard;
