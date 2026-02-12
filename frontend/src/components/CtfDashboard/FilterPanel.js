import React from "react";
import { FiFilter, FiRefreshCw } from "react-icons/fi";
import RangeSlider from "./RangeSlider";

const FilterPanel = ({
  filters,
  onFilterChange,
  onReset,
  stats = {},
  filteredCount = 0,
  totalCount = 0,
}) => {
  const handleSliderChange = (field, value) => {
    onFilterChange({ ...filters, [field]: value === "" ? null : parseFloat(value) });
  };

  const resolutionStats = stats.resolution || { min: 2, max: 8, mean: 4 };
  const fomStats = { min: 0.5, max: 1.0 };
  const astigStats = stats.astigmatism || { min: 0, max: 200, mean: 50 };

  return (
    <div className="bg-white dark:bg-slate-800 rounded-lg border border-gray-200 dark:border-slate-700 p-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <FiFilter className="text-blue-500" />
          <span className="font-semibold text-gray-700 dark:text-slate-200">Quality Filters</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500 dark:text-slate-400">
            {filteredCount} of {totalCount} micrographs
          </span>
          <button
            onClick={onReset}
            className="p-1.5 text-gray-400 dark:text-slate-500 hover:text-gray-600 dark:hover:text-slate-300 hover:bg-gray-100 dark:hover:bg-slate-700 rounded"
            title="Reset filters"
          >
            <FiRefreshCw size={14} />
          </button>
        </div>
      </div>

      {/* Filter Controls */}
      <div className="space-y-4">
        {/* Max Resolution (lower is better) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600 dark:text-slate-300">
              Max Resolution (A)
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
              {filters.maxResolution ? `≤ ${filters.maxResolution}` : "Any"}
            </span>
          </div>
          <RangeSlider
            min={resolutionStats.min || 2}
            max={resolutionStats.max || 8}
            step={0.1}
            value={filters.maxResolution || resolutionStats.max || 8}
            onChange={(e) => handleSliderChange("maxResolution", e.target.value)}
            color="blue"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
            <span>Better ({resolutionStats.min?.toFixed(1) || "2.0"})</span>
            <span>Worse ({resolutionStats.max?.toFixed(1) || "8.0"})</span>
          </div>
        </div>

        {/* Min Figure of Merit (higher is better) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600 dark:text-slate-300">
              Min Figure of Merit
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
              {filters.minFOM ? `≥ ${filters.minFOM}` : "Any"}
            </span>
          </div>
          <RangeSlider
            min={fomStats.min}
            max={fomStats.max}
            step={0.01}
            value={filters.minFOM || fomStats.min}
            onChange={(e) => handleSliderChange("minFOM", e.target.value)}
            color="green"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
            <span>Worse (0.50)</span>
            <span>Better (1.00)</span>
          </div>
        </div>

        {/* Max Astigmatism (lower is better) */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600 dark:text-slate-300">
              Max Astigmatism (A)
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
              {filters.maxAstigmatism ? `≤ ${filters.maxAstigmatism}` : "Any"}
            </span>
          </div>
          <RangeSlider
            min={0}
            max={astigStats.max || 200}
            step={5}
            value={filters.maxAstigmatism || astigStats.max || 200}
            onChange={(e) => handleSliderChange("maxAstigmatism", e.target.value)}
            color="orange"
          />
          <div className="flex justify-between text-xs text-gray-400 dark:text-slate-500 mt-1">
            <span>Better (0)</span>
            <span>Worse ({astigStats.max?.toFixed(0) || "200"})</span>
          </div>
        </div>

        {/* Defocus Range */}
        <div>
          <div className="flex justify-between items-center mb-1">
            <label className="text-sm text-gray-600 dark:text-slate-300">
              Defocus Range (A)
            </label>
            <span className="text-sm font-medium text-gray-700 dark:text-slate-200">
              {filters.minDefocus || filters.maxDefocus
                ? `${filters.minDefocus || 0} - ${filters.maxDefocus || "∞"}`
                : "Any"}
            </span>
          </div>
          <div className="flex gap-2">
            <input
              type="number"
              placeholder="Min"
              value={filters.minDefocus || ""}
              onChange={(e) => handleSliderChange("minDefocus", e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-300"
            />
            <span className="text-gray-400 dark:text-slate-500">-</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxDefocus || ""}
              onChange={(e) => handleSliderChange("maxDefocus", e.target.value)}
              className="flex-1 px-2 py-1 text-sm border border-gray-200 dark:border-slate-700 rounded focus:outline-none focus:border-blue-300"
            />
          </div>
        </div>
      </div>

      {/* Filter Summary */}
      {filteredCount < totalCount && (
        <div className="mt-4 p-2 bg-blue-50 dark:bg-blue-900/30 rounded-lg">
          <p className="text-sm text-blue-700">
            Showing <strong>{filteredCount}</strong> of {totalCount} micrographs
            {totalCount - filteredCount > 0 && (
              <span className="text-blue-500">
                {" "}({totalCount - filteredCount} filtered out)
              </span>
            )}
          </p>
        </div>
      )}
    </div>
  );
};

export default FilterPanel;
