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
        setCurrentPath(response.data.data.current_path || "");
        setProjectRoot(response.data.data.project_root || "");
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
    if (item.is_dir) {
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
      <div className="bg-white w-[700px] max-h-[80vh] rounded-lg shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">{title}</h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded hover:bg-gray-100"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Navigation Bar */}
        <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border-b border-gray-200">
          <button
            onClick={handleGoHome}
            className="p-1.5 text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
            title="Go to project root"
          >
            <FiHome size={16} />
          </button>
          <button
            onClick={handleGoBack}
            disabled={!currentPath}
            className={`p-1.5 rounded ${
              currentPath
                ? "text-gray-600 hover:text-gray-800 hover:bg-gray-200"
                : "text-gray-300 cursor-not-allowed"
            }`}
            title="Go back"
          >
            <FiArrowLeft size={16} />
          </button>

          {/* Breadcrumb */}
          <div className="flex items-center gap-1 text-sm text-gray-600 overflow-x-auto flex-1">
            <span
              className="text-blue-600 hover:underline cursor-pointer font-medium"
              onClick={handleGoHome}
            >
              {projectRoot || "Project"}
            </span>
            {pathParts.map((part, idx) => (
              <React.Fragment key={idx}>
                <FiChevronRight size={14} className="text-gray-400 flex-shrink-0" />
                <span
                  className={`${
                    idx === pathParts.length - 1
                      ? "text-gray-800 font-medium"
                      : "text-blue-600 hover:underline cursor-pointer"
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
              <BiLoader className="animate-spin text-blue-500 text-2xl mr-2" />
              <span className="text-gray-600">Loading...</span>
            </div>
          ) : error ? (
            <div className="flex items-center justify-center h-full text-red-500">
              {error}
            </div>
          ) : items.length === 0 ? (
            <div className="flex items-center justify-center h-full text-gray-500">
              {extensions ? `No files matching ${extensions} in this folder` : "This folder is empty"}
            </div>
          ) : (
            <div className="space-y-1">
              {items.map((item, idx) => (
                <div
                  key={idx}
                  onClick={() => handleItemClick(item)}
                  className={`flex items-center gap-3 px-3 py-2 rounded cursor-pointer hover:bg-gray-100 ${
                    item.is_dir ? "" : "hover:bg-blue-50"
                  }`}
                >
                  {item.is_dir ? (
                    <FiFolder className="text-yellow-500 text-lg flex-shrink-0" />
                  ) : (
                    <FiFile className="text-gray-400 text-lg flex-shrink-0" />
                  )}
                  <span className="flex-1 text-sm text-gray-800 truncate">
                    {item.name}
                  </span>
                  {!item.is_dir && item.size !== undefined && (
                    <span className="text-xs text-gray-500">
                      {formatFileSize(item.size)}
                    </span>
                  )}
                  {item.is_dir && (
                    <FiChevronRight className="text-gray-400" />
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200 bg-gray-50">
          <span className="text-xs text-gray-500">
            {extensions ? `Showing: ${extensions}` : "Showing all files"}
          </span>
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-200 rounded"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
};

export default FolderBrowserPopup;
