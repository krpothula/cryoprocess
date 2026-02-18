import React, { useState, useEffect } from "react";
import { FiX, FiFolder, FiFile, FiChevronRight, FiHome, FiArrowLeft } from "react-icons/fi";
import { BiLoader } from "react-icons/bi";
import { useBuilder } from "../../../../context/BuilderContext";
import { browseFolderApi } from "../../../../services/builders/jobs";

/**
 * FolderBrowserPopup - Browse project folder directly on filesystem
 *
 * @param {function} onClose - Callback when popup is closed
 * @param {function} onFileSelect - Callback when a file is selected, receives { path, name }
 * @param {string} extensions - Comma-separated file extensions to filter (e.g., ".mrc,.map")
 * @param {string} title - Title for the popup (default: "Browse Project Folder")
 */
const FolderBrowserPopup = ({ onClose, onFileSelect, extensions = "", title = "Browse Project Folder" }) => {
  const { projectId } = useBuilder();
  const [currentPath, setCurrentPath] = useState("");
  const [items, setItems] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState(null);
  const [projectRoot, setProjectRoot] = useState("");

  const loadFolder = async (path = "") => {
    if (!projectId) return;

    setIsLoading(true);
    setError(null);

    try {
      const response = await browseFolderApi(projectId, path, extensions);
      if (response?.data?.success) {
        setItems(response.data.data.items || []);
        setCurrentPath(response.data.data.currentPath || "");
        setProjectRoot(response.data.data.projectRoot || "");
      } else {
        setError(response?.data?.message || "Failed to load folder");
      }
    } catch (err) {
      setError(err?.response?.data?.message || "Error loading folder");
      console.error("Folder browser error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadFolder("");
  }, [projectId]);

  const handleItemClick = (item) => {
    if (item.isDir) {
      // Navigate into folder
      loadFolder(item.path);
    } else {
      // Select file
      onFileSelect({ path: item.path, name: item.name });
    }
  };

  const handleGoBack = () => {
    if (!currentPath) return;
    const parentPath = currentPath.split("/").slice(0, -1).join("/");
    loadFolder(parentPath);
  };

  const handleGoHome = () => {
    loadFolder("");
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  // Build breadcrumb path
  const pathParts = currentPath ? currentPath.split("/") : [];

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div className="bg-[var(--color-bg-card)] w-[700px] max-h-[80vh] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-heading)]">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] rounded hover:bg-[var(--color-bg-hover)]"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg)] border-b border-[var(--color-border)]">
          <button
            onClick={handleGoHome}
            className="p-1.5 text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-bg-hover)] rounded"
            title="Go to project root"
          >
            <FiHome size={16} />
          </button>
          <button
            onClick={handleGoBack}
            disabled={!currentPath}
            className={`p-1.5 rounded ${
              currentPath
                ? "text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-bg-hover)]"
                : "text-[var(--color-border)] cursor-not-allowed"
            }`}
            title="Go back"
          >
            <FiArrowLeft size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-[var(--color-text-secondary)] overflow-x-auto flex-1">
            <span
              className="text-[var(--color-primary)] hover:underline cursor-pointer font-medium"
              onClick={handleGoHome}
            >
              {projectRoot || "Project"}
            </span>
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                <FiChevronRight size={14} className="text-[var(--color-text-muted)] flex-shrink-0" />
                <span
                  className={`${
                    idx === pathParts.length - 1
                      ? "text-[var(--color-text-heading)] font-medium"
                      : "text-[var(--color-primary)] hover:underline cursor-pointer"
                  }`}
                  onClick={() => {
                    if (idx < pathParts.length - 1) {
                      loadFolder(pathParts.slice(0, idx + 1).join("/"));
                    }
                  }}
                >
                  {part}
                </span>
              </React.Fragment>
            ))}
          </div>
        </div>

        {/* File List */}
        <div className="flex-1 overflow-y-auto p-2 min-h-[300px]">
          {isLoading ? (
            <div className="flex items-center justify-center h-full">
              <BiLoader className="animate-spin text-[var(--color-primary)] text-2xl mr-2" />
              <span className="text-[var(--color-text-secondary)]">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-[var(--color-danger-text)]">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-[var(--color-text-secondary)]">
              {extensions ? `No files matching ${extensions} in this folder` : "This folder is empty"}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-[var(--color-bg-hover)] ${
                    item.isDir ? "" : "hover:bg-[var(--color-info-bg)]"
                  }`}
                >
                  {item.isDir ? (
                    <FiFolder className="text-[var(--color-warning-text)] text-lg flex-shrink-0" />
                  ) : (
                    <FiFile className="text-[var(--color-text-muted)] text-lg flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-[var(--color-text-heading)] truncate">
                    {item.name}
                  </span>
                  {!item.isDir && item.size !== undefined && (
                    <span className="text-xs text-[var(--color-text-secondary)]">
                      {formatFileSize(item.size)}
                    </span>
                  )}
                  {item.isDir && (
                    <FiChevronRight className="text-[var(--color-text-muted)]" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--color-border)] bg-[var(--color-bg)]">
          <span className="text-xs text-[var(--color-text-secondary)]">
            {extensions ? `Showing: ${extensions}` : "Showing all files"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-bg-hover)] rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderBrowserPopup;
