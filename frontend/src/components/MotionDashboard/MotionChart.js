import React, { useMemo } from "react";

const MotionChart = ({ data = [], micrographs = [] }) => {
  // Use timeline data if available, otherwise create from micrographs
  const chartData = useMemo(() => {
    if (data.length > 0) return data;

    return micrographs.slice(-30).map((m, i) => ({
      index: i,
      total: m.total_motion,
      early: m.early_motion,
      late: m.late_motion,
    }));
  }, [data, micrographs]);

  if (chartData.length === 0) {
    return (
      <div className="h-48 flex items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900 rounded">
        <p>No motion data available yet</p>
      </div>
    );
  }

  // Calculate chart dimensions
  const width = 600;
  const height = 200;
  const padding = { top: 20, right: 20, bottom: 30, left: 50 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  // Calculate scales
  const maxMotion = Math.max(
    ...chartData.map((d) => Math.max(d.total || 0, d.early || 0, d.late || 0))
  );
  const yScale = (value) =>
    chartHeight - (value / (maxMotion || 1)) * chartHeight;
  const xScale = (index) => (index / Math.max(chartData.length - 1, 1)) * chartWidth;

  // Generate SVG paths for each line
  const generatePath = (key) => {
    return chartData
      .map((d, i) => {
        const x = xScale(i);
        const y = yScale(d[key] || 0);
        return `${i === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  };

  // Generate Y-axis ticks
  const yTicks = [0, maxMotion * 0.25, maxMotion * 0.5, maxMotion * 0.75, maxMotion];

  return (
    <div className="overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full max-w-full"
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Background grid */}
        <g transform={`translate(${padding.left}, ${padding.top})`}>
          {yTicks.map((tick, i) => (
            <g key={i}>
              <line
                x1={0}
                y1={yScale(tick)}
                x2={chartWidth}
                y2={yScale(tick)}
                stroke="var(--color-chart-grid, #e5e7eb)"
                strokeDasharray="4,4"
              />
              <text
                x={-10}
                y={yScale(tick)}
                textAnchor="end"
                alignmentBaseline="middle"
                className="text-xs"
                style={{ fill: "var(--color-text-muted)" }}
              >
                {tick.toFixed(1)}
              </text>
            </g>
          ))}

          {/* X-axis label */}
          <text
            x={chartWidth / 2}
            y={chartHeight + 25}
            textAnchor="middle"
            className="text-xs"
            style={{ fill: "var(--color-text-muted)" }}
          >
            Micrograph Index
          </text>

          {/* Y-axis label */}
          <text
            x={-35}
            y={chartHeight / 2}
            textAnchor="middle"
            transform={`rotate(-90, -35, ${chartHeight / 2})`}
            className="text-xs"
            style={{ fill: "var(--color-text-muted)" }}
          >
            Motion (A)
          </text>

          {/* Area fills */}
          <path
            d={`${generatePath("total")} L ${chartWidth} ${chartHeight} L 0 ${chartHeight} Z`}
            fill="rgba(59, 130, 246, 0.1)"
          />

          {/* Lines */}
          <path
            d={generatePath("total")}
            fill="none"
            stroke="#3b82f6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <path
            d={generatePath("early")}
            fill="none"
            stroke="#8b5cf6"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="4,2"
          />
          <path
            d={generatePath("late")}
            fill="none"
            stroke="#f97316"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeDasharray="2,2"
          />

        </g>
      </svg>

      {/* Legend */}
      <div className="flex justify-center gap-6 mt-2">
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-blue-500" />
          <span className="text-xs text-gray-600 dark:text-slate-300">Total Motion</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 bg-purple-500 border-dashed border-t-2 border-purple-500" />
          <span className="text-xs text-gray-600 dark:text-slate-300">Early Motion</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-4 h-0.5 border-dotted border-t-2 border-orange-500" />
          <span className="text-xs text-gray-600 dark:text-slate-300">Late Motion</span>
        </div>
      </div>
    </div>
  );
};

export default MotionChart;
