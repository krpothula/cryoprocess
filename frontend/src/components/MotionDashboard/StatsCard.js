import React from "react";

const StatsCard = ({ title, icon, stats, unit = "", color = "blue" }) => {
  if (!stats) {
    return (
      <div className="bg-[var(--color-bg-card)] rounded-lg p-4 border border-[var(--color-border)]">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</h4>
        </div>
        <p className="text-[var(--color-text-muted)] text-sm">No data available</p>
      </div>
    );
  }

  const colorClasses = {
    blue: "text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20",
    green: "text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20",
    orange: "text-orange-600 dark:text-orange-400 bg-orange-50 dark:bg-orange-900/20",
    red: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20",
  };

  return (
    <div className="bg-[var(--color-bg-card)] rounded-lg p-4 border border-[var(--color-border)]">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</h4>
      </div>

      {/* Main stat value */}
      <div className="mb-3">
        <span className={`text-2xl font-bold ${colorClasses[color]?.split(" ")[0]}`}>
          {stats.mean?.toFixed(2) || stats.latest?.toFixed(2) || "0"}
        </span>
        <span className="text-sm text-[var(--color-text-secondary)] ml-1">{unit} (mean)</span>
      </div>

      {/* Min/Max range */}
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-[var(--color-text-muted)]">Min:</span>
          <span className="text-[var(--color-text)] font-medium ml-1">
            {stats.min?.toFixed(2) || "0"} {unit}
          </span>
        </div>
        <div>
          <span className="text-[var(--color-text-muted)]">Max:</span>
          <span className="text-[var(--color-text)] font-medium ml-1">
            {stats.max?.toFixed(2) || "0"} {unit}
          </span>
        </div>
      </div>

      {/* Visual range bar */}
      <div className="mt-3 h-2 bg-[var(--color-bg-hover)] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${colorClasses[color]?.split(" ")[1]} transition-all duration-500`}
          style={{
            width: `${Math.min(100, (stats.mean / (stats.max || 1)) * 100)}%`,
          }}
        />
      </div>
    </div>
  );
};

export default StatsCard;
