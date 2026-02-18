import React, { useState } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";

const InputGroup = ({
  inputs,
  label,
  type = "text",
  onChange,
  tooltipText,
  disabled = false,
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div style={{ width: "30%" }}>
        <label style={{ textAlign: "left", opacity: disabled ? 0.5 : 1 }}>
          {label}
        </label>
      </div>
      <div className="flex items-center gap-[7px]">
        <div>
          <div className="input-group relative flex gap-2" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }}>
            {inputs.map((input, index) => (
              <input
                key={index}
                type={type}
                name={input.name}
                value={input.value}
                onChange={onChange}
                placeholder={input.placeholder}
                disabled={disabled}
                onFocus={() => setTooltipVisible(true)}
                onBlur={() => setTooltipVisible(false)}
                style={{
                  padding: "6px 10px",
                  flex: 1,
                  minWidth: 0,
                  border: disabled ? "1px dashed var(--color-border-hover)" : "1px solid var(--color-border)",
                  borderRadius: "6px",
                  height: "32px",
                  opacity: disabled ? 0.5 : 1,
                  fontSize: "12px",
                  backgroundColor: disabled ? "var(--color-bg)" : "var(--color-bg-card)",
                  color: "var(--color-text-heading)",
                  cursor: disabled ? "not-allowed" : "text",
                }}
              />
            ))}
          </div>
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

export default InputGroup;
