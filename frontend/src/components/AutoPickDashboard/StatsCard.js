import React from "react";

const StatsCard = ({ title, icon, value, subtitle, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 border-blue-100 dark:border-blue-800/30",
    green: "bg-green-50 dark:bg-green-900/30 border-green-100 dark:border-green-800/30",
    orange: "bg-orange-50 dark:bg-orange-900/30 border-orange-100 dark:border-orange-800/30",
    red: "bg-red-50 dark:bg-red-900/30 border-red-100 dark:border-red-800/30",
    purple: "bg-purple-50 dark:bg-purple-900/30 border-purple-100 dark:border-purple-800/30",
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100 dark:border-indigo-800/30",
  };

  return (
    <div className={`bg-[var(--color-bg-card)] rounded-lg p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-[var(--color-text-secondary)]">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-[var(--color-text-heading)]">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <span className="text-sm text-[var(--color-text-secondary)]">{subtitle}</span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
