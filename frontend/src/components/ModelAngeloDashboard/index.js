import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiFileText,
  FiLayers,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiRefreshCw,
  FiDownload,
  FiSearch,
  FiDatabase,
} from "react-icons/fi";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getModelAngeloResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/modelangelo/results/?jobId=${jobId}`);
};

const ModelAngeloDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

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
      const response = await getModelAngeloResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load ModelAngelo results");
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
      }, 30000); // Poll every 30 seconds for ModelAngelo (longer job)
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

  const downloadPDB = async () => {
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/modelangelo/pdb/?jobId=${selectedJob.id}`,
        { responseType: "blob" }
      );
      if (!mountedRef.current) return;
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedJob.jobName || "model"}.pdb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      console.error("Failed to download PDB:", err);
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading ModelAngelo results...
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
                ModelAngelo/{selectedJob?.jobName || "Job"}
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
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>ModelAngelo Command</span>
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

      {/* Stats Card - Merged */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Chains:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.numChains ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiDatabase className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Residues:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.numResidues?.toLocaleString() ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFileText className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>PDB Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.hasPdb ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiSearch className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>HMMER:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {results?.hasHmmerResults ? "Done" : results?.performHmmer === "Yes" ? "Pending" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-[var(--color-text)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiFileText className="text-blue-500" />
            Model Output
          </h3>

          <div className="flex items-center gap-3">
            {results?.hasPdb && (
              <button
                onClick={downloadPDB}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--color-primary)] hover:bg-[var(--color-primary-hover)] text-white rounded-lg transition-colors"
              >
                <FiDownload />
                Download PDB
              </button>
            )}
            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {results?.hasPdb ? (
          <div className="bg-[var(--color-bg)] rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Model Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Total Chains:</span>
                    <span className="font-medium">{results?.numChains ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Total Residues:</span>
                    <span className="font-medium">{results?.numResidues?.toLocaleString() ?? 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">PDB Available:</span>
                    <span className="font-medium text-[var(--color-success)]">Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">mmCIF Available:</span>
                    <span className="font-medium">{results?.hasCif ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-[var(--color-text-secondary)] mb-3">Input Sequences</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">Protein FASTA:</span>
                    <span className="font-medium">{results?.hasProteinFasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">DNA FASTA:</span>
                    <span className="font-medium">{results?.hasDnaFasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">RNA FASTA:</span>
                    <span className="font-medium">{results?.hasRnaFasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[var(--color-text-secondary)]">HMMER Search:</span>
                    <span className="font-medium">{results?.performHmmer || "No"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)] rounded-lg">
            <FiFileText className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Model Yet</p>
            <p className="text-sm text-center mt-2">
              The atomic model will appear here once ModelAngelo completes.
              {status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Output Status */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiCheckCircle className="text-green-500" />
          Output Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className={`p-3 rounded-lg ${results?.hasPdb ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'}`}>
            PDB File: {results?.hasPdb ? "Available" : "Pending"}
          </div>
          <div className={`p-3 rounded-lg ${results?.hasCif ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'}`}>
            mmCIF File: {results?.hasCif ? "Available" : "Pending"}
          </div>
          <div className={`p-3 rounded-lg ${results?.hasHmmerResults ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'}`}>
            HMMER Results: {results?.hasHmmerResults ? "Available" : results?.performHmmer === "Yes" ? "Pending" : "N/A"}
          </div>
          <div className={`p-3 rounded-lg ${results?.hasLogfilePdf ? 'bg-[var(--color-success-bg)] text-[var(--color-success)]' : 'bg-[var(--color-bg)] text-[var(--color-text-secondary)]'}`}>
            Log File: {results?.hasLogfilePdf ? "Available" : "Pending"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelAngeloDashboard;
