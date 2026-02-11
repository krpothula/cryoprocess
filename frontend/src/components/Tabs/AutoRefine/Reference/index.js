import React from "react";

import PixelSizeInput from "../../common/PixelSixeInput";

import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const Reference = ({ formData, handleInputChange, handleRangeChange ,dropdownOptions}) => {

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Ref. map is on absolute greyscale?"
        options={dropdownOptions}
        value={formData.referenceMapAbsolute}
        name="referenceMapAbsolute"
        onChange={handleInputChange}
        tooltipText="Set to 'Yes' if reference is on absolute greyscale (from Post-Processing). Maps from Initial Model or 3D Classification are typically already on absolute scale."
      />
      <PixelSizeInput
        label="Initial low-pass filter (A):"
        value={formData.initialLowPassFilter}
        name="initialLowPassFilter"
        placeholder=""
        tooltipText="Low-pass filter reference to this resolution (Å) before starting. Prevents model bias. Use 40-60Å for initial refinement, lower values only for validated references."
        min={0}
        max={200}
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
      />
      <CustomDropdown
        label="Resize reference if needed?"
        options={dropdownOptions}
        value={formData.resizeReference}
        name="resizeReference"
        onChange={handleInputChange}
        tooltipText="Automatically resize reference to match particle box size. Recommended 'Yes' unless you have a specific reason to keep original reference dimensions."
      />
      <SimpleInput
        label="Symmetry:"
        placeholder="C1"
        name="Symmetry"
        value={formData.Symmetry}
        onChange={handleInputChange}
        tooltipText="Point group symmetry (C1, C2, D2, etc.). Correct symmetry dramatically speeds up refinement and improves resolution. Use C1 if symmetry is unknown."
      />
    </div>
  );
};

export default Reference;
