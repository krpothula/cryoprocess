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
    if (exportResult?.data?.downloadUrl) {
      window.open(exportResult.data.downloadUrl, "_blank");
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-[var(--color-bg-card)] rounded-xl shadow-xl w-full max-w-md mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[var(--color-border)]">
          <h3 className="text-lg font-semibold text-[var(--color-text-heading)]">
            {exportMode === "filtered" ? "Export Filtered Micrographs" : "Export Selected Micrographs"}
          </h3>
          <button
            onClick={onClose}
            className="p-1 text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] rounded"
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
              <h4 className="text-lg font-medium text-[var(--color-text-heading)] mb-2">
                Export Successful!
              </h4>
              <p className="text-sm text-[var(--color-text-secondary)] mb-4">
                Exported <strong>{exportResult.data?.selectedCount}</strong> micrographs
              </p>
              <div className="bg-[var(--color-bg)] rounded-lg p-3 mb-4">
                <p className="text-sm text-[var(--color-text-secondary)] mb-1">Filename:</p>
                <p className="text-sm font-medium text-[var(--color-text)]">
                  {exportResult.data?.filename}
                </p>
              </div>
              <button
                onClick={handleDownload}
                className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-[var(--color-primary)] text-white rounded-lg hover:bg-[var(--color-primary-hover)] transition-colors"
              >
                <FiDownload />
                <span>Download STAR File</span>
              </button>
            </div>
          ) : exportResult?.status === "error" ? (
            <div className="text-center py-4">
              <FiAlertCircle className="text-red-500 text-4xl mx-auto mb-3" />
              <h4 className="text-lg font-medium text-[var(--color-text-heading)] mb-2">
                Export Failed
              </h4>
              <p className="text-sm text-[var(--color-danger-text)]">
                {exportResult.message || "An error occurred during export"}
              </p>
            </div>
          ) : (
            <>
              {/* Selection Summary */}
              <div className={`rounded-lg p-4 ${exportMode === "filtered" ? "bg-[var(--color-success-bg)]" : "bg-[var(--color-info-bg)]"}`}>
                <div className="flex items-center gap-3">
                  {exportMode === "filtered" ? (
                    <FiFilter className="text-green-500 text-2xl" />
                  ) : (
                    <FiFile className="text-blue-500 text-2xl" />
                  )}
                  <div>
                    <p className="font-medium text-[var(--color-text-heading)]">
                      {selectedCount} micrograph{selectedCount !== 1 ? "s" : ""} {exportMode === "filtered" ? "matching filters" : "selected"}
                    </p>
                    <p className="text-sm text-[var(--color-text-secondary)]">
                      Will be exported to STAR file
                    </p>
                  </div>
                </div>
              </div>

              {/* Filter Criteria Display (for filtered mode) */}
              {exportMode === "filtered" && (
                <div className="bg-[var(--color-bg)] rounded-lg p-3">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)] mb-2">APPLIED FILTER CRITERIA</p>
                  <div className="space-y-1 text-sm">
                    {filters.maxResolution && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Max Resolution:</span>
                        <span className="font-medium text-[var(--color-text-heading)]">≤ {filters.maxResolution} Å</span>
                      </div>
                    )}
                    {filters.minFOM && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Min Figure of Merit:</span>
                        <span className="font-medium text-[var(--color-text-heading)]">≥ {filters.minFOM}</span>
                      </div>
                    )}
                    {filters.maxAstigmatism && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Max Astigmatism:</span>
                        <span className="font-medium text-[var(--color-text-heading)]">≤ {filters.maxAstigmatism} Å</span>
                      </div>
                    )}
                    {(filters.minDefocus || filters.maxDefocus) && (
                      <div className="flex justify-between">
                        <span className="text-[var(--color-text-secondary)]">Defocus Range:</span>
                        <span className="font-medium text-[var(--color-text-heading)]">
                          {filters.minDefocus || 0} - {filters.maxDefocus || "∞"} Å
                        </span>
                      </div>
                    )}
                    {!filters.maxResolution && !filters.minFOM && !filters.maxAstigmatism && !filters.minDefocus && !filters.maxDefocus && (
                      <p className="text-[var(--color-text-secondary)] italic">No filters applied - exporting all micrographs</p>
                    )}
                  </div>
                </div>
              )}

              {/* Quality Summary */}
              {selectedStats.avgResolution && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-[var(--color-bg)] rounded-lg p-3">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">Avg Resolution</p>
                    <p className="text-lg font-semibold text-[var(--color-text-heading)]">
                      {selectedStats.avgResolution?.toFixed(2)} Å
                    </p>
                  </div>
                  <div className="bg-[var(--color-bg)] rounded-lg p-3">
                    <p className="text-xs text-[var(--color-text-secondary)] mb-1">Avg Figure of Merit</p>
                    <p className="text-lg font-semibold text-[var(--color-text-heading)]">
                      {selectedStats.avgFOM?.toFixed(3)}
                    </p>
                  </div>
                </div>
              )}

              {/* Filename Input */}
              <div>
                <label className="block text-sm font-medium text-[var(--color-text)] mb-1">
                  Filename
                </label>
                <div className="flex items-center">
                  <input
                    type="text"
                    value={filename}
                    onChange={(e) => setFilename(e.target.value)}
                    className="flex-1 px-3 py-2 border border-[var(--color-border)] rounded-l-lg focus:outline-none focus:border-[var(--color-border-focus)]"
                    placeholder="Enter filename"
                  />
                  <span className="px-3 py-2 bg-[var(--color-bg-hover)] border border-l-0 border-[var(--color-border)] rounded-r-lg text-[var(--color-text-secondary)]">
                    .star
                  </span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 p-4 border-t border-[var(--color-border)]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-text-heading)] hover:bg-[var(--color-bg-hover)] rounded-lg transition-colors"
          >
            {exportResult?.status === "success" ? "Close" : "Cancel"}
          </button>
          {!exportResult && (
            <button
              onClick={handleExport}
              disabled={isExporting || selectedCount === 0}
              className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                isExporting || selectedCount === 0
                  ? "bg-[var(--color-bg-hover)] text-[var(--color-text-muted)] cursor-not-allowed"
                  : "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)]"
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
