import React, { useEffect, useState, useCallback } from "react";
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
  FiGrid,
  FiFile,
  FiZap,
  FiMaximize2,
  FiFolder,
  FiTarget,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import MovieViewer from "./MovieViewer";
import ImportedFilesList from "./ImportedFilesList";
import MolstarViewer from "../InitialModelDashboard/MolstarViewer";

// Format file size
const formatFileSize = (bytes) => {
  if (!bytes) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

const ImportDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [selectedMovie, setSelectedMovie] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);

  // Zoom controls
  const handleZoomIn = () => setViewerZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setViewerZoom((z) => Math.max(z - 0.25, 0.5));

  // Copy command to clipboard
  const copyCommand = () => {
    if (selectedJob?.command || results?.command) {
      navigator.clipboard.writeText(selectedJob?.command || results?.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Fetch import results
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getImportResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        const data = response.data.data;
        setResults(data);
        setError(null);

        // Auto-select first file if available and no file is selected (for movies mode)
        if (data?.import_mode !== "other" && data?.imported_files?.length > 0 && !selectedMovie) {
          const firstFile = data.imported_files[0];
          const fileName = firstFile.name || firstFile.movie_name || firstFile.micrograph_name || "Unknown";
          const filePath = firstFile.movie_name || firstFile.micrograph_name || "";
          setSelectedMovie({ name: fileName, path: filePath, ...firstFile });
        }
      }
    } catch (err) {
      // Don't show error if job is still running/pending - it's expected that results aren't ready yet
      const currentStatus = selectedJob?.status;
      if (currentStatus !== "running" && currentStatus !== "pending") {
        setError("Failed to load import results");
      }
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJob?.id, selectedMovie]);

  // Initial load and polling
  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();

      // Poll for updates if job is running/pending
      const interval = setInterval(() => {
        if (selectedJob?.status === "running" || selectedJob?.status === "pending") {
          fetchResults();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Reset zoom when file changes
  useEffect(() => {
    setViewerZoom(1);
  }, [selectedMovie]);

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
          Loading import results...
        </p>
      </div>
    );
  }

  // Show running/pending template if job is still in progress
  const jobStatus = selectedJob?.status || results?.job_status;
  const isJobInProgress = jobStatus === "running" || jobStatus === "pending";

  if (error && !isJobInProgress) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-red-50 m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-red-600 font-medium mt-4">{error}</p>
      </div>
    );
  }

  // Use same template for running jobs - just show empty/zero data
  const command = selectedJob?.command || results?.command;
  const importMode = results?.import_mode || "movies";
  const isOtherNodeType = importMode === "other";

  // Render different content based on import mode
  if (isOtherNodeType) {
    return <OtherNodeTypeDashboard
      results={results}
      selectedJob={selectedJob}
      command={command}
      showCommand={showCommand}
      setShowCommand={setShowCommand}
      commandCopied={commandCopied}
      copyCommand={copyCommand}
      getStatusIcon={getStatusIcon}
    />;
  }

  // Movies/Micrographs import
  const importType = results?.summary?.type || "micrographs";
  const totalImported = results?.summary?.total_imported || 0;
  const importedFiles = results?.imported_files || [];

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status || results?.job_status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                Import/{selectedJob?.job_name || results?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: (selectedJob?.status || results?.job_status) === "success"
                  ? "#16a34a"
                  : (selectedJob?.status || results?.job_status) === "error"
                  ? "#dc2626"
                  : (selectedJob?.status || results?.job_status) === "running"
                  ? "#f59e0b"
                  : "#ca8a04"
              }}>
                {(selectedJob?.status || results?.job_status) === "success"
                  ? "Success"
                  : (selectedJob?.status || results?.job_status) === "running"
                  ? "Running..."
                  : (selectedJob?.status || results?.job_status) === "pending"
                  ? "Pending"
                  : (selectedJob?.status || results?.job_status) === "error"
                  ? "Error"
                  : selectedJob?.status || results?.job_status}
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
              aria-expanded={showCommand}
              aria-label="Toggle RELION command"
            >
              <FiTerminal className="text-gray-400" size={12} aria-hidden="true" />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} aria-hidden="true" />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} aria-hidden="true" />
              )}
            </button>
            {showCommand && command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy command"
                aria-label="Copy RELION command"
              >
                <FiCopy className="text-gray-400" size={12} aria-hidden="true" />
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
            {importType === "movies" ? (
              <FiFilm className="text-gray-400" size={14} aria-hidden="true" />
            ) : (
              <FiImage className="text-gray-400" size={14} aria-hidden="true" />
            )}
            <span style={{ fontSize: "12px", color: "#64748b" }}>Type:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b", textTransform: "capitalize" }}>
              {importType}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFilm className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Total:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {totalImported}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMaximize2 className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Pixel Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.angpix ? `${parseFloat(results.angpix).toFixed(3)} Å/px` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiZap className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Voltage:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.kV ? `${results.kV} kV` : "N/A"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Cs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.cs ? `${results.cs} mm` : "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Three Column Layout */}
      <div className="flex border border-gray-200 rounded-lg overflow-hidden" style={{ height: "411px" }}>
        {/* Imported Files List */}
        <div className="flex-1 min-w-0 bg-white flex flex-col border-r border-gray-200">
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            <FiList className="text-gray-400" size={13} />
            <span className="text-xs font-bold text-gray-600">Processed {importType === "movies" ? "Movies" : "Micrographs"}</span>
          </div>
          <div className="flex-1 min-h-0">
            <ImportedFilesList
              files={importedFiles}
              type={importType}
              selectedFile={selectedMovie}
              onSelect={setSelectedMovie}
              totalImported={totalImported}
            />
          </div>
        </div>

        {/* Movie/Micrograph Viewer - Square */}
        <div className="bg-white flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
          <div className="px-3 py-2 border-b border-gray-100 flex items-center gap-2 flex-shrink-0">
            {importType === "movies" ? (
              <FiFilm className="text-gray-400" size={13} />
            ) : (
              <FiImage className="text-gray-400" size={13} />
            )}
            <span className="text-xs font-bold text-gray-600">Viewer</span>
            <button onClick={handleZoomOut} className="p-0.5 hover:bg-gray-100 rounded ml-1" title="Zoom Out" aria-label="Zoom out">
              <FiZoomOut className="text-gray-600" size={12} aria-hidden="true" />
            </button>
            <span className="text-[9px] text-gray-500">{Math.round(viewerZoom * 100)}%</span>
            <button onClick={handleZoomIn} className="p-0.5 hover:bg-gray-100 rounded" title="Zoom In" aria-label="Zoom in">
              <FiZoomIn className="text-gray-600" size={12} aria-hidden="true" />
            </button>
          </div>
          <div className="flex-1 min-h-0 relative">
            <MovieViewer
              selectedFile={selectedMovie}
              importType={importType}
              zoom={viewerZoom}
            />
          </div>
        </div>
      </div>
    </div>
  );
};

