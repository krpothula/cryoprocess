import React, { useEffect, useState, useCallback } from "react";
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

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getModelAngeloResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/modelangelo/results/?job_id=${jobId}`);
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

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getModelAngeloResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load ModelAngelo results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-amber-500 text-xl animate-pulse" />;
      case "error":
        return <FiAlertCircle className="text-red-500 text-xl" />;
      default:
        return <FiClock className="text-yellow-500 text-xl" />;
    }
  };

  const downloadPDB = async () => {
    try {
      const response = await axiosInstance.get(
        `${API_BASE_URL}/modelangelo/pdb/?job_id=${selectedJob.id}`,
        { responseType: "blob" }
      );
      const blob = new Blob([response.data]);
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${selectedJob.job_name || "model"}.pdb`;
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
        <p className="text-lg text-black font-medium mt-4">
          Loading ModelAngelo results...
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
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                ModelAngelo/{selectedJob?.job_name || "Job"}
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
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>ModelAngelo Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} />
              )}
            </button>
            {showCommand && selectedJob?.command && (
              <button
                onClick={copyCommand}
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
              {selectedJob?.command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Chains:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.num_chains || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiDatabase className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Residues:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.num_residues?.toLocaleString() || 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFileText className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>PDB Output:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.has_pdb ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiSearch className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>HMMER:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.has_hmmer_results ? "Done" : results?.perform_hmmer === "Yes" ? "Pending" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* Model Info */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h3 className="font-bold text-gray-700 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiFileText className="text-blue-500" />
            Model Output
          </h3>

          <div className="flex items-center gap-3">
            {results?.has_pdb && (
              <button
                onClick={downloadPDB}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors"
              >
                <FiDownload />
                Download PDB
              </button>
            )}
            <button
              onClick={fetchResults}
              className="flex items-center gap-1 px-3 py-1.5 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
            >
              <FiRefreshCw />
              Refresh
            </button>
          </div>
        </div>

        {results?.has_pdb ? (
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-3">Model Statistics</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Chains:</span>
                    <span className="font-medium">{results?.num_chains || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Total Residues:</span>
                    <span className="font-medium">{results?.num_residues?.toLocaleString() || 0}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">PDB Available:</span>
                    <span className="font-medium text-green-600">Yes</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">mmCIF Available:</span>
                    <span className="font-medium">{results?.has_cif ? "Yes" : "No"}</span>
                  </div>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-medium text-gray-600 mb-3">Input Sequences</h4>
                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Protein FASTA:</span>
                    <span className="font-medium">{results?.has_protein_fasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">DNA FASTA:</span>
                    <span className="font-medium">{results?.has_dna_fasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">RNA FASTA:</span>
                    <span className="font-medium">{results?.has_rna_fasta ? "Provided" : "No"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">HMMER Search:</span>
                    <span className="font-medium">{results?.perform_hmmer || "No"}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="h-[300px] flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
            <FiFileText className="text-5xl mb-4" />
            <p className="text-lg font-medium">No Model Yet</p>
            <p className="text-sm text-center mt-2">
              The atomic model will appear here once ModelAngelo completes.
              {selectedJob?.status === "running" && (
                <span className="block mt-2 text-amber-500">Job is currently running...</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Output Status */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiCheckCircle className="text-green-500" />
          Output Status
        </h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div className={`p-3 rounded-lg ${results?.has_pdb ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            PDB File: {results?.has_pdb ? "Available" : "Pending"}
          </div>
          <div className={`p-3 rounded-lg ${results?.has_cif ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            mmCIF File: {results?.has_cif ? "Available" : "Pending"}
          </div>
          <div className={`p-3 rounded-lg ${results?.has_hmmer_results ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            HMMER Results: {results?.has_hmmer_results ? "Available" : results?.perform_hmmer === "Yes" ? "Pending" : "N/A"}
          </div>
          <div className={`p-3 rounded-lg ${results?.has_logfile_pdf ? 'bg-green-50 text-green-700' : 'bg-gray-50 text-gray-500'}`}>
            Log File: {results?.has_logfile_pdf ? "Available" : "Pending"}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModelAngeloDashboard;
