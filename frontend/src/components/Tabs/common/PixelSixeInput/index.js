import React, { useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";

const PixelSizeInput = ({
  name,
  label,
  placeholder,
  min,
  max,
  value,
  tooltipText,
  onChange,
  handleInputChange,
  disabled = false,
  step = "any",
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  // Check if value is odd when step=2 (must be even)
  const isOddError = step === 2 && value && Number(value) % 2 !== 0;
  const hasError = isOddError;

  return (
    <div className="flex items-center" style={{ gap: "8px" }}>
      <div className="w-[30%]">
        <label style={{ textAlign: "left", opacity: disabled ? 0.3 : 1 }}>
          {label}
        </label>
      </div>
      <div className="flex gap-[7px] items-center">
        <div className="flex">
          <div>
            <input
              type="number"
              step={step}
              min={min}
              max={max}
              placeholder={placeholder}
              value={value}
              onChange={handleInputChange}
              disabled={disabled}
              name={name}
              style={{
                width: "280px",
                minWidth: "280px",
                maxWidth: "280px",
                height: "32px",
                border: hasError ? "2px solid #dc2626" : "1px solid #e2e8f0",
                borderRadius: "6px",
                fontSize: "12px",
                textAlign: "left",
                backgroundColor: hasError ? "#fef2f2" : "white",
                padding: "6px 10px",
                opacity: disabled ? 0.3 : 1,
                cursor: disabled ? "not-allowed" : "",
              }}
            />
            {isOddError && (
              <div style={{ color: "#dc2626", fontSize: "11px", marginTop: "2px" }}>
                Must be an even number
              </div>
            )}
          </div>
          {/* <div style={{ flexGrow: 1, display: "flex", alignItems: "center" }}>
            <input
              type="range"
              id={name}
              name={name}
              min={min}
              max={max}
              value={value}
              onChange={() => {}}
              disabled={disabled}
              style={{
                width: "100%",
                opacity: disabled ? 0.5 : 1,
                cursor: disabled ? "not-allowed" : "",
              }}
            />
          </div> */}
        </div>

        <div
          className="bg-white p-[2px] rounded flex items-center justify-center cursor-pointer relative"
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <IoInformationCircleOutline className="text-gray-400 text-sm" />
          {isTooltipVisible && (
            <div
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "#1e293b",
                color: "#f8fafc",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                lineHeight: "1.4",
                width: "220px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
              }}
            >
              {tooltipText}
              <div
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "0",
                  height: "0",
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderRight: "6px solid #1e293b",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PixelSizeInput;
