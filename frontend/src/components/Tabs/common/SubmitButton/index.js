import React, { useState } from "react";
import { useBuilder } from "../../../../context/BuilderContext";
import CtaLoading from "../Animation/CtaLoading";

const SubmitButton = ({ isLoading, handleSubmit, formData, activeTab, previewComponent }) => {
  const { resourceError, emailNotificationsEnabled } = useBuilder();
  const [notifyEmail, setNotifyEmail] = useState(false);

  // Only show submit button on Running tab
  if (activeTab !== "Running") {
    return null;
  }

  const handleNotifyToggle = (e) => {
    const checked = e.target.checked;
    setNotifyEmail(checked);
    // Set directly on formData so it's included in the submission payload
    if (formData) {
      formData.notify_email = checked;
    }
  };

  return (
    <div className="flex flex-wrap items-start mt-4">
      <p className="min-w-[30%]"></p>
      <div className="flex flex-col w-full">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={"bg-primary cursor-pointer w-fit min-w-[150px] ml-[5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"}
            onClick={handleSubmit}
            disabled={isLoading}
          >
            {isLoading ? <CtaLoading /> : "Submit"}
          </button>
          {emailNotificationsEnabled && (
            <label
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "12px",
                color: "var(--color-text-secondary)",
                marginLeft: "12px",
                cursor: "pointer",
                userSelect: "none",
              }}
            >
              <input
                type="checkbox"
                checked={notifyEmail}
                onChange={handleNotifyToggle}
                style={{ accentColor: "var(--color-primary)" }}
              />
              Email me when done
            </label>
          )}
        </div>
        {/* Resource validation error */}
        {resourceError && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              padding: "10px 14px",
              marginTop: "10px",
              marginLeft: "5px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              color: "#dc2626",
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
              stroke="#dc2626"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ flexShrink: 0 }}
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            {resourceError}
          </div>
        )}
        {/* Command preview below submit button */}
        {previewComponent}
      </div>
    </div>
  );
};

export default SubmitButton;
