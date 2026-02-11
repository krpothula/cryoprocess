import React, { useState } from "react";
import { MdOutlineQuestionMark } from "react-icons/md";

const CustomFileInput = ({
  name,
  label,
  type = "text",
  placeholder,
  value,
  onChange,
  tooltipText,
  disabled = false,
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
      <div style={{ width: "40%" }}>
        <label style={{ textAlign: "right", opacity: disabled ? 0.3 : 1 }}>
          {label}
        </label>
      </div>
      <div
        style={{
          position: "relative",
          width: "60%",
          display: "flex",
          gap: "5px",
        }}
      >
        <div style={{ width: "73%" }}>
          <input
            name={name}
            type={type}
            value={value}
            onChange={onChange}
            placeholder={placeholder}
            disabled={disabled}
            style={{
              height: "36px",
              width: "100%",
              border: "1px solid gray",
              padding: "8px",
              borderRadius: "4px",
              backgroundColor: "#ffffe3",
              opacity: disabled ? 0.3 : 1,
            }}
          />
        </div>

        <div style={{ width: "30%", display: "flex", gap: "2px" }}>
          <div
            style={{
              backgroundColor: disabled ? "#a7a7d6" : "#7878ff",
              padding: "4px",
              borderRadius: "4px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              height: "36px",
              width: "11%",
              cursor: disabled ? "not-allowed" : "pointer",
              position: "relative",
            }}
            onMouseEnter={() => setTooltipVisible(true)}
            onMouseLeave={() => setTooltipVisible(false)}
          >
            <MdOutlineQuestionMark />
            {isTooltipVisible && (
              <div
                style={{
                  position: "absolute",
                  bottom: "100%",
                  left: "50%",
                  transform: "translateX(-50%)",
                  backgroundColor: "#333",
                  color: "#fff",
                  padding: "5px",
                  borderRadius: "4px",
                  opacity: 0.8,
                  transition: "opacity 0.2s",
                  whiteSpace: "nowrap",
                  zIndex: 10,
                }}
              >
                {tooltipText}
              </div>
            )}
          </div>

          <button
            disabled={disabled}
            style={{
              color: "white",
              backgroundColor: disabled ? "#a7a7d6" : "#7878ff",
              padding: "4px 2px",
              height: "36px",
              width: "35%",
              borderRadius: "4px",
              border: "none",
              cursor: disabled ? "not-allowed" : "pointer",
            }}
          >
            Browse
          </button>
        </div>
      </div>
    </div>
  );
};

export default CustomFileInput;
