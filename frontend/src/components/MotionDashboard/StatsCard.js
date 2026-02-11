import React from "react";

const StatsCard = ({ title, icon, stats, unit = "", color = "blue" }) => {
  if (!stats) {
    return (
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          {icon}
          <h4 className="text-sm font-medium text-gray-600">{title}</h4>
        </div>
        <p className="text-gray-400 text-sm">No data available</p>
      </div>
    );
  }

  const colorClasses = {
    blue: "text-blue-600 bg-blue-50",
    green: "text-green-600 bg-green-50",
    orange: "text-orange-600 bg-orange-50",
    red: "text-red-600 bg-red-50",
  };

  return (
    <div className="bg-white rounded-lg p-4 shadow-sm">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h4 className="text-sm font-medium text-gray-600">{title}</h4>
      </div>

      {/* Main stat value */}
      <div className="mb-3">
        <span className={`text-2xl font-bold ${colorClasses[color]?.split(" ")[0]}`}>
          {stats.mean?.toFixed(2) || stats.latest?.toFixed(2) || "0"}
        </span>
        <span className="text-sm text-gray-500 ml-1">{unit} (mean)</span>
      </div>

      {/* Min/Max range */}
      <div className="flex justify-between text-sm">
        <div>
          <span className="text-gray-400">Min:</span>
          <span className="text-gray-700 font-medium ml-1">
            {stats.min?.toFixed(2) || "0"} {unit}
          </span>
        </div>
        <div>
          <span className="text-gray-400">Max:</span>
          <span className="text-gray-700 font-medium ml-1">
            {stats.max?.toFixed(2) || "0"} {unit}
          </span>
        </div>
      </div>

      {/* Visual range bar */}
      <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
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
