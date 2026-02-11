import React, { useState, useEffect } from "react";
import { FiX, FiDownload, FiFile, FiCheckCircle, FiAlertCircle, FiFilter } from "react-icons/fi";

const ExportModal = ({
  isOpen,
  onClose,
  onExport,
  selectedCount = 0,
  selectedStats = {},
  isExporting = false,
  exportResult = null,
  exportMode = "filtered",
  filters = {},
}) => {
  const [filename, setFilename] = useState("filtered_micrographs_ctf");

  // Update default filename based on export mode
  useEffect(() => {
    if (exportMode === "filtered") {
      setFilename("filtered_micrographs_ctf");
    } else {
      setFilename("selected_micrographs_ctf");
    }
  }, [exportMode]);

  if (!isOpen) return null;

  const handleExport = () => {
    onExport(filename + ".star");
  };

  const handleDownload = () => {
    if (exportResult?.download_url) {
      window.open(exportResult.download_url, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-800">
            {exportMode === "filtered" ? "Export Filtered Micrographs" : "Export Selected Micrographs"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
          >
            <FiX size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4">
          {/* Success State */}
          {exportResult?.status === "success" ? (
            <div className="text-center py-4">
              <FiCheckCircle className="text-green-500 text-4xl mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-800 mb-2">
                Export Successful!
              </h4>
              <p className="text-sm text-gray-600 mb-4">
                Exported <strong>{exportResult.data?.selected_count}</strong> micrographs
              </p>
              <div className="bg-gray-50 rounded-lg p-3 mb-4">
                <p className="text-sm text-gray-500 mb-1">Filename:</p>
                <p className="text-sm font-medium text-gray-700">
                  {exportResult.data?.filename}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
              >
                <FiDownload />
                <span>Download STAR File</span>
              </button>
            </div>
          ) : exportResult?.status === "error" ? (
            <div className="text-center py-4">
              <FiAlertCircle className="text-red-500 text-4xl mx-auto mb-3" />
              <h4 className="text-lg font-medium text-gray-800 mb-2">
                Export Failed
              </h4>
              <p className="text-sm text-red-600">
                {exportResult.message || "An error occurred during export"}
              </p>
            </div>
          ) : (
            <>
              {/* Selection Summary */}
              <div className={`rounded-lg p-4 ${exportMode === "filtered" ? "bg-green-50" : "bg-blue-50"}`}>
                <div className="flex items-center gap-3">
                  {exportMode === "filtered" ? (
                    <FiFilter className="text-green-500 text-2xl" />
                  ) : (
                    <FiFile className="text-blue-500 text-2xl" />
                  )}
                  <div>
                    <p className="font-medium text-gray-800">
                      {selectedCount} micrograph{selectedCount !== 1 ? "s" : ""} {exportMode === "filtered" ? "matching filters" : "selected"}
                    </p>
                    <p className="text-sm text-gray-600">
                      Will be exported to STAR file
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter Criteria Display (for filtered mode) */}
              {exportMode === "filtered" && (
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-medium text-gray-500 mb-2">APPLIED FILTER CRITERIA</p>
                  <div className="space-y-1 text-sm">
                    {filters.maxResolution && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Max Resolution:</span>
                        <span className="font-medium text-gray-800">≤ {filters.maxResolution} Å</span>
                      </div>
                    )}
                    {filters.minFOM && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Min Figure of Merit:</span>
                        <span className="font-medium text-gray-800">≥ {filters.minFOM}</span>
                      </div>
                    )}
                    {filters.maxAstigmatism && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Max Astigmatism:</span>
                        <span className="font-medium text-gray-800">≤ {filters.maxAstigmatism} Å</span>
                      </div>
                    )}
                    {(filters.minDefocus || filters.maxDefocus) && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">Defocus Range:</span>
                        <span className="font-medium text-gray-800">
                          {filters.minDefocus || 0} - {filters.maxDefocus || "∞"} Å
                        </span>
                      </div>
                    )}
                    {!filters.maxResolution && !filters.minFOM && !filters.maxAstigmatism && !filters.minDefocus && !filters.maxDefocus && (
                      <p className="text-gray-500 italic">No filters applied - exporting all micrographs</p>
                    )}
                  </div>
                </div>
              )}

              {/* Quality Summary */}
              {selectedStats.avgResolution && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Avg Resolution</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {selectedStats.avgResolution?.toFixed(2)} Å
                    </p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-3">
                    <p className="text-xs text-gray-500 mb-1">Avg Figure of Merit</p>
                    <p className="text-lg font-semibold text-gray-800">
                      {selectedStats.avgFOM?.toFixed(3)}
                    </p>
                  </div>
                </div>
              )}

              {/* Filename Input */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Filename
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-200 rounded-l-lg focus:outline-none focus:border-blue-300"
                    placeholder="Enter filename"
                  />
                  <span className="px-3 py-2 bg-gray-100 border border-l-0 border-gray-200 rounded-r-lg text-gray-500">
                    .star
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-200">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          >
            {exportResult?.status === "success" ? "Close" : "Cancel"}
          </button>
          {!exportResult && (
            <button
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isExporting || selectedCount === 0
                  ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                  : "bg-blue-500 text-white hover:bg-blue-600"
              }`}
            >
              {isExporting ? (
                <>
                  <span className="animate-spin">...</span>
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <FiDownload />
                  <span>Export</span>
                </>
              )}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ExportModal;
