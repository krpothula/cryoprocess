import React, { useEffect, useState, useCallback } from "react";
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
  const fetchResults = useCallback(async (offset = 0) => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);

      const response = await getMotionResultsApi(selectedJob.id, offset, 100000);
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
          Loading motion correction results...
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

  // Use accumulated micrographs for pagination support
  const micrographs = allMicrographs;

  // Command with fallback to results (like ImportDashboard)
  const command = selectedJob?.command || results?.command;

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                MotionCorr/{selectedJob?.job_name || "Job"}
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
            {showCommand && command && (
              <button
                onClick={() => copyCommand(command)}
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
            <FiFilm className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Movies:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {liveStats?.processed ?? results?.summary_stats?.processed ?? 0}/{liveStats?.total ?? results?.summary_stats?.total ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.pixel_size ? `${results.pixel_size.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Bin Factor:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.binningFactor || 1}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCpu className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Implementation:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.useRelionImplementation === "Yes" ? "RELION" : "MotionCor2"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Patches:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {selectedJob?.parameters?.patchesX || 1} x {selectedJob?.parameters?.patchesY || 1}
            </span>
          </div>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden" style={{ height: "411px" }}>
        {/* Movie List */}
        <div className="flex-1 min-w-0 bg-white flex flex-col border-r border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiFilm className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Processed Movies</span>
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
        <div className="bg-white flex flex-col border-r border-gray-200" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiFilm className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-gray-100 rounded ml-1" title="Zoom Out">
              <FiZoomOut className="text-gray-600" size={12} />
            </button>
            <span className="text-[9px] text-gray-500">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-gray-100 rounded" title="Zoom In">
              <FiZoomIn className="text-gray-600" size={12} />
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
        <div className="flex-1 min-w-0 bg-white flex flex-col">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiActivity className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Shift Analysis</span>
          </div>
          <div className="flex-1 min-h-0">
            {shiftData ? (
              <ShiftTrajectory data={shiftData} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-gray-400">
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
