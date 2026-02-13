import React from "react";
import CustomInput from "../../common/Input";
import CustomDropdown from "../../common/Dropdown";

const Io = ({ formData, handleInputChange, dropdownOptions, jobType }) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageOptimiserFiles="AutoRefine"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "refinementStarFile", value: val } });
        }}
        name="refinementStarFile"
        placeholder="Select optimiser.star from Auto-Refine"
        tooltipText="Select consensus refinement optimiser.star file"
        label="Consensus refinement optimiser.star:"
        value={formData?.["refinementStarFile"]}
        jobType={jobType}
      />
      <CustomInput
        onChange={handleInputChange}
        name="continue"
        placeholder=""
        tooltipText="Continue from previous multi-body run"
        label="Continue from here:"
        disabled={true}
        value={formData?.["continue"]}
      />
      <CustomInput
        onChange={handleInputChange}
        name="bodyStarFile"
        placeholder=""
        tooltipText="STAR file defining the bodies"
        label="Body STAR file:"
        value={formData?.["bodyStarFile"]}
      />
      <CustomDropdown
        label="Reconstruct subtracted bodies?"
        onChange={handleInputChange}
        value={formData.reconstructSubtracted}
        tooltipText="Reconstruct subtracted images where other bodies have been removed. Produces cleaner maps for each body."
        name="reconstructSubtracted"
        options={dropdownOptions}
      />
      <CustomDropdown
        label="Use Blush regularisation?"
        onChange={handleInputChange}
        value={formData.blushRegularisation}
        tooltipText="Use Blush regularisation (neural network-based) for improved map quality. Requires GPU and additional memory."
        name="blushRegularisation"
        options={dropdownOptions}
      />
    </div>
  );
};

export default Io;
