import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const AutoSampling = ({
  formData,
  handleInputChange,
  degreeOptions,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isEnabled = formData.localAngularSearches === "Yes";
  const disableImageAlignment = formData.LocalSearchfromAutoSampling === "No";

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Perform image alignment?"
        onChange={handleInputChange}
        value={formData.LocalSearchfromAutoSampling}
        tooltipText="Enable particle alignment during classification. Set to 'No' if particles are already well-aligned from a previous refinement step."
        name="LocalSearchfromAutoSampling"
        options={dropdownOptions}
      />
      <CustomDropdown
        label="Angular sampling interval:"
        onChange={handleInputChange}
        value={formData.initialAngularSampling}
        tooltipText="How finely to rotate particles when searching for the correct orientation. Smaller angles = more accurate but slower. Start with 7.5° for most cases, use finer sampling (1.8-3.7°) for high-resolution data."
        name="initialAngularSampling"
        options={degreeOptions}
        disabled={disableImageAlignment}
      />
      <PixelSizeInput
        label="Offset search range (pix):"
        placeholder=""
        min={0}
        max={50}
        value={formData.initialOffsetRange}
        name="initialOffsetRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum distance (in pixels) to shift particles when centering them. Use ~10% of your box size. Larger values help with poorly centered particles but slow down processing."
        disabled={disableImageAlignment}
      />
      <PixelSizeInput
        label="Offset search step (pix):"
        placeholder=""
        min={0}
        max={10}
        value={formData.initialOffsetStep}
        name="initialOffsetStep"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Step size for offset searches. Smaller steps = more precise centering but slower. Usually 1-2 pixels is sufficient for most datasets."
        disabled={disableImageAlignment}
      />
      <CustomDropdown
        label="Perform local angular searches?"
        onChange={handleInputChange}
        value={formData.localAngularSearches}
        tooltipText="After global search, perform local refinement of particle orientations. Recommended 'Yes' for well-aligned datasets to improve accuracy without full global search overhead."
        name="localAngularSearches"
        options={dropdownOptions}
        disabled={disableImageAlignment}
      />
      <PixelSizeInput
        label="Local angular search range:"
        placeholder=""
        min={0}
        max={20}
        value={formData.localAngularSearchRange}
        name="localAngularSearchRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Range (in degrees) for local angular refinement. Smaller range assumes particles are already well-oriented. Typical value: 5° for already refined particles."
        disabled={!isEnabled || disableImageAlignment}
      />
      <SimpleInput
        label="Relax symmetry:"
        name="RelaxSymmetry"
        value={formData.RelaxSymmetry}
        disabled={!isEnabled || disableImageAlignment}
        onChange={handleInputChange}
        tooltipText="Lower symmetry to explore during local searches (e.g., use C2 when refining with C4 symmetry). Leave empty to use the same symmetry throughout."
        placeholder="e.g., C2"
      />
      <CustomDropdown
        label="Allow coarser sampling?"
        onChange={handleInputChange}
        value={formData.coarserSampling}
        tooltipText="Allow the algorithm to use coarser angular sampling in early iterations for speed, then automatically refine to finer sampling. Recommended 'Yes' for faster convergence."
        name="coarserSampling"
        options={dropdownOptions}
        disabled={disableImageAlignment}
      />
    </div>
  );
};

export default AutoSampling;
