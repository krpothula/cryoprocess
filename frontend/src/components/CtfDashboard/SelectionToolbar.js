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
    <div className="bg-[var(--color-bg-card)] rounded-lg border border-[var(--color-border)] p-3">
      <div className="flex items-center justify-between flex-wrap gap-2">
        {/* Selection Controls */}
        <div className="flex items-center gap-2">
          <button
            onClick={onSelectAll}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-primary)] hover:bg-[var(--color-info-bg)] rounded transition-colors"
            title="Select all filtered micrographs"
          >
            <FiCheckSquare size={16} />
            <span>Select All</span>
          </button>

          {hasSelection && (
            <button
              onClick={onDeselectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-[var(--color-text-secondary)] hover:text-[var(--color-danger-text)] hover:bg-[var(--color-danger-bg)] rounded transition-colors"
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
            <span className={`font-semibold ${hasSelection ? "text-[var(--color-primary)]" : "text-[var(--color-text-secondary)]"}`}>
              {selectedCount}
            </span>
            <span className="text-[var(--color-text-muted)]"> / {filteredCount} selected</span>
          </div>

          {/* Selected Stats Summary */}
          {hasSelection && selectedStats.avgResolution && (
            <div className="hidden sm:flex items-center gap-3 text-xs text-[var(--color-text-secondary)] border-l border-[var(--color-border)] pl-3">
              <span>
                Avg Res: <strong className="text-[var(--color-text)]">{selectedStats.avgResolution?.toFixed(2)} A</strong>
              </span>
              <span>
                Avg FOM: <strong className="text-[var(--color-text)]">{selectedStats.avgFOM?.toFixed(3)}</strong>
              </span>
            </div>
          )}

        </div>
      </div>

      {/* Filter Summary Banner */}
      {hasFiltered && (
        <div className="mt-2 p-2 bg-[var(--color-success-bg)] rounded flex items-center justify-between">
          <div className="text-sm text-[var(--color-success)]">
            <strong>{filteredCount}</strong> of {totalCount} micrographs match your filter criteria
            {filteredStats.avgResolution && (
              <span className="ml-2 text-[var(--color-success)]">
                (Avg Res: {filteredStats.avgResolution?.toFixed(2)} Å, Avg FOM: {filteredStats.avgFOM?.toFixed(3)})
              </span>
            )}
          </div>
        </div>
      )}

      {/* Selection Info Banner */}
      {hasSelection && (
        <div className="mt-2 p-2 bg-[var(--color-info-bg)] rounded flex items-center justify-between">
          <p className="text-sm text-[var(--color-primary)]">
            <strong>{selectedCount}</strong> micrograph{selectedCount !== 1 ? "s" : ""} manually selected
          </p>
          <button
            onClick={onDeselectAll}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
          >
            <FiX size={16} />
          </button>
        </div>
      )}
    </div>
  );
};

export default SelectionToolbar;
