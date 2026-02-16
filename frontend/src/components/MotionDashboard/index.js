import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getMotionResultsApi,
  getMicrographShiftsApi,
} from "../../services/builders/motion/motion";
import { getJobProgress } from "../../services/jobs";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiLayers,
  FiCpu,
  FiGrid,
  FiFilm,
  FiZoomIn,
  FiZoomOut,
  FiMaximize2,
} from "react-icons/fi";
import ShiftTrajectory from "./ShiftTrajectory";
import MicrographList from "./MicrographList";
import MicrographViewer from "./MicrographViewer";
import useJobNotification from "../../hooks/useJobNotification";

const MotionDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedMicrograph, setSelectedMicrograph] = useState(null);
  const [shiftData, setShiftData] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [activeImageTab, setActiveImageTab] = useState("micrograph");

  // Zoom controls
  const handleZoomIn = () => setViewerZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setViewerZoom((z) => Math.max(z - 0.25, 0.5));

  const [allMicrographs, setAllMicrographs] = useState([]);

  // Copy command to clipboard
  const copyCommand = (commandText) => {
    if (commandText) {
      navigator.clipboard.writeText(commandText);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Fetch full results (for completed jobs)
  // NOTE: Must be defined BEFORE fetchLiveStats due to dependency
  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async (offset = 0) => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);

      const response = await getMotionResultsApi(selectedJob.id, offset, 100000);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        const data = response.data.data;
        setResults(data);
        setError(null);

        setAllMicrographs(data.micrographs || []);
      }
    } catch (err) {
      setError("Failed to load motion correction results");
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
          fetchResults(0);
        }
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);



  // Fetch shift data for selected micrograph
  const fetchShiftData = useCallback(async (micrographName) => {
    if (!selectedJob?.id || !micrographName) return;

    try {
      // Normalize: strip path and .mrc extension so backend finds the .star file
      const parts = micrographName.split("/");
      const basename = parts[parts.length - 1].replace(/\.mrc$/i, "");
      const response = await getMicrographShiftsApi(
        selectedJob.id,
        basename
      );
      if (response?.data?.status === "success") {
        setShiftData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching shift data:", err);
    }
  }, [selectedJob?.id]);

  // Initial load and polling for live updates
  useEffect(() => {
    if (selectedJob?.id) {
      // Reset state on job change
      setAllMicrographs([]);
      setSelectedMicrograph(null);
      setShiftData(null);

      fetchResults(0);
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

  // Fetch shift data when micrograph is selected
  useEffect(() => {
    if (selectedMicrograph) {
      fetchShiftData(selectedMicrograph);
    }
  }, [selectedMicrograph, fetchShiftData]);

  // Auto-select first micrograph when data loads
  useEffect(() => {
    if (allMicrographs.length > 0 && !selectedMicrograph) {
      // Extract name from first micrograph
      const firstMic = allMicrographs[0];
      const fullPath = firstMic.micrograph_name || firstMic.name;
      if (fullPath) {
        const parts = fullPath.split("/");
        const filename = parts[parts.length - 1];
        const name = filename.replace(".mrc", "");
        setSelectedMicrograph(name);
      }
    }
  }, [allMicrographs, selectedMicrograph]);

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
          Loading motion correction results...
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

  // Use accumulated micrographs for pagination support
  const micrographs = allMicrographs;

  // Command with fallback to results (like ImportDashboard)
  const command = selectedJob?.command || results?.command;

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                MotionCorr/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success-text)"
                  : selectedJob?.status === "failed"
                  ? "var(--color-danger-text)"
                  : selectedJob?.status === "running"
                  ? "var(--color-warning)"
                  : "var(--color-warning)"
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
              className="flex items-center gap-2 hover:bg-[var(--color-bg)] rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-[var(--color-text-muted)]" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-[var(--color-text-muted)]" size={12} />
              ) : (
                <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />
              )}
            </button>
            {showCommand && command && (
              <button
                onClick={() => copyCommand(command)}
                className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-[var(--color-text-muted)]" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "var(--color-success-text)" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: 'var(--color-text-secondary)',
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
      {(() => {
        const stats = selectedJob?.pipeline_stats || {};
        return (
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiFilm className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Movies:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {liveStats?.processed ?? stats.micrograph_count ?? results?.summary_stats?.processed ?? 0}/{liveStats?.total ?? stats.micrograph_count ?? results?.summary_stats?.total ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {stats.pixel_size ? `${stats.pixel_size.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Dose Weight:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.doseWeighting === "Yes" || selectedJob?.parameters?.doseWeighting === true ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCpu className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Implementation:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.useRelionImplementation === "Yes" ? "RELION" : "MotionCor2"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Patches:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.patchesX || 1} x {selectedJob?.parameters?.patchesY || 1}
            </span>
          </div>
        </div>
      </div>
        );
      })()}

      {/* Three Column Layout */}
      <div className="flex border-b border-[var(--color-border)] overflow-hidden" style={{ height: "411px" }}>
        {/* Movie List */}
        <div className="flex-1 min-w-0 bg-[var(--color-bg-card)] flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiFilm className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Processed Movies</span>
          </div>
          <div className="flex-1 min-h-0">
            <MicrographList
              micrographs={micrographs}
              liveFiles={liveStats?.files}
              selectedMicrograph={selectedMicrograph}
              onSelect={setSelectedMicrograph}
              total={liveStats?.total ?? results?.summary_stats?.total}
            />
          </div>
        </div>

        {/* Micrograph Preview - Square */}
        <div className="bg-[var(--color-bg-card)] flex flex-col border-r border-[var(--color-border)]" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiFilm className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded ml-1" title="Zoom Out">
              <FiZoomOut className="text-[var(--color-text-secondary)]" size={12} />
            </button>
            <span className="text-[9px] text-[var(--color-text-secondary)]">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded" title="Zoom In">
              <FiZoomIn className="text-[var(--color-text-secondary)]" size={12} />
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MicrographViewer
              jobId={selectedJob?.id}
              micrograph={selectedMicrograph}
              shiftData={shiftData}
              zoom={viewerZoom}
              activeTab={activeImageTab}
            />
          </div>
        </div>

        {/* Shift Trajectory */}
        <div className="flex-1 min-w-0 bg-[var(--color-bg-card)] flex flex-col">
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiActivity className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Shift Analysis</span>
          </div>
          <div className="flex-1 min-h-0">
            {shiftData ? (
              <ShiftTrajectory data={shiftData} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-[var(--color-text-muted)]">
                <FiActivity className="text-3xl mb-2" />
                <p className="text-center text-xs">Select a micrograph to view<br/>its motion trajectory</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default MotionDashboard;
