import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const Autopicking = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isLoG = formData.laplacianGaussian === "Yes";
  const isEnable3 = formData.useAcceleration === "Yes" && !isLoG;
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Picking threshold:"
        placeholder=""
        min={0}
        max={2}
        value={formData.pickingThreshold}
        name="pickingThreshold"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Picking threshold for template matching. Lower values pick more particles (including false positives). Start with 0.5 and adjust based on results."
      />
      <PixelSizeInput
        label="Minimum inter-particle distance (A):"
        placeholder=""
        min={1}
        max={500}
        value={formData.interParticle}
        name="interParticle"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum distance between picked particles (in Angstroms). Prevents picking the same particle twice. Set to ~80% of particle diameter."
      />
      <PixelSizeInput
        label="Maximum stddev noise:"
        placeholder=""
        min={0}
        max={3}
        value={formData.maxStddev}
        name="maxStddev"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum standard deviation of micrograph area for picking. Areas with higher std (e.g., ice contamination) are excluded. Use -1 to disable."
      />
      <PixelSizeInput
        label="Minimum avg noise:"
        placeholder=""
        min={-999}
        max={100}
        value={formData.minavg}
        name="minavg"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum average pixel value of micrograph area. Areas below this (e.g., broken areas) are excluded. Use -999 to disable."
      />
      <CustomDropdown
        label="Write FOM maps?"
        value={formData.writeFOMMaps}
        onChange={handleInputChange}
        tooltipText="Write Figure-of-Merit maps to disk. Useful for debugging picking parameters but uses disk space."
        name="writeFOMMaps"
        options={dropdownOptions}
      />
      <CustomDropdown
        label="Read FOM maps?"
        value={formData.readFOMMaps}
        tooltipText="Read pre-computed FOM maps instead of recalculating. Speeds up re-picking with different thresholds on the same micrographs."
        onChange={handleInputChange}
        name="readFOMMaps"
        options={dropdownOptions}
      />
      <PixelSizeInput
        label="Shrink Factor:"
        placeholder=""
        min={0}
        max={100}
        value={formData.shrinkFactor}
        name="shrinkFactor"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Shrink factor for micrographs during autopicking. Values 0-1 (e.g., 0.5 = half size). Speeds up picking at the cost of accuracy."
      />
      <CustomDropdown
        label="Use GPU acceleration?"
        value={isLoG ? "No" : formData.useAcceleration}
        tooltipText="GPU acceleration for template-matching autopicking. Not available for LoG picking."
        name="useAcceleration"
        options={dropdownOptions}
        onChange={handleInputChange}
        disabled={isLoG}
      />
      <SimpleInput
        label="Which GPUs to use:"
        placeholder=""
        name="gpuToUse"
        onChange={handleInputChange}
        value={formData.gpuToUse}
        disabled={!isEnable3}
      />
      {isLoG && (
        <div className="flex flex-wrap items-start">
          <p className="min-w-[30%]"></p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "6px",
              color: "#dc2626",
              fontSize: "11px",
              fontWeight: 500,
              lineHeight: 1.4,
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="8" x2="12" y2="12" />
              <line x1="12" y1="16" x2="12.01" y2="16" />
            </svg>
            LoG picking is CPU-only — GPU acceleration is not supported
          </div>
        </div>
      )}
    </div>
  );
};

export default Autopicking;
