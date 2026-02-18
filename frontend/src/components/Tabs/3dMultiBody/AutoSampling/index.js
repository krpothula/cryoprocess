import React from "react";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomDropdown from "../../common/Dropdown";

const AutoSampling = ({
  formData,
  handleInputChange,
  degreeOptions,
  handleRangeChange,
}) => {
  return (
    <div className="tab-content">
      {" "}
      <CustomDropdown
        label="Initial angular sampling:"
        onChange={handleInputChange}
        value={formData.initialAngularSampling}
        tooltipText="Angular sampling interval (degrees) for multi-body refinement. Finer sampling gives more accurate orientations but is slower. Start with 7.5 degrees."
        name="initialAngularSampling"
        options={degreeOptions}
      />
      <PixelSizeInput
        label="Initial offset range (pix):"
        placeholder=""
        min={0}
        max={50}
        value={formData.initialOffsetRange}
        name="initialOffsetRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum translational offset (pixels) to search. Use ~10% of particle box size."
      />
      <PixelSizeInput
        label="Initial offset step (pix):"
        placeholder=""
        min={0}
        max={10}
        value={formData.initialOffsetStep}
        name="initialOffsetStep"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Step size (pixels) for translational offset search. Smaller steps are more accurate but slower. Usually 1-2 pixels."
      />
    </div>
  );
};

export default AutoSampling;
