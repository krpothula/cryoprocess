import React from "react";

const StatsCard = ({ title, icon, stats, unit, color }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    orange: "bg-orange-50 border-orange-100",
    purple: "bg-purple-50 border-purple-100",
    red: "bg-red-50 border-red-100",
  };

  const bgClass = colorClasses[color] || colorClasses.blue;

  const formatValue = (value) => {
    if (value === undefined || value === null) return "N/A";
    if (typeof value === "number") {
      return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: 2,
      });
    }
    return value;
  };

  return (
    <div className={`bg-white dark:bg-slate-800 rounded-lg p-4 border ${bgClass}`}>
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-white dark:bg-slate-800 rounded-lg">{icon}</div>
        <h3 className="text-sm font-medium text-gray-600 dark:text-slate-300">{title}</h3>
      </div>

      {stats ? (
        <div className="grid grid-cols-3 gap-3">
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Min</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-slate-200">
              {formatValue(stats.min)}
              {unit && <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">{unit}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Mean</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-slate-200">
              {formatValue(stats.mean)}
              {unit && <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">{unit}</span>}
            </p>
          </div>
          <div>
            <p className="text-xs text-gray-500 dark:text-slate-400 mb-1">Max</p>
            <p className="text-lg font-semibold text-gray-800 dark:text-slate-200">
              {formatValue(stats.max)}
              {unit && <span className="text-xs text-gray-500 dark:text-slate-400 ml-1">{unit}</span>}
            </p>
          </div>
        </div>
      ) : (
        <div className="text-center py-4 text-gray-400 dark:text-slate-500">
          <p className="text-sm">No data available</p>
        </div>
      )}
    </div>
  );
};

export default StatsCard;
