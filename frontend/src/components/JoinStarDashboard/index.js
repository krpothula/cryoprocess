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
  FiGitMerge,
  FiImage,
  FiFilm,
} from "react-icons/fi";
import axiosInstance from "../../services/config";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getJoinStarResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/joinstar/results/?job_id=${jobId}`);
};

const JoinStarDashboard = () => {
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
      const response = await getJoinStarResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load join results");
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

  // Derive combining flags from parameters (DB Direct)
  const params = selectedJob?.parameters || {};
  const combineParticles = params.combineParticles === 'Yes' || params.combineParticles === true;
  const combineMicrographs = params.combineMicrographs === 'Yes' || params.combineMicrographs === true;
  const combineMovies = params.combineMovies === 'Yes' || params.combineMovies === true;

  // Build combined types label
  const types = [];
  if (combineParticles) types.push("Particles");
  if (combineMicrographs) types.push("Micrographs");
  if (combineMovies) types.push("Movies");

  // Counts from pipeline_stats
  const stats = selectedJob?.pipeline_stats || {};
  const particleCount = stats.particle_count || 0;
  const micrographCount = stats.micrograph_count || 0;
  const movieCount = stats.movie_count || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black dark:text-slate-100 font-medium mt-4">Loading join results...</p>
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
                JoinStar/{selectedJob?.job_name || "Job"}
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
            <FiGitMerge className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Combining:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {types.length > 0 ? types.join(", ") : "—"}
            </span>
          </div>
          {combineParticles && (
            <div className="flex items-center gap-2">
              <FiLayers className="text-[var(--color-text-muted)]" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
                {particleCount.toLocaleString()}
              </span>
            </div>
          )}
          {combineMicrographs && (
            <div className="flex items-center gap-2">
              <FiImage className="text-[var(--color-text-muted)]" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
                {micrographCount.toLocaleString()}
              </span>
            </div>
          )}
          {combineMovies && (
            <div className="flex items-center gap-2">
              <FiFilm className="text-[var(--color-text-muted)]" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Movies:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
                {movieCount.toLocaleString()}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default JoinStarDashboard;
