import React from "react";
import { FiCheckSquare, FiSquare, FiX } from "react-icons/fi";

const SelectionToolbar = ({
  selectedCount = 0,
  filteredCount = 0,
  totalCount = 0,
  onSelectAll,
  onDeselectAll,
  selectedStats = {},
  filteredStats = {},
}) => {
  const hasSelection = selectedCount > 0;
  const hasFiltered = filteredCount < totalCount;

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Selection Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded transition-colors"
            title="Select all filtered micrographs"
          >
            <FiCheckSquare size={16} />
            <span>Select All</span>
          </button>

          {hasSelection && (
            <button
              onClick={onDeselectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 dark:text-slate-300 hover:text-red-600 dark:hover:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/30 rounded transition-colors"
              title="Clear selection"
            >
              <FiSquare size={16} />
              <span>Clear</span>
            </button>
          )}
        </div>

        {/* Selection Counter */}
        <div className="flex items-center gap-4">
          <div className="text-sm">
            <span className={`font-semibold ${hasSelection ? "text-blue-600 dark:text-blue-400" : "text-gray-500 dark:text-slate-400"}`}>
              {selectedCount}
            </span>
            <span className="text-gray-400 dark:text-slate-500"> / {filteredCount} selected</span>
          </div>

          {/* Selected Stats Summary */}
          {hasSelection && selectedStats.avgResolution && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-gray-500 dark:text-slate-400 border-l border-gray-200 dark:border-slate-700 pl-3">
              <span>
                Avg Res: <strong className="text-gray-700 dark:text-slate-200">{selectedStats.avgResolution?.toFixed(2)} A</strong>
              </span>
              <span>
                Avg FOM: <strong className="text-gray-700 dark:text-slate-200">{selectedStats.avgFOM?.toFixed(3)}</strong>
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Filter Summary Banner */}
      {hasFiltered && (
        <div className="mt-2 p-2 bg-green-50 dark:bg-green-900/30 rounded flex items-center justify-between">
          <div className="text-sm text-green-700">
            <strong>{filteredCount}</strong> of {totalCount} micrographs match your filter criteria
            {filteredStats.avgResolution && (
              <span className="ml-2 text-green-600">
                (Avg Res: {filteredStats.avgResolution?.toFixed(2)} Å, Avg FOM: {filteredStats.avgFOM?.toFixed(3)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Selection Info Banner */}
      {hasSelection && (
        <div className="mt-2 p-2 bg-blue-50 dark:bg-blue-900/30 rounded flex items-center justify-between">
          <p className="text-sm text-blue-700">
            <strong>{selectedCount}</strong> micrograph{selectedCount !== 1 ? "s" : ""} manually selected
          </p>
          <button
            onClick={onDeselectAll}
            className="text-blue-500 hover:text-blue-700"
          >
            <FiX size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectionToolbar;
