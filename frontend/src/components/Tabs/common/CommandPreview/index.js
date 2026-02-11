/**
 * CommandPreview - Debug component to show the command that will be built
 *
 * Shows a "Preview" button next to Submit that displays the command below when clicked.
 * Styled to match the dashboard command display exactly.
 *
 * TOGGLE ON/OFF:
 * - Set DEBUG_MODE = true/false below
 */

import React, { useState } from "react";
import { FiTerminal, FiCopy, FiChevronUp, FiChevronDown } from "react-icons/fi";
import { previewCommandAPI } from "../../../../services/builders/preview";

// ============================================
// DEBUG MODE TOGGLE - Set to false for production
// ============================================
const DEBUG_MODE = false;
// ============================================

const CommandPreview = ({ formData, jobType, projectId }) => {
  const [command, setCommand] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  // Don't render if debug mode is disabled
  if (!DEBUG_MODE) {
    return null;
  }

  const fetchCommandPreview = async () => {
    setLoading(true);
    setError("");

    try {
      const response = await previewCommandAPI({
        ...formData,
        project_id: projectId,
        job_type: jobType,
      });

      if (response?.data?.command) {
        setCommand(response.data.command);
        setShowCommand(true);
      } else if (response?.data?.error) {
        setError(response.data.error);
        setShowCommand(true);
      }
    } catch (err) {
      setError(err.response?.data?.message || err.response?.data?.error || err.message || "Failed to preview command");
      setShowCommand(true);
    } finally {
      setLoading(false);
    }
  };

  const handlePreviewClick = (e) => {
    e.preventDefault();
    if (showCommand) {
      setShowCommand(false);
      setCommand("");
      setError("");
    } else {
      fetchCommandPreview();
    }
  };

  const copyCommand = () => {
    navigator.clipboard.writeText(command);
    setCommandCopied(true);
    setTimeout(() => setCommandCopied(false), 2000);
  };

  return (
    <div className="mt-4">
      {/* Preview button */}
      <button
        type="button"
        onClick={handlePreviewClick}
        disabled={loading}
        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 font-semibold min-w-[120px] transition-colors rounded"
      >
        <FiTerminal />
        {loading ? "Loading..." : showCommand ? "Hide Command" : "Preview Command"}
      </button>

      {/* Command display below button */}
      {showCommand && (
        <div className="mt-4 border-t pt-4">
          <button
            onClick={handlePreviewClick}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900 transition-colors"
          >
            <FiTerminal className="text-blue-500" />
            <span>RELION Command</span>
            {showCommand ? (
              <FiChevronUp className="text-gray-400" />
            ) : (
              <FiChevronDown className="text-gray-400" />
            )}
          </button>

          {error && (
            <div className="mt-3 bg-red-50 border border-red-200 text-red-700 p-3 rounded-lg text-sm">
              Error: {error}
            </div>
          )}

          {command && (
            <div className="mt-3 relative">
              <pre className="bg-gray-900 text-green-400 p-4 rounded-lg text-xs overflow-x-auto font-mono leading-relaxed">
                {command}
              </pre>
              <button
                onClick={copyCommand}
                className="absolute top-2 right-2 p-2 bg-gray-700 hover:bg-gray-600 rounded text-gray-300 hover:text-white transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-sm" />
              </button>
              {commandCopied && (
                <span className="absolute top-2 right-12 text-xs text-green-400 bg-gray-800 px-2 py-1 rounded">
                  Copied!
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default CommandPreview;
