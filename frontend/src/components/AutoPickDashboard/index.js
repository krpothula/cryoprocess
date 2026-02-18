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
import useJobProgress from "../../hooks/useJobProgress";

const AutoPickDashboard = () => {
  const { selectedJob } = useBuilder();
  const wsProgress = useJobProgress(selectedJob?.id);
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
  const [circleDiameterA, setCircleDiameterA] = useState(null); // Å — null = auto from params
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
        true
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
      setSelectedMicrograph(results.micrographs[0].micrographName);
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
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading autopick results...
        </p>
      </div>
    );
  }

  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  if (error && status !== "running" && status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-[var(--color-danger-bg)] m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-[var(--color-danger-text)] font-medium mt-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                AutoPick/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success" ? "var(--color-success-text)"
                  : status === "failed" ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {status === "success" ? "Success"
                  : status === "running" ? "Running..."
                  : status === "pending" ? "Pending"
                  : status === "failed" ? "Error"
                  : status}
              </p>
            </div>
          </div>
        </div>

        {/* RELION Command Section */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] -mx-4 px-4">
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
                onClick={copyCommand}
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

      {/* Stats Card — DB only */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiImage className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {liveStats?.processed ?? wsProgress?.micrographCount ?? pStats.micrographCount ?? 0}/{liveStats?.total ?? pStats.micrographCount ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Method:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {["Yes", "yes", "true", true].includes(params.useTopaz) ? "Topaz"
                : ["Yes", "yes", "true", true].includes(params.templateMatching) ? "Template"
                : "LoG"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.particleCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMinimize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Min Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.minDiameter != null ? `${params.minDiameter} Å` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Max Diameter:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.maxDiameter != null ? `${params.maxDiameter} Å` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex border-b border-[var(--color-border)] overflow-hidden" style={{ height: "411px" }}>
        {/* Micrograph List */}
        <div className="flex-1 min-w-0 bg-[var(--color-bg-card)] border-r border-[var(--color-border)] flex flex-col">
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiList className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Processed Micrographs</span>
          </div>
          <div className="flex-1 min-h-0">
            <MicrographList
              micrographs={results?.micrographs || []}
              selectedMicrograph={selectedMicrograph}
              onSelect={setSelectedMicrograph}
              totalMicrographs={liveStats?.total ?? pStats.micrographCount ?? 0}
            />
          </div>
        </div>

        {/* Micrograph Viewer - Square */}
        <div className="bg-[var(--color-bg-card)] flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiImage className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded ml-1" title="Zoom Out">
              <FiZoomOut className="text-[var(--color-text-secondary)]" size={12} />
            </button>
            <span className="text-[9px] text-[var(--color-text-secondary)]">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded" title="Zoom In">
              <FiZoomIn className="text-[var(--color-text-secondary)]" size={12} />
            </button>
            {/* Marker toggle and circle size slider (Å diameter) */}
            <div className="flex items-center gap-1 ml-auto">
              <button
                onClick={() => setShowPicks(!showPicks)}
                className={`p-0.5 rounded transition-colors ${showPicks ? "hover:bg-[var(--color-bg-hover)]" : "hover:bg-[var(--color-bg-hover)] opacity-50"}`}
                title={showPicks ? "Hide markers" : "Show markers"}
              >
                {showPicks ? (
                  <FiEye className="text-green-600" size={12} />
                ) : (
                  <FiEyeOff className="text-[var(--color-text-muted)]" size={12} />
                )}
              </button>
              <input
                type="range"
                min="30"
                max="500"
                step="10"
                value={circleDiameterA ?? (parseInt(params.minDiameter) || 200)}
                onChange={(e) => setCircleDiameterA(parseInt(e.target.value))}
                disabled={!showPicks}
                className={`w-16 h-1.5 rounded-lg ${showPicks ? "bg-[var(--color-border)] cursor-pointer" : "bg-[var(--color-bg)] cursor-not-allowed opacity-40"}`}
              />
              <span className={`text-[9px] whitespace-nowrap ${showPicks ? "text-[var(--color-text-secondary)]" : "text-[var(--color-text-muted)]"}`}>
                {circleDiameterA ?? (parseInt(params.minDiameter) || 200)}Å
              </span>
            </div>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MicrographViewer
              imageData={micrographImage}
              loading={imageLoading}
              selectedMicrograph={selectedMicrograph}
              zoom={viewerZoom}
              showPicks={showPicks}
              circleDiameterA={circleDiameterA ?? (parseInt(params.minDiameter) || 200)}
              pixelSize={micrographImage?.pixelSize ?? pStats.pixelSize ?? null}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

export default AutoPickDashboard;
