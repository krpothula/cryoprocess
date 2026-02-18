import React, { useEffect, useRef, useState } from "react";
import { FiDownload } from "react-icons/fi";

const DownloadDropdown = ({ files }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  const toggleDropdown = () => setIsOpen((prev) => !prev);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  return (
    <div ref={dropdownRef} className="relative inline-block text-left">
      {/* Dropdown Button */}
      <button
        onClick={toggleDropdown}
        className="flex items-center justify-between w-fit hover:opacity-90 px-4 py-2 bg-[var(--color-bg-active)] opacity-80 font-semibold text-[var(--color-text)] border border-[var(--color-border)] rounded shadow transition-all duration-200"
      >
        <span className="flex items-center">
          <span className="text-xs">Download File(s)</span>
          <FiDownload className="text-[var(--color-text)] ml-3 text-xs" />
        </span>
      </button>

      {/* Dropdown Menu */}
      {isOpen && (
        <div className="absolute mt-2 w-fit bg-[var(--color-bg-card)] right-[0px] border border-[var(--color-border)] rounded shadow-lg z-10 max-h-[300px] overflow-y-auto">
          {files.map((file, index) => (
            <div className="border-b">
              <button
                key={index}
                className="block w-full text-left bg-[var(--color-bg-card)] px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-hover)] transition-colors duration-200"
                style={{ borderRadius: "0px", fontSize: "12px" }}
                onClick={() => {
                  window.open(file.url, "_blank");
                }}
              >
                {file.fileName}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default DownloadDropdown;
