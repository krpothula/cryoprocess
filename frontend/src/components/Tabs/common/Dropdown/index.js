import React, { useState } from "react";
import { BiSolidDownArrow } from "react-icons/bi";
import { IoInformationCircleOutline } from "react-icons/io5";

const CustomDropdown = ({
  name,
  label,
  options,
  value,
  onChange,
  tooltipText,
  disabled = false,
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <div className="w-[30%]">
        <label style={{ textAlign: "left", opacity: disabled ? 0.3 : 1 }}>
          {label}
        </label>
      </div>
      <div className="flex items-center gap-[7px]">
        <div className="relative">
          <select
            className="h-8 border p-2 appearance-none pr-8 border-solid border-[#e5e7eb]"
            name={name}
            style={{
              backgroundImage: "none",
              fontSize: "12px",
              opacity: disabled ? 0.3 : 1,
              borderRadius: "6px",
              cursor: disabled ? "not-allowed" : "auto",
              color: options?.find(o => o.value === value)?.color || "inherit",
              width: "280px",
              minWidth: "280px",
              maxWidth: "280px",
            }}
            disabled={disabled}
            value={value}
            onChange={onChange}
          >
            {options?.map((option, index) => (
              <option
                key={index}
                value={option.value}
                disabled={option.disabled}
                style={{ color: option.color || "inherit" }}
              >
                {option.label}
              </option>
            ))}
          </select>

          {/* <BiSolidUpArrow
            className="absolute text-black w-3 h-3 pointer-events-none right-5 top-1/4"
            style={{
              opacity: disabled ? 0.3 : 1,
              cursor: disabled ? "not-allowed" : "auto",
            }}
          /> */}

          <BiSolidDownArrow
            className="absolute text-[#666] w-3 h-3 pointer-events-none right-5 top-3"
            style={{
              opacity: disabled ? 0.3 : 1,
              cursor: disabled ? "not-allowed" : "auto",
            }}
          />
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

export default CustomDropdown;
