import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  ReferenceLine,
} from "recharts";
import { FiTrendingUp } from "react-icons/fi";

/**
 * FSC curve chart — used by PostProcess and AutoRefine dashboards.
 *
 * Props:
 *   data        – array of { resolution, fsc_unmasked, fsc_masked, fsc_corrected }
 *   goldStdRes  – gold-standard resolution in Å (draws a vertical marker)
 *   height      – chart height in px (default 300)
 *   title       – optional override (default "FSC Curve")
 */
const FscChart = ({ data = [], goldStdRes, height = 300, title }) => {
  // Convert resolution in Å to 1/Å for the X axis (standard FSC convention)
  const chartData = useMemo(() => {
    if (!data.length) return [];
    return data
      .filter((d) => d.resolution > 0)
      .map((d) => ({
        ...d,
        inv_resolution: parseFloat((1 / d.resolution).toFixed(4)),
        res_label: d.resolution.toFixed(1),
      }))
      .sort((a, b) => a.inv_resolution - b.inv_resolution);
  }, [data]);

  if (!chartData.length) {
    return (
      <div
        style={{
          height,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          color: "var(--color-text-muted)",
          background: "var(--color-bg)",
          borderRadius: 8,
        }}
      >
        <FiTrendingUp size={36} style={{ marginBottom: 8, opacity: 0.4 }} />
        <p style={{ fontSize: 13 }}>
          No FSC data available yet.
        </p>
      </div>
    );
  }

  // Determine which curves are present
  const hasCorrected = chartData.some((d) => d.fsc_corrected != null && d.fsc_corrected !== 0);
  const hasMasked = chartData.some((d) => d.fsc_masked != null && d.fsc_masked !== 0);
  const hasUnmasked = chartData.some((d) => d.fsc_unmasked != null && d.fsc_unmasked !== 0);

  // 1/Å value for the gold-standard resolution marker
  const goldStdInv = goldStdRes && goldStdRes > 0 ? 1 / goldStdRes : null;

  // Generate resolution-in-Å tick labels for X axis
  const xTicks = useMemo(() => {
    if (!chartData.length) return [];
    const maxInv = chartData[chartData.length - 1].inv_resolution;
    // Show ticks at nice resolution values
    const resValues = [50, 20, 10, 7, 5, 4, 3, 2.5, 2, 1.5];
    return resValues
      .map((r) => 1 / r)
      .filter((v) => v <= maxInv * 1.05);
  }, [chartData]);

  const CustomTooltip = ({ active, payload }) => {
    if (!active || !payload?.length) return null;
    const d = payload[0]?.payload;
    return (
      <div
        style={{
          background: "var(--color-bg-card)",
          border: "1px solid var(--color-border)",
          borderRadius: 6,
          padding: "8px 12px",
          boxShadow: "0 4px 12px rgba(0,0,0,0.12)",
          fontSize: 11,
          lineHeight: 1.6,
        }}
      >
        <div style={{ fontWeight: 600, color: "var(--color-text)", marginBottom: 4 }}>
          {d?.resolution?.toFixed(2)} Å
        </div>
        {payload.map((entry, i) => (
          <div key={i} style={{ color: entry.color, fontWeight: 500 }}>
            {entry.name}: {entry.value?.toFixed(4)}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 8, right: 16, left: 8, bottom: 4 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="var(--color-border)"
            opacity={0.5}
          />

          {/* X axis: 1/Resolution (Å) */}
          <XAxis
            dataKey="inv_resolution"
            type="number"
            domain={[0, "dataMax"]}
            ticks={xTicks}
            tickFormatter={(v) => (v > 0 ? (1 / v).toFixed(1) : "")}
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            tickLine={{ stroke: "var(--color-border)" }}
            label={{
              value: "Resolution (Å)",
              position: "insideBottom",
              offset: -2,
              style: { fontSize: 11, fill: "var(--color-text-secondary)", fontWeight: 500 },
            }}
          />

          {/* Y axis: FSC */}
          <YAxis
            domain={[-0.05, 1.05]}
            ticks={[0, 0.143, 0.25, 0.5, 0.75, 1.0]}
            tick={{ fontSize: 10, fill: "var(--color-text-secondary)" }}
            tickLine={{ stroke: "var(--color-border)" }}
            label={{
              value: "FSC",
              angle: -90,
              position: "insideLeft",
              offset: 10,
              style: { fontSize: 11, fill: "var(--color-text-secondary)", fontWeight: 500 },
            }}
          />

          <Tooltip content={<CustomTooltip />} />

          <Legend
            wrapperStyle={{ fontSize: 11, paddingTop: 4 }}
            iconType="line"
            iconSize={14}
          />

          {/* 0.143 gold-standard threshold line */}
          <ReferenceLine
            y={0.143}
            stroke="var(--color-danger-text)"
            strokeDasharray="6 3"
            strokeWidth={1.5}
            opacity={0.7}
            label={{
              value: "0.143",
              position: "right",
              style: { fontSize: 9, fill: "var(--color-danger-text)", fontWeight: 600 },
            }}
          />

          {/* Gold-standard resolution vertical marker */}
          {goldStdInv && (
            <ReferenceLine
              x={goldStdInv}
              stroke="var(--color-success-text)"
              strokeDasharray="4 4"
              strokeWidth={1.5}
              opacity={0.7}
              label={{
                value: `${goldStdRes.toFixed(1)} Å`,
                position: "top",
                style: { fontSize: 10, fill: "var(--color-success-text)", fontWeight: 600 },
              }}
            />
          )}

          {/* FSC curves */}
          {hasCorrected && (
            <Line
              type="monotone"
              dataKey="fsc_corrected"
              name="Phase-randomized (corrected)"
              stroke="#10b981"
              strokeWidth={2.5}
              dot={false}
              activeDot={{ r: 4, fill: "#10b981", stroke: "#fff", strokeWidth: 2 }}
            />
          )}
          {hasMasked && (
            <Line
              type="monotone"
              dataKey="fsc_masked"
              name="Masked"
              stroke="#3b82f6"
              strokeWidth={2}
              dot={false}
              activeDot={{ r: 4, fill: "#3b82f6", stroke: "#fff", strokeWidth: 2 }}
            />
          )}
          {hasUnmasked && (
            <Line
              type="monotone"
              dataKey="fsc_unmasked"
              name="Unmasked"
              stroke="#f59e0b"
              strokeWidth={1.5}
              strokeDasharray="4 2"
              dot={false}
              activeDot={{ r: 4, fill: "#f59e0b", stroke: "#fff", strokeWidth: 2 }}
            />
          )}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default FscChart;
