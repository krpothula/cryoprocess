import React from "react";

const StatsCard = ({ title, icon, value, subtitle, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 dark:bg-blue-900/30 border-blue-100",
    green: "bg-green-50 dark:bg-green-900/30 border-green-100",
    orange: "bg-orange-50 dark:bg-orange-900/30 border-orange-100",
    red: "bg-red-50 dark:bg-red-900/30 border-red-100",
    purple: "bg-purple-50 dark:bg-purple-900/30 border-purple-100",
    indigo: "bg-indigo-50 dark:bg-indigo-900/30 border-indigo-100",
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600 dark:text-slate-300">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-gray-800 dark:text-slate-200">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <span className="text-sm text-gray-500 dark:text-slate-400">{subtitle}</span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
