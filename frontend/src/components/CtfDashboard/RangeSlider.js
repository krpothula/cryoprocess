import React, { useMemo, useId } from "react";

/**
 * Custom Range Slider with filled track that moves with the thumb.
 * Shows a solid filled bar from left to thumb position, no hollow bar.
 */
const RangeSlider = ({
  min = 0,
  max = 100,
  step = 1,
  value,
  onChange,
  color = "blue", // blue, green, orange
  className = "",
}) => {
  const sliderId = useId();

  // Calculate the percentage for the filled portion
  const percentage = useMemo(() => {
    const val = value ?? min;
    return ((val - min) / (max - min)) * 100;
  }, [value, min, max]);

  // Color mapping
  const colors = {
    blue: "#3b82f6",
    green: "#22c55e",
    orange: "#f97316",
  };

  const fillColor = colors[color] || colors.blue;

  // Create the gradient background: filled color up to thumb, gray after
  const trackStyle = {
    background: `linear-gradient(to right, ${fillColor} 0%, ${fillColor} ${percentage}%, #e5e7eb ${percentage}%, #e5e7eb 100%)`,
    height: "8px",
    borderRadius: "4px",
  };

  // Dynamic CSS for the thumb color
  const dynamicStyles = `
    #slider-${CSS.escape(sliderId)}::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${fillColor};
      border: 3px solid #ffffff;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
      margin-top: -6px;
    }
    #slider-${CSS.escape(sliderId)}::-moz-range-thumb {
      width: 20px;
      height: 20px;
      border-radius: 50%;
      background: ${fillColor};
      border: 3px solid #ffffff;
      cursor: pointer;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.3);
    }
    #slider-${CSS.escape(sliderId)}::-moz-range-progress {
      height: 8px;
      border-radius: 4px;
      background: ${fillColor};
    }
  `;

  return (
    <div className={`relative w-full ${className}`}>
      <style>{dynamicStyles}</style>
      <input
        id={`slider-${sliderId}`}
        type="range"
        min={min}
        max={max}
        step={step}
        value={value ?? min}
        onChange={onChange}
        className="w-full h-2 rounded-lg appearance-none cursor-pointer"
        style={trackStyle}
      />
    </div>
  );
};

export default RangeSlider;
