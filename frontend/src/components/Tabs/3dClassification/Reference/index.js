import React from "react";
import PixelSizeInput from "../../common/PixelSizeInput";

import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const Reference = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Ref. map is on absolute greyscale?"
        options={dropdownOptions}
        value={formData.referenceMapAbsolute}
        name="referenceMapAbsolute"
        onChange={handleInputChange}
        tooltipText="Set to 'Yes' if reference map is on absolute greyscale (e.g., from Post-Processing). Maps from Initial Model or Auto-Refine are typically already on absolute scale."
      />
      <CustomDropdown
        label="Resize reference if needed?"
        options={dropdownOptions}
        value={formData.resizeReference}
        name="resizeReference"
        onChange={handleInputChange}
        tooltipText="If set to Yes, the reference will be resized to match the particles if necessary. This is generally recommended."
      />
      <PixelSizeInput
        label="Initial low-pass filter (A):"
        value={formData.initialLowPassFilter}
        name="initialLowPassFilter"
        placeholder=""
        tooltipText="Low-pass filter reference to this resolution (Å) before starting. Prevents overfitting to high-frequency noise. Use 40-60Å for first run, lower for well-validated references."
        min={0}
        max={200}
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
      />

      <SimpleInput
        label="Symmetry:"
        placeholder=""
        name="symmetry"
        value={formData.symmetry}
        onChange={handleInputChange}
        tooltipText="Point group symmetry (C1, C2, D2, etc.). Must match your reference map symmetry. Incorrect symmetry will produce artifacts."
      />
    </div>
  );
};

export default Reference;
