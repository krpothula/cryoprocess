import React, { useState, useMemo, useRef, useEffect } from "react";
import { FiTarget, FiZap, FiCircle, FiAward, FiChevronDown } from "react-icons/fi";
import ProgressRing from "./ProgressRing";

const PARAMETERS = [
  { id: "defocus", label: "Defocus", unit: "Å", icon: FiTarget, color: "blue", key: "defocusAvg" },
  { id: "resolution", label: "CTF Resolution", unit: "Å", icon: FiZap, color: "green", key: "ctfMaxResolution" },
  { id: "astigmatism", label: "Astigmatism", unit: "Å", icon: FiCircle, color: "orange", key: "astigmatism" },
  { id: "fom", label: "Figure of Merit", unit: "", icon: FiAward, color: "purple", key: "ctfFigureOfMerit" },
];

const CTFParameterPlot = ({
  micrographs = [],
  onRangeSelect,
  progress = 0,
  processed = 0,
  total = 0
}) => {
  const [selectedParam, setSelectedParam] = useState(PARAMETERS[0]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [rangeSelection, setRangeSelection] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(null);
  const svgRef = useRef(null);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Calculate histogram data
  const histogramData = useMemo(() => {
    if (micrographs.length === 0) return { bins: [], min: 0, max: 0, maxCount: 0 };

    // Extract values for selected parameter
    const values = micrographs.map((m) => {
      if (selectedParam.id === "astigmatism") {
        return Math.abs((m.defocusU || 0) - (m.defocusV || 0));
      }
      return m[selectedParam.key] || 0;
    }).filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return { bins: [], min: 0, max: 0, maxCount: 0 };

    const min = Math.min(...values);
    const max = Math.max(...values);
    const range = max - min || 1;
    const binCount = 20;
    const binWidth = range / binCount;

    // Create bins
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
      values: [],
    }));

    // Fill bins
    values.forEach((value) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        binCount - 1
      );
      if (binIndex >= 0 && binIndex < bins.length) {
        bins[binIndex].count++;
        bins[binIndex].values.push(value);
      }
    });

    const maxCount = Math.max(...bins.map((b) => b.count), 1);

    return { bins, min, max, maxCount, binWidth };
  }, [micrographs, selectedParam]);

  // Calculate stats
  const stats = useMemo(() => {
    if (micrographs.length === 0) return { avg: 0, min: 0, max: 0 };

    const values = micrographs.map((m) => {
      if (selectedParam.id === "astigmatism") {
        return Math.abs((m.defocusU || 0) - (m.defocusV || 0));
      }
      return m[selectedParam.key] || 0;
    }).filter(v => v !== null && v !== undefined && !isNaN(v));

    if (values.length === 0) return { avg: 0, min: 0, max: 0 };

    return {
      avg: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
    };
  }, [micrographs, selectedParam]);

  // SVG dimensions
  const width = 620;
  const height = 180;
  const margin = { top: 20, right: 40, bottom: 35, left: 50 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Handle mouse events for range selection
  const getValueFromX = (clientX) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - margin.left;
    const ratio = Math.max(0, Math.min(1, x / plotWidth));
    return histogramData.min + ratio * (histogramData.max - histogramData.min);
  };

  const handleMouseDown = (e) => {
    const value = getValueFromX(e.clientX);
    if (value !== null) {
      setIsDragging(true);
      setDragStart(value);
      setRangeSelection({ start: value, end: value });
    }
  };

  const handleMouseMove = (e) => {
    if (!isDragging || dragStart === null) return;
    const value = getValueFromX(e.clientX);
    if (value !== null) {
      setRangeSelection({
        start: Math.min(dragStart, value),
        end: Math.max(dragStart, value),
      });
    }
  };

  const handleMouseUp = () => {
    if (isDragging && rangeSelection) {
      // Apply filter
      if (onRangeSelect && rangeSelection.end - rangeSelection.start > 0.001) {
        onRangeSelect(selectedParam.id, rangeSelection.start, rangeSelection.end);
      }
    }
    setIsDragging(false);
    setDragStart(null);
  };

  // Clear selection
  const clearSelection = () => {
    setRangeSelection(null);
    if (onRangeSelect) {
      onRangeSelect(selectedParam.id, null, null);
    }
  };

  // Get color classes based on parameter
  const getColorClasses = (color) => {
    const colors = {
      blue: { bg: "bg-blue-500", light: "bg-blue-100", text: "text-blue-600", fill: "#3b82f6", lightFill: "#dbeafe" },
      green: { bg: "bg-green-500", light: "bg-green-100", text: "text-green-600", fill: "#22c55e", lightFill: "#dcfce7" },
      orange: { bg: "bg-orange-500", light: "bg-orange-100", text: "text-orange-600", fill: "#f97316", lightFill: "#ffedd5" },
      purple: { bg: "bg-purple-500", light: "bg-purple-100", text: "text-purple-600", fill: "#a855f7", lightFill: "#f3e8ff" },
    };
    return colors[color] || colors.blue;
  };

  const colorClasses = getColorClasses(selectedParam.color);
  const Icon = selectedParam.icon;

  return (
    <div className="bg-[var(--color-bg-card)] rounded-lg p-4 border border-[var(--color-border)]">
      {/* Header with Progress and Parameter Selector */}
      <div className="flex items-center justify-between mb-4">
        {/* Progress Ring */}
        <div className="flex items-center gap-3">
          <ProgressRing progress={progress} size={50} />
          <div>
            <p className="text-sm text-[var(--color-text-secondary)]">Micrographs</p>
            <p className="text-xl font-bold text-[var(--color-text-heading)]">
              {processed}/{total}
            </p>
          </div>
        </div>

        {/* Parameter Dropdown */}
        <div className="relative" ref={dropdownRef}>
          <button
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--color-bg-hover)] hover:bg-[var(--color-bg-active)] rounded-lg transition-colors"
          >
            <Icon className={colorClasses.text} size={18} />
            <span className="font-medium text-[var(--color-text)]">{selectedParam.label}</span>
            <FiChevronDown className={`text-[var(--color-text-secondary)] transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
          </button>

          {dropdownOpen && (
            <div className="absolute right-0 mt-2 w-48 bg-[var(--color-bg-card)] rounded-lg shadow-lg border border-[var(--color-border)] z-10">
              {PARAMETERS.map((param) => {
                const ParamIcon = param.icon;
                const paramColors = getColorClasses(param.color);
                return (
                  <button
                    key={param.id}
                    onClick={() => {
                      setSelectedParam(param);
                      setDropdownOpen(false);
                      setRangeSelection(null);
                    }}
                    className={`w-full flex items-center gap-2 px-4 py-2 hover:bg-[var(--color-bg-hover)] transition-colors ${
                      selectedParam.id === param.id ? 'bg-[var(--color-bg-hover)]' : ''
                    } first:rounded-t-lg last:rounded-b-lg`}
                  >
                    <ParamIcon className={paramColors.text} size={16} />
                    <span className="text-[var(--color-text)]">{param.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Stats Summary */}
        <div className="flex items-center gap-6 text-sm">
          <div>
            <span className="text-[var(--color-text-secondary)]">Min: </span>
            <span className={`font-medium ${colorClasses.text}`}>
              {stats.min.toFixed(selectedParam.id === 'fom' ? 3 : 1)} {selectedParam.unit}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">Avg: </span>
            <span className={`font-medium ${colorClasses.text}`}>
              {stats.avg.toFixed(selectedParam.id === 'fom' ? 3 : 1)} {selectedParam.unit}
            </span>
          </div>
          <div>
            <span className="text-[var(--color-text-secondary)]">Max: </span>
            <span className={`font-medium ${colorClasses.text}`}>
              {stats.max.toFixed(selectedParam.id === 'fom' ? 3 : 1)} {selectedParam.unit}
            </span>
          </div>
        </div>
      </div>

      {/* Histogram Chart */}
      {histogramData.bins.length > 0 ? (
        <div className="relative">
          <svg
            ref={svgRef}
            width="100%"
            height={height}
            viewBox={`0 0 ${width} ${height}`}
            preserveAspectRatio="xMidYMid meet"
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
            className="cursor-crosshair"
          >
            <g transform={`translate(${margin.left}, ${margin.top})`}>
              {/* Background grid */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => (
                <line
                  key={ratio}
                  x1={0}
                  y1={plotHeight * (1 - ratio)}
                  x2={plotWidth}
                  y2={plotHeight * (1 - ratio)}
                  stroke="var(--color-chart-grid)"
                  strokeDasharray="4,4"
                />
              ))}

              {/* Range selection highlight */}
              {rangeSelection && (
                <rect
                  x={((rangeSelection.start - histogramData.min) / (histogramData.max - histogramData.min)) * plotWidth}
                  y={0}
                  width={((rangeSelection.end - rangeSelection.start) / (histogramData.max - histogramData.min)) * plotWidth}
                  height={plotHeight}
                  fill={colorClasses.fill}
                  opacity={0.2}
                />
              )}

              {/* Histogram bars */}
              {histogramData.bins.map((bin, i) => {
                const barWidth = plotWidth / histogramData.bins.length - 2;
                const barHeight = (bin.count / histogramData.maxCount) * plotHeight;
                const x = (i / histogramData.bins.length) * plotWidth + 1;
                const y = plotHeight - barHeight;

                // Check if bar is in selection
                const inSelection = rangeSelection &&
                  bin.end >= rangeSelection.start &&
                  bin.start <= rangeSelection.end;

                return (
                  <g key={i}>
                    <rect
                      x={x}
                      y={y}
                      width={barWidth}
                      height={barHeight}
                      fill={inSelection ? colorClasses.fill : colorClasses.lightFill}
                      stroke={colorClasses.fill}
                      strokeWidth={inSelection ? 2 : 1}
                      rx={2}
                      className="transition-all duration-150"
                    />
                    {/* Tooltip on hover */}
                    <title>
                      {`${bin.start.toFixed(1)} - ${bin.end.toFixed(1)} ${selectedParam.unit}: ${bin.count} micrographs`}
                    </title>
                  </g>
                );
              })}

              {/* X-axis */}
              <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="var(--color-text-muted)" />

              {/* X-axis labels */}
              {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
                const value = histogramData.min + ratio * (histogramData.max - histogramData.min);
                // Adjust text anchor for edge labels to prevent overflow
                const anchor = ratio === 0 ? "start" : ratio === 1 ? "end" : "middle";
                return (
                  <text
                    key={ratio}
                    x={ratio * plotWidth}
                    y={plotHeight + 20}
                    textAnchor={anchor}
                    className="text-xs fill-[var(--color-text-secondary)]"
                  >
                    {value.toFixed(selectedParam.id === 'fom' ? 2 : 0)}
                  </text>
                );
              })}

              {/* Y-axis */}
              <line x1={0} y1={0} x2={0} y2={plotHeight} stroke="var(--color-text-muted)" />

              {/* Y-axis label */}
              <text
                x={-plotHeight / 2}
                y={-35}
                transform="rotate(-90)"
                textAnchor="middle"
                className="text-xs fill-[var(--color-text-secondary)]"
              >
                Count
              </text>

              {/* X-axis title */}
              <text
                x={plotWidth / 2}
                y={plotHeight + 32}
                textAnchor="middle"
                className="text-xs fill-[var(--color-text-secondary)] font-medium"
              >
                {selectedParam.label} {selectedParam.unit && `(${selectedParam.unit})`}
              </text>
            </g>
          </svg>

          {/* Selection info */}
          {rangeSelection && (
            <div className="absolute top-2 right-2 flex items-center gap-2 bg-[var(--color-bg-card)] px-3 py-1.5 rounded-lg shadow border border-[var(--color-border)]">
              <span className="text-sm text-[var(--color-text-secondary)]">
                Selected: {rangeSelection.start.toFixed(1)} - {rangeSelection.end.toFixed(1)} {selectedParam.unit}
              </span>
              <button
                onClick={clearSelection}
                className="text-xs text-[var(--color-danger)] hover:text-[var(--color-danger-text)] font-medium"
              >
                Clear
              </button>
            </div>
          )}

          {/* Drag instruction */}
          {!rangeSelection && (
            <div className="absolute bottom-0 right-2 text-xs text-[var(--color-text-muted)]">
              Drag to select range
            </div>
          )}
        </div>
      ) : (
        <div className="h-40 flex items-center justify-center text-[var(--color-text-muted)]">
          No data available
        </div>
      )}
    </div>
  );
};

export default CTFParameterPlot;
