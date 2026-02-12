import React from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { FiTrendingUp } from "react-icons/fi";

const DefocusChart = ({ data = [], micrographs = [] }) => {
  // Use timeline data if available, otherwise build from micrographs
  const chartData = React.useMemo(() => {
    if (data.length > 0) {
      return data;
    }

    // Build chart data from micrographs
    return micrographs.slice(-30).map((m, idx) => ({
      index: idx,
      defocus: m.defocus_avg,
      resolution: m.ctf_max_resolution,
      name: m.micrograph_name,
    }));
  }, [data, micrographs]);

  if (chartData.length === 0) {
    return (
      <div className="h-64 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900 rounded-lg">
        <FiTrendingUp className="text-5xl mb-3" />
        <p className="text-center">
          No defocus data available yet.
          <br />
          Data will appear as micrographs are processed.
        </p>
      </div>
    );
  }

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-slate-800 p-3 rounded-lg shadow-lg dark:shadow-2xl border border-gray-200 dark:border-slate-700">
          <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">
            Micrograph #{label}
          </p>
          {payload.map((entry, index) => (
            <p
              key={index}
              className="text-sm font-medium"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.value?.toLocaleString()} A
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="h-64">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart
          data={chartData}
          margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
        >
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
          <XAxis
            dataKey="index"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={{ stroke: "var(--color-chart-grid)" }}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={{ stroke: "var(--color-chart-grid)" }}
            label={{
              value: "Defocus (A)",
              angle: -90,
              position: "insideLeft",
              style: { fontSize: 11, fill: "var(--color-text-secondary)" },
            }}
          />
          <YAxis
            yAxisId="right"
            orientation="right"
            tick={{ fontSize: 11, fill: "var(--color-text-secondary)" }}
            tickLine={{ stroke: "var(--color-chart-grid)" }}
            label={{
              value: "Resolution (A)",
              angle: 90,
              position: "insideRight",
              style: { fontSize: 11, fill: "var(--color-text-secondary)" },
            }}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 12 }}
            iconType="line"
          />
          <Line
            yAxisId="left"
            type="monotone"
            dataKey="defocus"
            name="Defocus"
            stroke="#3b82f6"
            strokeWidth={2}
            dot={{ r: 3, fill: "#3b82f6" }}
            activeDot={{ r: 5, fill: "#3b82f6" }}
          />
          <Line
            yAxisId="right"
            type="monotone"
            dataKey="resolution"
            name="Resolution"
            stroke="#10b981"
            strokeWidth={2}
            dot={{ r: 3, fill: "#10b981" }}
            activeDot={{ r: 5, fill: "#10b981" }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

export default DefocusChart;
