import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { getImportResultsApi } from "../../services/builders/import/import";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiFilm,
  FiImage,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiList,
  FiBox,
  FiFile,
  FiZap,
  FiMaximize2,
  FiTarget,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import MovieViewer from "./MovieViewer";
import ImportedFilesList from "./ImportedFilesList";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";
import useJobNotification from "../../hooks/useJobNotification";

// ─── Shared helpers ───────────────────────────────────────────

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

const getStatusText = (status) => {
  switch (status) {
    case "success": return "Success";
    case "running": return "Running...";
    case "pending": return "Pending";
    case "failed": return "Error";
    default: return status;
  }
};

const getStatusColor = (status) => {
  switch (status) {
    case "success": return "var(--color-success-text)";
    case "failed": return "var(--color-danger-text)";
    default: return "var(--color-warning)";
  }
};

// ─── Stat chip (reusable) ─────────────────────────────────────
const Stat = ({ icon: Icon, label, value }) => (
  <div className="flex items-center gap-2">
    <Icon className="text-[var(--color-text-muted)]" size={14} />
    <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>{label}</span>
    <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
      {value}
    </span>
  </div>
);

// ─── Command toggle (reusable) ────────────────────────────────
const CommandSection = ({ command, showCommand, setShowCommand, commandCopied, copyCommand }) => (
  <div className="mt-3 pt-3 border-t border-[var(--color-border)] -mx-4 px-4">
    <div className="flex items-center justify-between">
      <button
        onClick={() => setShowCommand(!showCommand)}
        className="flex items-center gap-2 hover:bg-[var(--color-bg)] rounded px-1 py-0.5 transition-colors"
        aria-expanded={showCommand}
        aria-label="Toggle RELION command"
      >
        <FiTerminal className="text-[var(--color-text-muted)]" size={12} />
        <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>RELION Command</span>
        {showCommand ? <FiChevronUp className="text-[var(--color-text-muted)]" size={12} /> : <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />}
      </button>
      {showCommand && command && (
        <button onClick={copyCommand} className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded transition-colors" title="Copy command">
          <FiCopy className="text-[var(--color-text-muted)]" size={12} />
          {commandCopied && <span style={{ fontSize: "10px", color: "var(--color-success-text)" }}>Copied!</span>}
        </button>
      )}
    </div>
    {showCommand && (
      <div className="mt-2 overflow-x-auto font-mono" style={{ fontSize: '9px', color: 'var(--color-text-secondary)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', lineHeight: '1.4' }}>
        {command || "Command not available for this job"}
      </div>
    )}
  </div>
);

// ─── Main ImportDashboard ─────────────────────────────────────

const ImportDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);

  const selectedMovieRef = useRef(selectedMovie);
  selectedMovieRef.current = selectedMovie;

  const handleZoomIn = () => setViewerZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setViewerZoom((z) => Math.max(z - 0.25, 0.5));

  const copyCommand = () => {
    const cmd = selectedJob?.command;
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // ── API fetch (file lists + viewer data only) ──
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;
    try {
      setLoading(true);
      const response = await getImportResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        const data = response.data.data;
        setResults(data);
        setError(null);
        // Auto-select first file for movies mode
        if (data?.importMode !== "other" && data?.importedFiles?.length > 0 && !selectedMovieRef.current) {
          const firstFile = data.importedFiles[0];
          const fileName = firstFile.name || firstFile.movieName || firstFile.micrographName || "Unknown";
          const filePath = firstFile.movieName || firstFile.micrographName || "";
          setSelectedMovie({ name: fileName, path: filePath, ...firstFile });
        }
      }
    } catch (err) {
      if (selectedJob?.status !== "running" && selectedJob?.status !== "pending") {
        setError("Failed to load import results");
      }
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();

      // Poll for updates if job is running
      const interval = setInterval(() => {
        if (selectedJob?.status === "running") fetchResults();
      }, 5000);
      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  useEffect(() => { setViewerZoom(1); }, [selectedMovie]);
  useJobNotification(selectedJob?.id, fetchResults);

  // ── All stats from DB ──
  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  // Detect mode from DB — no API needed for routing
  const isOtherNodeType = !!pStats.nodeType || results?.importMode === "other";

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">Loading import results...</p>
      </div>
    );
  }

  if (error && status !== "running" && status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-[var(--color-danger-bg)] m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-[var(--color-danger-text)] font-medium mt-4">{error}</p>
      </div>
    );
  }

  // ── Route to the right sub-dashboard ──
  if (isOtherNodeType) {
    return (
      <OtherNodeTypeDashboard
        selectedJob={selectedJob}
        pStats={pStats}
        command={command}
        showCommand={showCommand}
        setShowCommand={setShowCommand}
        commandCopied={commandCopied}
        copyCommand={copyCommand}
        importedFile={results?.importedFile || {}}
      />
    );
  }

  // ── Movies / Micrographs ──
  // Determine import type: check rawMovies first, then multiFrameMovies
  const isMovies = ["Yes", "yes", "true", true].includes(params.rawMovies)
    || ["Yes", "yes", "true", true].includes(params.multiFrameMovies);
  const importType = isMovies ? "movies" : "micrographs";
  const totalImported = importType === "movies"
    ? (pStats.movieCount ?? pStats.micrographCount ?? 0)
    : (pStats.micrographCount ?? 0);
  const pixelSize = pStats.pixelSize ?? params.angpix ?? null;
  const importedFiles = results?.importedFiles || [];

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
              Import/{selectedJob?.jobName || "Job"}
            </h2>
            <p style={{ fontSize: "12px", fontWeight: 500, color: getStatusColor(status) }}>
              {getStatusText(status)}
            </p>
          </div>
        </div>
        <CommandSection command={command} showCommand={showCommand} setShowCommand={setShowCommand} commandCopied={commandCopied} copyCommand={copyCommand} />
      </div>

      {/* Stats Card — all values from DB */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <Stat icon={importType === "movies" ? FiFilm : FiImage} label="Type:" value={importType} />
          <Stat icon={importType === "movies" ? FiFilm : FiImage} label={importType === "movies" ? "Movies:" : "Micrographs:"} value={totalImported} />
          <Stat icon={FiMaximize2} label="Pixel Size:" value={pixelSize ? `${parseFloat(pixelSize).toFixed(3)} Å/px` : "N/A"} />
          <Stat icon={FiZap} label="Voltage:" value={params.kV ? `${params.kV} kV` : "N/A"} />
          <Stat icon={FiTarget} label="Cs:" value={params.spherical || params.Cs ? `${params.spherical || params.Cs} mm` : "N/A"} />
        </div>
      </div>

      {/* File List + Viewer — from API */}
      <div className="flex border-b border-[var(--color-border)] overflow-hidden" style={{ height: "411px" }}>
        <div className="flex-1 min-w-0 bg-[var(--color-bg-card)] flex flex-col border-r border-[var(--color-border)]">
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            <FiList className="text-[var(--color-text-muted)]" size={13} />
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Processed {importType === "movies" ? "Movies" : "Micrographs"}</span>
          </div>
          <div className="flex-1 min-h-0">
            <ImportedFilesList files={importedFiles} type={importType} selectedFile={selectedMovie} onSelect={setSelectedMovie} totalImported={totalImported} />
          </div>
        </div>
        <div className="bg-[var(--color-bg-card)] flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
            {importType === "movies" ? <FiFilm className="text-[var(--color-text-muted)]" size={13} /> : <FiImage className="text-[var(--color-text-muted)]" size={13} />}
            <span className="text-xs font-bold text-[var(--color-text-secondary)]">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded ml-1" title="Zoom Out"><FiZoomOut className="text-[var(--color-text-secondary)]" size={12} /></button>
            <span className="text-[9px] text-[var(--color-text-secondary)]">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded" title="Zoom In"><FiZoomIn className="text-[var(--color-text-secondary)]" size={12} /></button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MovieViewer selectedFile={selectedMovie} importType={importType} zoom={viewerZoom} />
          </div>
        </div>
      </div>
    </div>
  );
};

// ─── Other Node Type Dashboard (ref3d, mask, halfmap, refs2d, coords) ─────

const OtherNodeTypeDashboard = ({
  selectedJob,
  pStats,
  command,
  showCommand,
  setShowCommand,
  commandCopied,
  copyCommand,
  importedFile,
}) => {
  // All stats from DB — no API fallbacks
  const nodeType = pStats.nodeType;
  const nodeLabel = pStats.nodeLabel ?? "Unknown";
  const fileName = pStats.importedFileName ?? importedFile?.name ?? "N/A";
  const entryCount = pStats.entryCount ?? 0;
  const voxelSize = pStats.voxelSize ?? null;
  const status = selectedJob?.status;

  const isVolumeType = ["ref3d", "mask", "halfmap"].includes(nodeType);

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center gap-3">
          {getStatusIcon(status)}
          <div>
            <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
              Import/{selectedJob?.jobName || "Job"}
            </h2>
            <p style={{ fontSize: "12px", fontWeight: 500, color: getStatusColor(status) }}>
              {getStatusText(status)}
            </p>
          </div>
        </div>
        <CommandSection command={command} showCommand={showCommand} setShowCommand={setShowCommand} commandCopied={commandCopied} copyCommand={copyCommand} />
      </div>

      {/* Stats Card — all values from DB */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <Stat icon={FiBox} label="Type:" value={nodeLabel} />
          <Stat icon={FiFile} label="File:" value={fileName} />
          {entryCount > 0 && (
            <Stat
              icon={FiTarget}
              label={nodeType === 'refs2d' ? 'Classes:' : nodeType === 'coords' ? 'Particles:' : 'Entries:'}
              value={entryCount.toLocaleString()}
            />
          )}
          {voxelSize != null && (
            <Stat icon={FiMaximize2} label="Voxel Size:" value={`${parseFloat(voxelSize).toFixed(3)} Å`} />
          )}
        </div>
      </div>

      {/* 3D Viewer — uses API importedFile.exists for MRC volumes */}
      {isVolumeType && importedFile?.exists && (
        <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>
          <MolstarViewer jobId={selectedJob?.id} apiEndpoint="/api/import/mrc/" />
        </div>
      )}
    </div>
  );
};

export default ImportDashboard;
