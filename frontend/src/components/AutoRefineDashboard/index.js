import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
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
  FiTarget,
  FiGrid,
  FiCrosshair,
  FiDownload,
  FiTrendingUp,
} from "react-icons/fi";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import FscChart from "../common/FscChart";
import { getAutoRefineResultsApi, getAutoRefineFscApi } from "../../services/builders/3d-autorefine/3d-autorefine";
import useJobNotification from "../../hooks/useJobNotification";
import useJobProgress from "../../hooks/useJobProgress";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const AutoRefineDashboard = () => {
  const { selectedJob } = useBuilder();
  const wsProgress = useJobProgress(selectedJob?.id);
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [selectedIteration, setSelectedIteration] = useState("latest");
  const [mapType, setMapType] = useState("half1");
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [fscData, setFscData] = useState([]);

  const handleDownload = () => {
    const iter = selectedIteration === "latest" ? (results?.latestIteration || "") : selectedIteration;
    const url = `${API_BASE_URL}/autorefine/mrc/?type=${mapType}&jobId=${selectedJob?.id}&iteration=${iter}&class=1`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.jobName || 'refine3d'}_it${iter}_${mapType}.mrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyCommand = () => {
    if (command) {
      navigator.clipboard.writeText(command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getAutoRefineResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);

        // Fetch FSC curve data
        if (response.data.data?.totalIterations > 0) {
          getAutoRefineFscApi(selectedJob.id)
            .then((fscRes) => {
              if (mountedRef.current && fscRes?.data?.data?.fscCurve) {
                setFscData(fscRes.data.data.fscCurve);
              }
            })
            .catch((err) => console.warn('[AutoRefine] FSC data not available:', err.message));
        }
      }
    } catch (err) {
      setError("Failed to load auto-refinement results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
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
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchResults]);

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
        return <FiClock className="text-slate-400 text-xl" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading auto-refinement results...
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
                Refine3D/{selectedJob?.jobName || "Job"}
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
                  ? "Error"
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

      {/* Stats Card - Two Rows */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        {/* Row 1: Resolution, Iteration, Particles, Micrographs */}
        <div className="grid grid-cols-4 gap-4 mb-3">
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Resolution:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.resolution ? `${pStats.resolution.toFixed(2)} Å` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Iteration:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: status === "running" ? "var(--color-warning)" : "var(--color-text-heading)" }}>
              {wsProgress?.iterationCount ?? pStats.iterationCount ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.particleCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.micrographCount ?? 0}
            </span>
          </div>
        </div>
        {/* Row 2: Pixel Size, Box Size, Symmetry */}
        <div className="grid grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <FiCrosshair className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.pixelSize ? `${pStats.pixelSize.toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiGrid className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {pStats.boxSize ?? 0} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiRotateCw className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Symmetry:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.symmetry ?? "C1"}
            </span>
          </div>
          <div />
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          <div className="flex items-center gap-3">
            {results?.uniqueIterations?.length > 0 && (
              <select
                value={selectedIteration}
                onChange={(e) => setSelectedIteration(e.target.value)}
                className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                style={{ fontSize: "12px" }}
              >
                <option value="latest">Latest (Iteration {results.latestIteration})</option>
                {results.uniqueIterations.map((it) => (
                  <option key={it} value={it}>Iteration {it}</option>
                ))}
              </select>
            )}

            {results?.hasHalfMaps && (
              <select
                value={mapType}
                onChange={(e) => setMapType(e.target.value)}
                className="px-3 py-1 border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                style={{ fontSize: "12px" }}
              >
                <option value="half1">Half Map 1</option>
                <option value="half2">Half Map 2</option>
              </select>
            )}

            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
            >
              <FiRefreshCw size={13} />
              Refresh
            </button>

            {results?.totalIterations > 0 && (
              <button
                onClick={handleDownload}
                className="flex items-center gap-1 px-3 py-1 bg-[var(--color-info-bg)] hover:bg-[var(--color-primary-light)] text-[var(--color-primary)] rounded-lg transition-colors"
                style={{ fontSize: "12px" }}
                title={`Download ${mapType} map (.mrc)`}
              >
                <FiDownload size={13} />
                Download
              </button>
            )}
          </div>
        </div>

        {results?.totalIterations > 0 ? (
          <MolstarViewer
            key={`${selectedJob?.id}-${selectedIteration}-${mapType}`}
            jobId={selectedJob?.id}
            iteration={selectedIteration}
            classNum={1}
            apiEndpoint={`/autorefine/mrc/?type=${mapType}`}
            isoValue={1.5}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Refined Map Yet</p>
            <p className="text-sm text-center mt-2">
              The refined 3D map will appear here once processing completes.
              {status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* FSC Curve */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiTrendingUp className="text-blue-500" size={13} />
            FSC Curve
          </h3>
          {results?.resolution && (
            <span style={{ fontSize: "11px", color: "var(--color-success-text)", fontWeight: 600 }}>
              Gold-Standard Resolution: {Number(results.resolution).toFixed(2)} Å
            </span>
          )}
        </div>
        <FscChart
          data={fscData}
          goldStdRes={results?.resolution}
          height={320}
        />
      </div>

    </div>
  );
};

export default AutoRefineDashboard;
