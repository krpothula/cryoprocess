import React, { useMemo, useRef, useState } from "react";

const CTFParameterHistogram = ({
  micrographs = [],
  paramKey,
  title,
  unit = "",
  color = "blue",
  filterValue = null,  // Current filter value from parent (single mode)
  filterType = "max",  // "max" (filter <= value) or "min" (filter >= value)
  onFilterChange,      // Callback when filter changes (single mode)
  // Range mode props (for defocus min+max)
  rangeFilter = false,
  filterMinValue = null,
  filterMaxValue = null,
  onFilterMinChange,
  onFilterMaxChange,
}) => {
  const svgRef = useRef(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragTarget, setDragTarget] = useState(null); // "min" or "max" for range mode
  const [hoverValue, setHoverValue] = useState(null);

  // Calculate histogram data
  const histogramData = useMemo(() => {
    if (micrographs.length === 0) return { bins: [], min: 0, max: 0, maxCount: 0 };

    // Extract values for selected parameter (exclude null/undefined/NaN)
    const values = micrographs.map((m) => {
      if (paramKey === "astigmatism") {
        const du = m.defocusU;
        const dv = m.defocusV;
        if (du == null || dv == null) return null;
        return Math.abs(du - dv);
      }
      if (paramKey === "defocusAvg") {
        const du = m.defocusU;
        const dv = m.defocusV;
        if (du == null || dv == null) return null;
        return (du + dv) / 2;
      }
      return m[paramKey] != null ? m[paramKey] : null;
    }).filter(v => v !== null && !isNaN(v));

    if (values.length === 0) return { bins: [], min: 0, max: 0, maxCount: 0 };

    // Use reduce instead of Math.min/max(...values) to avoid stack overflow with large arrays
    let min = values[0], max = values[0];
    for (let i = 1; i < values.length; i++) {
      if (values[i] < min) min = values[i];
      if (values[i] > max) max = values[i];
    }
    const range = max - min;

    // If all values are identical, show a single bin
    if (range === 0) {
      return {
        bins: [{ start: min, end: min, count: values.length }],
        min,
        max,
        maxCount: values.length,
        avg: min,
        binWidth: 0,
        singleValue: true,
      };
    }

    const binCount = 20;
    const binWidth = range / binCount;

    // Create bins
    const bins = Array.from({ length: binCount }, (_, i) => ({
      start: min + i * binWidth,
      end: min + (i + 1) * binWidth,
      count: 0,
    }));

    // Fill bins
    values.forEach((value) => {
      const binIndex = Math.min(
        Math.floor((value - min) / binWidth),
        binCount - 1
      );
      if (binIndex >= 0 && binIndex < bins.length) {
        bins[binIndex].count++;
      }
    });

    let maxCount = 1;
    for (const b of bins) { if (b.count > maxCount) maxCount = b.count; }
    const avg = values.reduce((a, b) => a + b, 0) / values.length;

    return { bins, min, max, maxCount, avg, binWidth };
  }, [micrographs, paramKey]);

  // Count micrographs that pass the filter
  const filteredCount = useMemo(() => {
    const hasRangeFilter = rangeFilter && (filterMinValue !== null || filterMaxValue !== null);
    const hasSingleFilter = !rangeFilter && filterValue !== null;
    if (!hasRangeFilter && !hasSingleFilter) return micrographs.length;

    return micrographs.filter((m) => {
      let value;
      if (paramKey === "astigmatism") {
        const du = m.defocusU;
        const dv = m.defocusV;
        if (du == null || dv == null) return false;
        value = Math.abs(du - dv);
      } else if (paramKey === "defocusAvg") {
        const du = m.defocusU;
        const dv = m.defocusV;
        if (du == null || dv == null) return false;
        value = (du + dv) / 2;
      } else {
        value = m[paramKey];
        if (value == null) return false;
      }

      if (rangeFilter) {
        if (filterMinValue !== null && value < filterMinValue) return false;
        if (filterMaxValue !== null && value > filterMaxValue) return false;
        return true;
      }

      if (filterType === "max") {
        return value <= filterValue;
      } else {
        return value >= filterValue;
      }
    }).length;
  }, [micrographs, paramKey, filterValue, filterType, rangeFilter, filterMinValue, filterMaxValue]);

  // Color mapping
  const colorMap = {
    blue: { fill: "#3b82f6", light: "#dbeafe", text: "text-blue-600", selected: "#1d4ed8" },
    green: { fill: "#22c55e", light: "#dcfce7", text: "text-green-600", selected: "#15803d" },
    orange: { fill: "#f97316", light: "#ffedd5", text: "text-orange-600", selected: "#c2410c" },
    purple: { fill: "#a855f7", light: "#f3e8ff", text: "text-purple-600", selected: "#7e22ce" },
  };

  const colors = colorMap[color] || colorMap.blue;

  // SVG dimensions
  const width = 220;
  const height = 120;
  const margin = { top: 8, right: 10, bottom: 25, left: 10 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;

  // Get value from x position
  const getValueFromX = (clientX) => {
    if (!svgRef.current) return null;
    const range = histogramData.max - histogramData.min;
    if (range === 0) return histogramData.min;
    const rect = svgRef.current.getBoundingClientRect();
    const x = clientX - rect.left - margin.left;
    const ratio = Math.max(0, Math.min(1, x / plotWidth));
    return histogramData.min + ratio * range;
  };

  // Get x position from value
  const getXFromValue = (val) => {
    if (val === null) return null;
    const range = histogramData.max - histogramData.min;
    if (range === 0) return plotWidth / 2;
    const ratio = (val - histogramData.min) / range;
    return Math.max(0, Math.min(plotWidth, ratio * plotWidth));
  };

  const handleMouseDown = (e) => {
    const value = getValueFromX(e.clientX);
    if (value === null) return;

    if (rangeFilter) {
      let target;

      if (filterMinValue === null && filterMaxValue === null) {
        // No filters set - left half = min, right half = max
        const mid = (histogramData.min + histogramData.max) / 2;
        target = value < mid ? "min" : "max";
      } else if (filterMinValue !== null && filterMaxValue === null) {
        // Only min set - clicking right of min sets max, left updates min
        target = value > filterMinValue ? "max" : "min";
      } else if (filterMinValue === null && filterMaxValue !== null) {
        // Only max set - clicking left of max sets min, right updates max
        target = value < filterMaxValue ? "min" : "max";
      } else {
        // Both set - update whichever is closer
        const minDist = Math.abs(value - filterMinValue);
        const maxDist = Math.abs(value - filterMaxValue);
        target = minDist <= maxDist ? "min" : "max";
      }

      setDragTarget(target);
      if (target === "min") onFilterMinChange?.(value);
      else onFilterMaxChange?.(value);
      setIsDragging(true);
    } else {
      if (!onFilterChange) return;
      setIsDragging(true);
      onFilterChange(value);
    }
  };

  const handleMouseMove = (e) => {
    const value = getValueFromX(e.clientX);
    setHoverValue(value);

    if (isDragging) {
      if (rangeFilter) {
        if (dragTarget === "min") onFilterMinChange?.(value);
        else if (dragTarget === "max") onFilterMaxChange?.(value);
      } else if (onFilterChange) {
        onFilterChange(value);
      }
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
    setDragTarget(null);
  };

  const handleMouseLeave = () => {
    setHoverValue(null);
    setIsDragging(false);
    setDragTarget(null);
  };

  // Clear filter on double click
  const handleDoubleClick = () => {
    if (rangeFilter) {
      onFilterMinChange?.(null);
      onFilterMaxChange?.(null);
    } else if (onFilterChange) {
      onFilterChange(null);
    }
  };

  if (histogramData.bins.length === 0) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-lg p-3 border border-[var(--color-border)]">
        <h4 style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-label)" }} className="mb-2">{title}</h4>
        <div className="h-28 flex items-center justify-center text-[var(--color-text-muted)]" style={{ fontSize: "11px" }}>
          No data
        </div>
      </div>
    );
  }

  const formatValue = (val) => {
    if (paramKey === 'figureOfMerit' || paramKey === 'ctfFigureOfMerit') {
      return val.toFixed(2);
    }
    if (Math.abs(val) >= 1000) {
      return (val / 1000).toFixed(1) + 'k';
    }
    return val.toFixed(1);
  };

  const filterX = !rangeFilter ? getXFromValue(filterValue) : null;
  const filterMinX = rangeFilter ? getXFromValue(filterMinValue) : null;
  const filterMaxX = rangeFilter ? getXFromValue(filterMaxValue) : null;

  const hasAnyFilter = rangeFilter
    ? (filterMinValue !== null || filterMaxValue !== null)
    : filterValue !== null;

  // Determine if a bin is within the active filter
  const isBinInFilter = (bin) => {
    if (rangeFilter) {
      if (filterMinValue !== null && bin.end < filterMinValue) return false;
      if (filterMaxValue !== null && bin.start > filterMaxValue) return false;
      return true;
    }
    if (filterValue === null) return true;
    if (filterType === "max") return bin.end <= filterValue;
    return bin.start >= filterValue;
  };

  // Render a filter line with label
  const renderFilterLine = (x, label, position = "top") => {
    if (x === null) return null;
    const labelY = position === "top" ? -2 : plotHeight - 12;
    const textY = position === "top" ? 8 : plotHeight - 2;
    const lineColor = position === "top" ? "var(--color-primary)" : "#1d4ed8"; // blue for min, darker blue for max
    return (
      <>
        <line
          x1={x} y1={0} x2={x} y2={plotHeight}
          stroke={rangeFilter ? lineColor : colors.selected} strokeWidth={2} strokeDasharray="4,2"
        />
        <rect x={x - 20} y={labelY} width={40} height={14} rx={2} fill={rangeFilter ? lineColor : colors.selected} />
        <text x={x} y={textY} textAnchor="middle" className="text-[9px] fill-white font-medium">
          {label}
        </text>
      </>
    );
  };

  return (
    <div className="bg-[var(--color-bg-card)] rounded-lg p-3 border border-[var(--color-border)]">
      {/* Header */}
      <div className="flex justify-between items-center mb-1">
        <h4 style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-label)" }}>{title}</h4>
        <div className="flex items-center gap-2">
          {hasAnyFilter && (
            <span className={`font-medium ${colors.text}`} style={{ fontSize: "11px" }}>
              {filteredCount}/{micrographs.length}
            </span>
          )}
        </div>
      </div>

      {/* Chart */}
      <svg
        ref={svgRef}
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="xMidYMid meet"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onDoubleClick={handleDoubleClick}
        className="cursor-crosshair"
      >
        <g transform={`translate(${margin.left}, ${margin.top})`}>
          {/* Histogram bars */}
          {histogramData.bins.map((bin, i) => {
            const numBins = histogramData.bins.length;
            const barWidth = histogramData.singleValue
              ? Math.min(plotWidth * 0.15, 30)
              : plotWidth / numBins - 1;
            const barHeight = (bin.count / histogramData.maxCount) * plotHeight;
            const x = histogramData.singleValue
              ? (plotWidth - barWidth) / 2
              : (i / numBins) * plotWidth;
            const y = plotHeight - barHeight;

            const inFilter = isBinInFilter(bin);

            return (
              <g key={i}>
                <rect
                  x={x} y={y} width={barWidth} height={barHeight}
                  fill={inFilter ? colors.fill : colors.light}
                  opacity={inFilter ? 0.85 : 0.4}
                  rx={1}
                  className="transition-all duration-150"
                />
                <title>
                  {`${formatValue(bin.start)} - ${formatValue(bin.end)} ${unit}: ${bin.count} micrographs`}
                </title>
              </g>
            );
          })}

          {/* Single filter line */}
          {filterX !== null && renderFilterLine(filterX, `${filterType === "max" ? "≤" : "≥"}${formatValue(filterValue)}`)}

          {/* Range filter lines - min (green, top label) and max (red, bottom label) */}
          {filterMinX !== null && renderFilterLine(filterMinX, `≥${formatValue(filterMinValue)}`, "top")}
          {filterMaxX !== null && renderFilterLine(filterMaxX, `≤${formatValue(filterMaxValue)}`, "bottom")}

          {/* Hover line */}
          {hoverValue !== null && !hasAnyFilter && (histogramData.max - histogramData.min) > 0 && (
            <line
              x1={(hoverValue - histogramData.min) / (histogramData.max - histogramData.min) * plotWidth}
              y1={0}
              x2={(hoverValue - histogramData.min) / (histogramData.max - histogramData.min) * plotWidth}
              y2={plotHeight}
              stroke="var(--color-text-muted)" strokeWidth={1} strokeDasharray="2,2"
            />
          )}

          {/* X-axis */}
          <line x1={0} y1={plotHeight} x2={plotWidth} y2={plotHeight} stroke="var(--color-border-hover)" strokeWidth={1} />

          {/* X-axis labels */}
          <text x={0} y={plotHeight + 14} className="text-[9px] fill-[var(--color-text-secondary)]">
            {formatValue(histogramData.min)}
          </text>
          <text x={plotWidth / 2} y={plotHeight + 14} textAnchor="middle" className="text-[9px] fill-[var(--color-text-muted)]">
            {unit}
          </text>
          <text x={plotWidth} y={plotHeight + 14} textAnchor="end" className="text-[9px] fill-[var(--color-text-secondary)]">
            {formatValue(histogramData.max)}
          </text>
        </g>
      </svg>

      {/* Instructions */}
      <div className="text-[10px] text-[var(--color-text-muted)] text-center mt-1">
        {hasAnyFilter ? (
          <span>Double-click to clear</span>
        ) : (
          <span>Click to set filter</span>
        )}
      </div>
    </div>
  );
};

export default CTFParameterHistogram;
