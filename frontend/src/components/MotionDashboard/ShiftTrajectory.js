import React, { useMemo } from "react";

const ShiftTrajectory = ({ data }) => {
  const shifts = data?.shifts;

  const trajectoryData = useMemo(() => {
    if (!shifts?.frames || !Array.isArray(shifts.frames)) {
      return [];
    }
    return shifts.frames.map((f) => ({
      frame: f.frame,
      x: f.shift_x,
      y: f.shift_y,
    }));
  }, [shifts]);

  // Calculate statistics from shift data
  const stats = useMemo(() => {
    if (!trajectoryData.length) return null;

    const sumSqDist = trajectoryData.reduce(
      (acc, d) => acc + d.x * d.x + d.y * d.y,
      0
    );
    const rmsd = Math.sqrt(sumSqDist / trajectoryData.length);

    // Total drift: distance from first to last frame
    const first = trajectoryData[0];
    const last = trajectoryData[trajectoryData.length - 1];
    const totalDrift = Math.sqrt(
      (last.x - first.x) ** 2 + (last.y - first.y) ** 2
    );

    // Max shift from origin
    const maxShift = Math.max(
      ...trajectoryData.map((d) => Math.sqrt(d.x * d.x + d.y * d.y))
    );

    // Per-frame drift (consecutive frame distances)
    let maxFrameDrift = 0;
    for (let i = 1; i < trajectoryData.length; i++) {
      const dx = trajectoryData[i].x - trajectoryData[i - 1].x;
      const dy = trajectoryData[i].y - trajectoryData[i - 1].y;
      maxFrameDrift = Math.max(maxFrameDrift, Math.sqrt(dx * dx + dy * dy));
    }

    const pixelSize = shifts?.pixel_size || null;

    return {
      rmsd,
      totalDrift,
      maxShift,
      maxFrameDrift,
      numFrames: trajectoryData.length,
      pixelSize,
    };
  }, [trajectoryData, shifts?.pixel_size]);

  if (!trajectoryData.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-slate-500">
        <p>No shift data available</p>
      </div>
    );
  }

  // Calculate bounds for the trajectory plot
  const allX = trajectoryData.map((d) => d.x);
  const allY = trajectoryData.map((d) => d.y);
  const minX = Math.min(...allX);
  const maxX = Math.max(...allX);
  const minY = Math.min(...allY);
  const maxY = Math.max(...allY);

  const rangeX = maxX - minX || 1;
  const rangeY = maxY - minY || 1;
  const padding = 0.15;

  const viewMinX = minX - rangeX * padding;
  const viewMaxX = maxX + rangeX * padding;
  const viewMinY = minY - rangeY * padding;
  const viewMaxY = maxY + rangeY * padding;

  const size = 220;
  const margin = { top: 12, right: 12, bottom: 30, left: 38 };
  const scale = (value, min, max) => ((value - min) / (max - min)) * size;

  // Generate smooth path
  const trajectoryPath = trajectoryData
    .map((d, i) => {
      const x = margin.left + scale(d.x, viewMinX, viewMaxX);
      const y = margin.top + size - scale(d.y, viewMinY, viewMaxY);
      return `${i === 0 ? "M" : "L"} ${x} ${y}`;
    })
    .join(" ");

  // Color for frame dots: blue -> teal -> amber
  const getColor = (idx, total) => {
    const t = total <= 1 ? 0 : idx / (total - 1);
    if (t < 0.5) {
      const s = t * 2;
      const r = Math.round(59 + s * (20 - 59));
      const g = Math.round(130 + s * (184 - 130));
      const b = Math.round(246 + s * (166 - 246));
      return `rgb(${r},${g},${b})`;
    } else {
      const s = (t - 0.5) * 2;
      const r = Math.round(20 + s * (245 - 20));
      const g = Math.round(184 + s * (158 - 184));
      const b = Math.round(166 + s * (11 - 166));
      return `rgb(${r},${g},${b})`;
    }
  };

  const unit = stats?.pixelSize ? "A" : "px";
  const toUnit = (val) => {
    if (stats?.pixelSize) return (val * stats.pixelSize).toFixed(2);
    return val.toFixed(2);
  };

  // Axis tick values (4 ticks)
  const xTicks = [0, 0.33, 0.67, 1].map((r) => viewMinX + r * (viewMaxX - viewMinX));
  const yTicks = [0, 0.33, 0.67, 1].map((r) => viewMinY + r * (viewMaxY - viewMinY));

  const svgW = margin.left + size + margin.right;
  const svgH = margin.top + size + margin.bottom;

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Stats Grid - 2x2 */}
      {stats && (
        <div className="grid grid-cols-2 gap-x-4 gap-y-1 px-3 py-2 border-b border-gray-100 dark:border-slate-700 flex-shrink-0">
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>RMSD</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text)" }}>
              {toUnit(stats.rmsd)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Drift</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text)" }}>
              {toUnit(stats.totalDrift)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Max Shift</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text)" }}>
              {toUnit(stats.maxShift)} {unit}
            </span>
          </div>
          <div className="flex items-center justify-between">
            <span style={{ fontSize: "10px", color: "var(--color-text-muted)" }}>Frames</span>
            <span style={{ fontSize: "11px", fontWeight: 600, color: "var(--color-text)" }}>
              {stats.numFrames}
            </span>
          </div>
        </div>
      )}

      {/* Trajectory Plot */}
      <div className="flex-1 flex items-center justify-center min-h-0 px-2">
        <svg
          width="100%"
          height="100%"
          viewBox={`0 0 ${svgW} ${svgH}`}
          preserveAspectRatio="xMidYMid meet"
        >
          {/* Plot area border */}
          <rect
            x={margin.left}
            y={margin.top}
            width={size}
            height={size}
            fill="var(--color-bg-card)"
            stroke="var(--color-border)"
            strokeWidth="1"
          />

          {/* Grid lines */}
          {[0.33, 0.67].map((ratio) => (
            <g key={ratio}>
              <line
                x1={margin.left}
                y1={margin.top + size * ratio}
                x2={margin.left + size}
                y2={margin.top + size * ratio}
                stroke="var(--color-bg-hover)"
                strokeWidth="1"
              />
              <line
                x1={margin.left + size * ratio}
                y1={margin.top}
                x2={margin.left + size * ratio}
                y2={margin.top + size}
                stroke="var(--color-bg-hover)"
                strokeWidth="1"
              />
            </g>
          ))}

          {/* Origin crosshair (if origin is in view) */}
          {viewMinX <= 0 && viewMaxX >= 0 && viewMinY <= 0 && viewMaxY >= 0 && (
            <g>
              <line
                x1={margin.left + scale(0, viewMinX, viewMaxX)}
                y1={margin.top}
                x2={margin.left + scale(0, viewMinX, viewMaxX)}
                y2={margin.top + size}
                stroke="var(--color-border-hover)"
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
              <line
                x1={margin.left}
                y1={margin.top + size - scale(0, viewMinY, viewMaxY)}
                x2={margin.left + size}
                y2={margin.top + size - scale(0, viewMinY, viewMaxY)}
                stroke="var(--color-border-hover)"
                strokeWidth="0.5"
                strokeDasharray="3,3"
              />
              <circle
                cx={margin.left + scale(0, viewMinX, viewMaxX)}
                cy={margin.top + size - scale(0, viewMinY, viewMaxY)}
                r="3"
                fill="none"
                stroke="var(--color-text-muted)"
                strokeWidth="1"
              />
            </g>
          )}

          {/* Trajectory line with gradient */}
          <defs>
            <linearGradient id="trajGrad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="50%" stopColor="#14b8a6" />
              <stop offset="100%" stopColor="#f59e0b" />
            </linearGradient>
          </defs>

          <path
            d={trajectoryPath}
            fill="none"
            stroke="url(#trajGrad)"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity="0.7"
          />

          {/* Frame dots */}
          {trajectoryData.map((d, i) => {
            const cx = margin.left + scale(d.x, viewMinX, viewMaxX);
            const cy = margin.top + size - scale(d.y, viewMinY, viewMaxY);
            const isEndpoint = i === 0 || i === trajectoryData.length - 1;
            return (
              <circle
                key={i}
                cx={cx}
                cy={cy}
                r={isEndpoint ? 5 : 2.5}
                fill={getColor(i, trajectoryData.length)}
                stroke={isEndpoint ? "white" : "none"}
                strokeWidth={isEndpoint ? 1.5 : 0}
              />
            );
          })}

          {/* X-axis ticks & labels */}
          {xTicks.map((val, i) => {
            const x = margin.left + scale(val, viewMinX, viewMaxX);
            return (
              <g key={`xt-${i}`}>
                <line
                  x1={x} y1={margin.top + size}
                  x2={x} y2={margin.top + size + 4}
                  stroke="var(--color-text-muted)" strokeWidth="1"
                />
                <text
                  x={x}
                  y={margin.top + size + 14}
                  textAnchor="middle"
                  style={{ fontSize: "8px", fill: "var(--color-text-muted)" }}
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Y-axis ticks & labels */}
          {yTicks.map((val, i) => {
            const y = margin.top + size - scale(val, viewMinY, viewMaxY);
            return (
              <g key={`yt-${i}`}>
                <line
                  x1={margin.left - 4} y1={y}
                  x2={margin.left} y2={y}
                  stroke="var(--color-text-muted)" strokeWidth="1"
                />
                <text
                  x={margin.left - 6}
                  y={y + 3}
                  textAnchor="end"
                  style={{ fontSize: "8px", fill: "var(--color-text-muted)" }}
                >
                  {val.toFixed(1)}
                </text>
              </g>
            );
          })}

          {/* Axis labels */}
          <text
            x={margin.left + size / 2}
            y={margin.top + size + 26}
            textAnchor="middle"
            style={{ fontSize: "9px", fill: "var(--color-text-secondary)" }}
          >
            Shift X ({unit})
          </text>
          <text
            x={10}
            y={margin.top + size / 2}
            textAnchor="middle"
            transform={`rotate(-90, 10, ${margin.top + size / 2})`}
            style={{ fontSize: "9px", fill: "var(--color-text-secondary)" }}
          >
            Shift Y ({unit})
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex justify-center gap-4 text-xs text-gray-500 dark:text-slate-400 py-1.5 flex-shrink-0 border-t border-gray-100 dark:border-slate-700">
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "#3b82f6" }} />
          <span style={{ fontSize: "10px" }}>Frame 1</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "#14b8a6" }} />
          <span style={{ fontSize: "10px" }}>Mid</span>
        </div>
        <div className="flex items-center gap-1">
          <div className="w-2 h-2 rounded-full" style={{ background: "#f59e0b" }} />
          <span style={{ fontSize: "10px" }}>Frame {stats?.numFrames}</span>
        </div>
      </div>
    </div>
  );
};

export default ShiftTrajectory;