/**
 * Dashboard component for "other" node type imports (3D ref, mask, coords, etc.)
 */
const OtherNodeTypeDashboard = ({
  results,
  selectedJob,
  command,
  showCommand,
  setShowCommand,
  commandCopied,
  copyCommand,
  getStatusIcon
}) => {
  const nodeType = results?.node_type;
  const nodeLabel = results?.node_label || "Unknown";
  const importedFile = results?.imported_file || {};
  const dimensions = importedFile?.dimensions;

  // Check if it's a volume type that can be displayed in Mol*
  const isVolumeType = ["ref3d", "mask", "halfmap"].includes(nodeType);

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status || results?.job_status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                Import/{selectedJob?.job_name || results?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: (selectedJob?.status || results?.job_status) === "success"
                  ? "#16a34a"
                  : (selectedJob?.status || results?.job_status) === "error"
                  ? "#dc2626"
                  : (selectedJob?.status || results?.job_status) === "running"
                  ? "#f59e0b"
                  : "#ca8a04"
              }}>
                {(selectedJob?.status || results?.job_status) === "success"
                  ? "Success"
                  : (selectedJob?.status || results?.job_status) === "running"
                  ? "Running..."
                  : (selectedJob?.status || results?.job_status) === "pending"
                  ? "Pending"
                  : (selectedJob?.status || results?.job_status) === "error"
                  ? "Error"
                  : selectedJob?.status || results?.job_status}
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
              aria-expanded={showCommand}
              aria-label="Toggle RELION command"
            >
              <FiTerminal className="text-gray-400" size={12} aria-hidden="true" />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} aria-hidden="true" />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} aria-hidden="true" />
              )}
            </button>
            {showCommand && command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy command"
                aria-label="Copy RELION command"
              >
                <FiCopy className="text-gray-400" size={12} aria-hidden="true" />
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
            <FiBox className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Type:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {nodeLabel}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFile className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>File:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }} title={importedFile?.name}>
              {importedFile?.name || "N/A"}
            </span>
            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
              {importedFile?.entry_count > 0
                ? `(${importedFile.entry_count.toLocaleString()} ${nodeType === 'refs2d' ? 'classes' : nodeType === 'coords' ? 'particles' : 'entries'})`
                : `(${formatFileSize(importedFile?.size)})`}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFolder className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }} title={results?.output_dir}>
              {results?.output_dir?.split("/").slice(-2).join("/") || "N/A"}
            </span>
          </div>
        </div>
      </div>

      {/* Volume dimensions if available */}
      {dimensions && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiBox className="text-gray-400" size={14} />
              <span style={{ fontSize: "12px", color: "#64748b" }}>Dimensions:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                {dimensions.nx} x {dimensions.ny} x {dimensions.nz}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <FiGrid className="text-gray-400" size={14} />
              <span style={{ fontSize: "12px", color: "#64748b" }}>Total Voxels:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                {(dimensions.nx * dimensions.ny * dimensions.nz).toLocaleString()}
              </span>
            </div>
            {importedFile?.voxel_size && (
              <div className="flex items-center gap-2">
                <FiMaximize2 className="text-gray-400" size={14} />
                <span style={{ fontSize: "12px", color: "#64748b" }}>Voxel Size:</span>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                  {importedFile.voxel_size.toFixed(3)} Å
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <FiFile className="text-gray-400" size={14} />
              <span style={{ fontSize: "12px", color: "#64748b" }}>File Size:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                {formatFileSize(importedFile?.size)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* 3D Viewer for MRC Volume Types only (ref3d, mask, halfmap) */}
      {isVolumeType && importedFile?.exists && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>
          <MolstarViewer
            jobId={selectedJob?.id}
            apiEndpoint="/api/import/mrc/"
          />
        </div>
      )}

      {/* For non-volume types (coords, refs2d), don't show any viewer - just the stats cards above */}
    </div>
  );
};

export default ImportDashboard;
