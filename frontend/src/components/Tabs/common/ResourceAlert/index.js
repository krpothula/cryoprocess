import React from "react";

const ResourceAlert = ({ message }) => {
  if (!message) return null;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "8px",
        padding: "10px 14px",
        marginTop: "10px",
        marginLeft: "5px",
        backgroundColor: "var(--color-danger-bg, #fef2f2)",
        border: "1px solid var(--color-danger-border, #fecaca)",
        borderRadius: "8px",
        color: "var(--color-danger-text, #dc2626)",
        fontSize: "13px",
        fontWeight: 500,
        lineHeight: 1.4,
      }}
    >
      <svg
        width="16"
        height="16"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ flexShrink: 0 }}
      >
        <circle cx="12" cy="12" r="10" />
        <line x1="12" y1="8" x2="12" y2="12" />
        <line x1="12" y1="16" x2="12.01" y2="16" />
      </svg>
      {message}
    </div>
  );
};

export default ResourceAlert;
