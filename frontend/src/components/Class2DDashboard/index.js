import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getClass2DResultsApi,
  getClass2DLiveStatsApi,
  getClass2DIndividualImagesApi,
} from "../../services/builders/2d-classification/2d-classification";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiGrid,
  FiLayers,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiCircle,
  FiTarget,
  FiCrosshair,
} from "react-icons/fi";
import useJobNotification from "../../hooks/useJobNotification";
import useJobProgress from "../../hooks/useJobProgress";

const Class2DDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [liveStats, setLiveStats] = useState(null);
  const [classesData, setClassesData] = useState(null);
  const [imageLoading, setImageLoading] = useState(false);
  const [selectedIteration, setSelectedIteration] = useState("latest");
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
  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getClass2DResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      // Don't show error if job is running/pending
      if (selectedJob?.status !== "running" && selectedJob?.status !== "pending") {
        setError("Failed to load 2D classification results");
      }
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id, selectedJob?.status]);

  // Fetch live stats for running jobs
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getClass2DLiveStatsApi(selectedJob.id);
      if (response?.data?.status === "success" && response?.data?.data) {
        setLiveStats(response.data.data);

        // If job just completed, refresh results
        if (response.data.data.jobStatus === "success" && selectedJob?.status === "running") {
          fetchResults();
        }
      }
    } catch (err) {
      console.error("Error fetching live stats:", err);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Fetch individual class images
  const fetchClassImages = useCallback(async (iteration = "latest") => {
    if (!selectedJob?.id) return;

    try {
      setImageLoading(true);
      const response = await getClass2DIndividualImagesApi(selectedJob.id, iteration);
      if (response?.data?.status === "success") {
        setClassesData(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching class images:", err);
      setClassesData(null);
    } finally {
      setImageLoading(false);
    }
  }, [selectedJob?.id]);

  // Initial load
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
      fetchLiveStats();
    }
  }, [selectedJob?.id, fetchResults, fetchLiveStats]);

  // Fetch images when results load or iteration changes
  useEffect(() => {
    if (results?.totalIterations > 0 || liveStats?.currentIteration > 0) {
      fetchClassImages(selectedIteration);
    }
  }, [results, liveStats?.currentIteration, selectedIteration, fetchClassImages]);

  // Polling for running jobs - every 5 seconds
  useEffect(() => {
    if (selectedJob?.id && selectedJob?.status === "running") {
      const interval = setInterval(() => {
        fetchLiveStats();
        // Also refresh images if viewing latest iteration
        if (selectedIteration === "latest") {
          fetchClassImages("latest");
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchLiveStats, fetchClassImages, selectedIteration]);

  // Trigger immediate fetch on WebSocket job_update (supplements polling)
  useJobNotification(selectedJob?.id, fetchResults);

  // Real-time progress via WebSocket (supplements polling for stats cards)
  const wsProgress = useJobProgress(selectedJob?.id);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-amber-500 text-xl animate-pulse" />;
      case "error":
      case "failed":
        return <FiAlertCircle className="text-red-500 text-xl" />;
      default:
        return <FiClock className="text-slate-400 text-xl" />;
    }
  };

  const handleIterationChange = (e) => {
    setSelectedIteration(e.target.value);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading 2D classification results...
        </p>
      </div>
    );
  }

  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  const numClasses = params.numberOfClasses ?? 0;
  const isVDAM = ["Yes", "yes", "true", true].includes(params.useVDAM);
  const totalIterations = isVDAM ? (params.vdamMiniBatches ?? 0) : (params.numberEMIterations ?? 0);
  const currentIteration = liveStats?.currentIteration ?? wsProgress?.iterationCount ?? pStats.iterationCount ?? 0;
  const boxSize = pStats.boxSize ?? 0;
  const maskDiameter = params.maskDiameter ?? 0;
  const particleCount = wsProgress?.particleCount ?? pStats.particleCount ?? 0;

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
                Class2D/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success"
                  ? "var(--color-success-text)"
                  : status === "failed"
                  ? "var(--color-danger-text)"
                  : status === "pending"
                  ? "var(--color-text-muted)"
                  : "var(--color-warning)"
              }}>
                {status === "success"
                  ? "Success"
                  : status === "running"
                  ? "Running..."
                  : status === "pending"
                  ? "Pending"
                  : status === "failed"
                  ? "Failed"
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

      {/* Stats Card */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-2">
            <FiGrid className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Classes:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {numClasses}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{isVDAM ? "Mini-batches:" : "Iterations:"}</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: status === "running" ? "var(--color-warning)" : "var(--color-text-heading)" }}>
              {currentIteration}/{totalIterations}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCrosshair className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.pixelSize ? `${pStats.pixelSize.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {boxSize} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Mask:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {maskDiameter} Å
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {particleCount > 0 ? particleCount.toLocaleString() : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* 2D Classes Gallery */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiGrid className="text-blue-500" size={13} />
            2D Class Averages
          </h3>

          {/* Iteration Selector */}
          <div className="flex items-center gap-3">
            {(results?.iterations?.length > 0 || currentIteration > 0) && (
              <select
                value={selectedIteration}
                onChange={handleIterationChange}
                className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                style={{ fontSize: "12px" }}
              >
                <option value="latest">Latest (Iteration {currentIteration})</option>
                {[...new Set([
                  ...(classesData?.availableIterations || []),
                  ...(results?.iterations?.map(it => it.iteration) || [])
                ].map(Number))]
                  .filter(it => it !== currentIteration)
                  .sort((a, b) => a - b)
                  .map((it) => (
                    <option key={it} value={it}>
                      Iteration {it}
                    </option>
                  ))}
              </select>
            )}

            <button
              onClick={() => fetchClassImages(selectedIteration)}
              disabled={imageLoading}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw className={`${imageLoading ? "animate-spin" : ""}`} size={13} />
              Refresh
            </button>
          </div>
        </div>

        {/* Classes Gallery Grid */}
        {imageLoading ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <BiLoader className="animate-spin text-blue-500 text-4xl mb-4" />
            <p className="text-sm">Loading 2D class averages...</p>
          </div>
        ) : classesData?.classes?.length > 0 ? (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            {classesData.classes.map((cls, index) => (
              <div
                key={cls.classNumber || index}
                style={{
                  backgroundColor: '#000',
                  width: 'calc((100% - 36px) / 10)',
                  aspectRatio: '1',
                }}
              >
                <img
                  src={cls.image}
                  alt={`Class ${cls.classNumber || index + 1}`}
                  className="w-full h-full object-contain"
                />
              </div>
            ))}
          </div>
        ) : currentIteration === 0 ? (
          <div className="h-[400px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiGrid className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Classes Yet</p>
            <p className="text-sm text-center mt-2">
              2D class averages will appear here once the first iteration completes.
              {status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        ) : (
          <div className="h-[400px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiAlertCircle className="text-5xl mb-4" />
            <p className="text-lg font-medium">Could Not Load Classes</p>
            <p className="text-sm text-center mt-2">
              There was an error loading the 2D class averages.
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Class2DDashboard;
