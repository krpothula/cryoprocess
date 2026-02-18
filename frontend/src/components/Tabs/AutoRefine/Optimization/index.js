import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSizeInput";

const Optimization = ({ formData, handleInputChange, handleRangeChange ,dropdownOptions}) => {
  

  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Mask diameter (A):"
        placeholder=""
        min={0}
        max={1000}
        value={formData.maskDiameter}
        name="maskDiameter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Circular mask diameter in Angstroms. Should be slightly larger than your particle. Too large masks include noise; too small masks cut off protein density."
      />
      <CustomDropdown
        label="Mask individual particles with zeros:"
        options={dropdownOptions}
        value={formData.maskIndividualParticles}
        name="maskIndividualParticles"
        onChange={handleInputChange}
        tooltipText="Mask particles with zeros instead of noise. Recommended 'Yes' for most cases. Use 'No' only if particles extend to box edge."
      />
      <CustomDropdown
        label="Use solvent-flattened FSCs?:"
        options={dropdownOptions}
        value={formData.useSolventFlattenedFscs}
        name="useSolventFlattenedFscs"
        onChange={handleInputChange}
        tooltipText="Use solvent-flattened FSCs for resolution estimation. Requires a mask. Provides more accurate resolution estimates but may slightly reduce final resolution."
      />
      <CustomDropdown
        label="Use Blush regularisation:"
        options={dropdownOptions}
        value={formData.useBlushRegularisation}
        name="useBlushRegularisation"
        onChange={handleInputChange}
        tooltipText="Use Blush regularisation (neural network-based). Can improve map quality for challenging samples. Requires GPU and additional memory."
      />
    </div>
  );
};

export default Optimization;
