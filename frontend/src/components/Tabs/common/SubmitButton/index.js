import React, { useState, useRef, useCallback } from "react";
import { useBuilder } from "../../../../context/BuilderContext";
import CtaLoading from "../Animation/CtaLoading";
import ResourceAlert from "../ResourceAlert";

const SubmitButton = ({ isLoading, handleSubmit, formData, activeTab, previewComponent }) => {
  const { resourceError, emailNotificationsEnabled } = useBuilder();
  const [notifyEmail, setNotifyEmail] = useState(false);
  const submittingRef = useRef(false);

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

  // Debounced submit to prevent double-clicks
  const onSubmitClick = (e) => {
    if (submittingRef.current) return;
    submittingRef.current = true;
    setTimeout(() => { submittingRef.current = false; }, 2000);
    handleSubmit(e);
  };

  return (
    <div className="flex flex-wrap items-start mt-4">
      <p className="min-w-[30%]"></p>
      <div className="flex flex-col w-full">
        <div className="flex items-center gap-2">
          <button
            type="submit"
            className={"bg-primary cursor-pointer w-fit min-w-[150px] ml-[5px] font-semibold disabled:opacity-50 disabled:cursor-not-allowed"}
            onClick={onSubmitClick}
            disabled={isLoading || !!resourceError}
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
        <ResourceAlert message={resourceError} />
        {/* Command preview below submit button */}
        {previewComponent}
      </div>
    </div>
  );
};

export default SubmitButton;
