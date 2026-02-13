import React, { useEffect, useState, useCallback, useRef } from "react";
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
import useJobNotification from "../../hooks/useJobNotification";

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
  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getAutoPickResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load autopick results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
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
          Loading autopick results...
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

  const stats = results?.summary_stats;

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text)" }}>
                AutoPick/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success)"
                  : selectedJob?.status === "failed"
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
                  : selectedJob?.status === "failed"
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

      {/* Stats Card */}
      {(() => {
        const pStats = selectedJob?.pipeline_stats || {};
        return (
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiImage className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {pStats.micrograph_count || liveStats?.processed || 0}/{liveStats?.total ?? pStats.micrograph_count ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Method:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {pStats.pick_method || "Unknown"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {(pStats.particle_count || 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMinimize2 className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Min Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {selectedJob?.parameters?.minDiameter || 200} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400 dark:text-slate-500" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Max Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text)" }}>
              {selectedJob?.parameters?.maxDiameter || 250} Å
            </span>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Main Content - Two Column Layout */}
      <div
        className="flex border-b border-gray-200 dark:border-slate-700 overflow-hidden"
        style={{ height: "411px" }}
      >
        {/* Micrograph List */}
        <div className="flex-1 min-w-0 bg-[var(--color-bg-card)] border-r border-gray-200 dark:border-slate-700 flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
            <FiList className="text-gray-400 dark:text-slate-500" size={13} />
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300">Processed Micrographs</span>
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
        <div className="bg-[var(--color-bg-card)] flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
            <FiImage className="text-gray-400 dark:text-slate-500" size={13} />
            <span className="text-xs font-bold text-gray-600 dark:text-slate-300">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded ml-1" title="Zoom Out">
              <FiZoomOut className="text-gray-600 dark:text-slate-300" size={12} />
            </button>
            <span className="text-[9px] text-gray-500 dark:text-slate-400">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-gray-100 dark:hover:bg-slate-700 rounded" title="Zoom In">
              <FiZoomIn className="text-gray-600 dark:text-slate-300" size={12} />
            </button>
            {/* Marker toggle and circle size slider */}
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => setShowPicks(!showPicks)}
                className={`p-0.5 rounded transition-colors ${showPicks ? "hover:bg-gray-100 dark:hover:bg-slate-700" : "hover:bg-gray-100 dark:hover:bg-slate-700 opacity-50"}`}
                title={showPicks ? "Hide markers" : "Show markers"}
              >
                {showPicks ? (
                  <FiEye className="text-green-600" size={12} />
                ) : (
                  <FiEyeOff className="text-gray-400 dark:text-slate-500" size={12} />
                )}
              </button>
              <span className={`text-xs ml-2 ${showPicks ? "text-gray-500 dark:text-slate-400" : "text-gray-300 dark:text-slate-600"}`}>Size:</span>
              <input
                type="range"
                min="20"
                max="100"
                value={circleRadius}
                onChange={(e) => setCircleRadius(parseInt(e.target.value))}
                disabled={!showPicks}
                className={`w-16 h-1.5 rounded-lg ${showPicks ? "bg-gray-200 dark:bg-slate-700 cursor-pointer" : "bg-gray-100 dark:bg-slate-800 cursor-not-allowed opacity-40"}`}
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
