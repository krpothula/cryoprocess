import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiLayers,
  FiCopy,
  FiTerminal,
  FiChevronDown,
  FiChevronUp,
  FiClock,
  FiMinusCircle,
  FiBox,
  FiTarget,
} from "react-icons/fi";
import axiosInstance from "../../services/config";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getSubtractResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/subtract/results/?job_id=${jobId}`);
};

const SubtractDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;
    try {
      setLoading(true);
      const response = await getSubtractResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load subtraction results");
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (selectedJob?.id) fetchResults();
  }, [selectedJob?.id, fetchResults]);

  const copyCommand = () => {
    const cmd = results?.command || selectedJob?.command;
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

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

  const command = results?.command || selectedJob?.command;

  // Derive stats from pipeline_stats
  const stats = selectedJob?.pipeline_stats || {};
  const params = selectedJob?.parameters || {};
  const isRevert = params.revertToOriginal === 'Yes' || params.revertToOriginal === true;
  const particleCount = stats.particle_count || 0;
  const pixelSize = stats.pixel_size || null;
  const boxSize = stats.box_size || null;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black dark:text-slate-100 font-medium mt-4">Loading subtraction results...</p>
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
                Subtract/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "var(--color-success-text)"
                  : selectedJob?.status === "failed"
                  ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {selectedJob?.status === "success" ? "Success"
                  : selectedJob?.status === "running" ? "Running..."
                  : selectedJob?.status === "pending" ? "Pending"
                  : selectedJob?.status === "failed" ? "Error"
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
              {showCommand
                ? <FiChevronUp className="text-[var(--color-text-muted)]" size={12} />
                : <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />}
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
      </div>

      {/* Stats Card */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-gray-200 dark:border-slate-700">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <FiMinusCircle className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Operation:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {isRevert ? "Revert Subtraction" : "Particle Subtraction"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {particleCount > 0 ? particleCount.toLocaleString() : "—"}
            </span>
          </div>
          {pixelSize && (
            <div className="flex items-center gap-2">
              <FiTarget className="text-[var(--color-text-muted)]" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Pixel Size:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
                {pixelSize} Å
              </span>
            </div>
          )}
          {boxSize && (
            <div className="flex items-center gap-2">
              <FiBox className="text-[var(--color-text-muted)]" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Box Size:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
                {boxSize} px
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SubtractDashboard;
