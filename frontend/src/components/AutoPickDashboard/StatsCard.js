import React from "react";

const StatsCard = ({ title, icon, value, subtitle, color = "blue" }) => {
  const colorClasses = {
    blue: "bg-blue-50 border-blue-100",
    green: "bg-green-50 border-green-100",
    orange: "bg-orange-50 border-orange-100",
    red: "bg-red-50 border-red-100",
    purple: "bg-purple-50 border-purple-100",
    indigo: "bg-indigo-50 border-indigo-100",
  };

  return (
    <div className={`bg-white rounded-lg p-4 shadow-sm border ${colorClasses[color]}`}>
      <div className="flex items-center gap-2 mb-2">
        {icon}
        <span className="text-sm font-medium text-gray-600">{title}</span>
      </div>
      <div className="flex items-baseline gap-2">
        <span className="text-sm font-bold text-gray-800">
          {typeof value === "number" ? value.toLocaleString() : value}
        </span>
        {subtitle && (
          <span className="text-sm text-gray-500">{subtitle}</span>
        )}
      </div>
    </div>
  );
};

export default StatsCard;
