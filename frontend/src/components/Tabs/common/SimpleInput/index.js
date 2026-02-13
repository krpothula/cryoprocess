import React, { useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";

const SimpleInput = ({
  onChange,
  label = "Queue name:",
  placeholder = "",
  tooltipText,
  disabled = false,
  autoFilled = false,
  name,
  value,
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: "30%" }}>
        <label style={{ textAlign: "left", opacity: disabled ? 0.5 : 1, display: "flex", alignItems: "center", gap: "6px" }}>
          {label}
          {autoFilled && (
            <span style={{ fontSize: "9px", fontWeight: 600, color: "var(--color-primary)", backgroundColor: "var(--color-info-bg)", padding: "1px 5px", borderRadius: "3px", lineHeight: "1.4" }}>
              AUTO
            </span>
          )}
        </label>
      </div>

      <div className="flex items-center gap-[7px]">
        <div className="relative">
          <input
            name={name}
            onChange={onChange}
            value={value}
            placeholder={placeholder}
            disabled={disabled}
            onFocus={() => setTooltipVisible(true)}
            onBlur={() => setTooltipVisible(false)}
            style={{
              height: "32px",
              width: "280px",
              minWidth: "280px",
              maxWidth: "280px",
              border: disabled ? "1px dashed var(--color-border)" : "1px solid var(--color-border)",
              backgroundColor: disabled ? "var(--color-bg)" : "var(--color-bg-card)",
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              opacity: disabled ? 0.5 : 1,
              cursor: disabled ? "not-allowed" : "auto",
            }}
          />
        </div>

        <div
          className="bg-[var(--color-bg-card)] p-[2px] rounded flex items-center justify-center cursor-pointer relative"
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
          tabIndex={0}
          onFocus={() => setTooltipVisible(true)}
          onBlur={() => setTooltipVisible(false)}
        >
          <IoInformationCircleOutline className="text-[var(--color-text-muted)] text-sm" />
          {isTooltipVisible && tooltipText && (
            <div
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "var(--color-text-heading)",
                color: "var(--color-bg)",
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
                  borderRight: "6px solid var(--color-text-heading)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SimpleInput;
