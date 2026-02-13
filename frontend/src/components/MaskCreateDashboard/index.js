import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiBox,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiCircle,
  FiSettings,
  FiDownload,
} from "react-icons/fi";
import MolstarMaskViewer from "./MolstarMaskViewer";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getMaskCreateResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/maskcreate/results/?job_id=${jobId}`);
};

const MaskCreateDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const handleDownload = () => {
    const url = `${API_BASE_URL}/maskcreate/mrc/?job_id=${selectedJob?.id}`;
    const a = document.createElement('a');
    a.href = url;
    a.download = `${selectedJob?.job_name || 'mask'}_mask.mrc`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
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
      const response = await getMaskCreateResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load mask creation results");
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
      }, 10000);
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
        return <FiClock className="text-yellow-500 text-xl" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black dark:text-slate-100 font-medium mt-4">
          Loading mask creation results...
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
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                MaskCreate/{selectedJob?.job_name || "Job"}
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
            {showCommand && selectedJob?.command && (
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
              {selectedJob?.command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiSettings className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Threshold:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.initialThreshold ?? 0.004}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Extension:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.extendBinaryMask ?? 3} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiBox className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Soft Edge:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.softEdgeWidth ?? 6} px
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Lowpass:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {selectedJob?.parameters?.lowpassFilter ?? 15} Å
            </span>
          </div>
        </div>
      </div>

      {/* 3D Visualization */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiBox className="text-blue-500" size={13} />
            Volume Viewer
          </h3>

          {results?.has_mask && (
            <button
              onClick={handleDownload}
              className="flex items-center gap-1 px-3 py-1 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
              title="Download mask (.mrc)"
            >
              <FiDownload size={13} />
              Download
            </button>
          )}
        </div>

        {results?.has_mask ? (
          <MolstarMaskViewer
            jobId={selectedJob?.id}
            maskApiEndpoint="/maskcreate/mrc/"
            sourceMapPath={results?.input_map || null}
            initialOpacity={0.7}
            initialThreshold={0.5}
          />
        ) : (
          <div className="h-[500px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiBox className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Mask Yet</p>
            <p className="text-sm text-center mt-2">
              The 3D mask will appear here once creation completes.
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

export default MaskCreateDashboard;
