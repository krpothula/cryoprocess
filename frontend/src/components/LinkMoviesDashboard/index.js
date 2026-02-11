import React, { useEffect, useState, useCallback } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { getLinkMoviesResultsApi } from "../../services/builders/link-movies/link-movies";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiLink,
  FiFile,
  FiFolder,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
} from "react-icons/fi";

const LinkMoviesDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Copy command to clipboard
  const copyCommand = () => {
    if (selectedJob?.command || results?.command) {
      navigator.clipboard.writeText(selectedJob?.command || results?.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Fetch results
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getLinkMoviesResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load Link Movies results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJob?.id]);

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
          Loading Link Movies results...
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

  const command = selectedJob?.command || results?.command;
  const linkedCount = results?.linked_count || 0;
  const linkedFiles = results?.linked_files || [];
  const summary = results?.summary || {};

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
                  : selectedJob?.status || results?.job_status}
              </p>
            </div>
          </div>
        </div>

        {/* Command Section */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-gray-400" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>Shell Script</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} />
              )}
            </button>
            {showCommand && command && (
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
              {command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiLink className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Files Linked:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {linkedCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiFolder className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Destination:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }} title={results?.destination_folder}>
              {results?.destination_folder?.split("/").slice(-2).join("/") || "Movies"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiExternalLink className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Link Type:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {summary["Link Type"] || "Symlink"}
            </span>
          </div>
        </div>
      </div>

      {/* Linked Files List */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiFile className="text-blue-500" />
          Linked Files ({linkedFiles.length})
        </h3>

        {linkedFiles.length === 0 ? (
          <div className="text-center py-8 text-gray-400">
            <FiFile className="text-4xl mx-auto mb-2" />
            <p>No files linked yet</p>
          </div>
        ) : (
          <div className="max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 sticky top-0">
                <tr>
                  <th className="text-left p-2 font-medium text-gray-600">Name</th>
                  <th className="text-left p-2 font-medium text-gray-600">Type</th>
                  <th className="text-left p-2 font-medium text-gray-600">Target</th>
                </tr>
              </thead>
              <tbody>
                {linkedFiles.map((file, idx) => (
                  <tr key={idx} className="border-t hover:bg-gray-50">
                    <td className="p-2 flex items-center gap-2">
                      <FiFile className="text-gray-400" />
                      <span className="truncate max-w-[200px]" title={file.name}>
                        {file.name}
                      </span>
                    </td>
                    <td className="p-2">
                      {file.is_symlink ? (
                        <span className="text-blue-600 flex items-center gap-1">
                          <FiExternalLink className="text-xs" />
                          Symlink
                        </span>
                      ) : (
                        <span className="text-green-600">Copy</span>
                      )}
                    </td>
                    <td className="p-2 text-gray-500 truncate max-w-[300px]" title={file.target}>
                      {file.target || "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkMoviesDashboard;
