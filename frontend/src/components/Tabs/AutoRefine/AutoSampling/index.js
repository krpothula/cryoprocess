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
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Initial angular sampling:"
        onChange={handleInputChange}
        value={formData.initialAngularSampling}
        tooltipText="How finely to rotate particles when searching for the correct orientation. Auto-Refine starts coarse and automatically refines. Smaller angles = more accurate but slower. Start with 7.5° for most cases."
        name="initialAngularSampling"
        options={degreeOptions}
      />
      <PixelSizeInput
        label="Initial offset range (pix):"
        placeholder=""
        min={0}
        max={50}
        value={formData.offSetRange}
        name="offSetRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum distance (in pixels) to shift particles when centering them. Use ~10% of your box size. Larger values help with poorly centered particles but slow down processing."
      />
      <PixelSizeInput
        label="Initial offset step (pix):"
        placeholder=""
        min={0}
        max={10}
        value={formData.offSetStep}
        name="offSetStep"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Step size for offset searches. Smaller steps = more precise centering but slower. Usually 1-2 pixels is sufficient for most datasets."
      />
      <CustomDropdown
        label="Local searches from auto-sampling:"
        onChange={handleInputChange}
        value={formData.LocalSearchfromAutoSampling}
        tooltipText="The finest angular sampling to use during auto-refinement. The algorithm will automatically progress from coarse to this fine sampling as refinement proceeds."
        name="LocalSearchfromAutoSampling"
        options={degreeOptions}
      />
      <SimpleInput
        label="Relax symmetry:"
        name="RelaxSymmetry"
        value={formData.RelaxSymmetry}
        onChange={handleInputChange}
        tooltipText="Lower symmetry to explore during local searches (e.g., use C2 when refining with C4 symmetry). Leave empty to use the same symmetry throughout."
        placeholder="e.g., C2"
      />
      <CustomDropdown
        label="Use finer angular sampling faster?"
        onChange={handleInputChange}
        value={formData.finerAngularSampling}
        tooltipText="Skip some intermediate angular sampling steps to reach fine sampling faster. Recommended 'No' for most cases to ensure proper convergence."
        name="finerAngularSampling"
        options={dropdownOptions}
      />
    </div>
  );
};

export default AutoSampling;
