import React from "react";
import CustomDropdown from "../../common/Dropdown";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";

const Polish = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  jobType,
}) => {
  const isEnable = formData.ownParams === "Yes";
  return (
    <div className=" tab-content">
      <CustomDropdown
        label="Perform particle polishing?"
        name="particlePolishing"
        value={formData.particlePolishing}
        onChange={handleInputChange}
        tooltipText="Apply Bayesian polishing to re-extract particles with per-particle motion correction. This can significantly improve resolution."
        options={dropdownOptions}
      />
      <CustomInput
        stageStarFiles="Polish"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "optimisedParameterFile", value: val } });
        }}
        name="optimisedParameterFile"
        label="Optimised parameter file:"
        placeholder="Select opt_params.txt from a previous training run"
        tooltipText="Load pre-trained parameters from a previous training run. After training, open the opt_params.txt file to find the optimised sigma values and enter them below."
        value={formData?.["optimisedParameterFile"]}
        jobType={jobType}
      />
      <CustomDropdown
        label="OR: you use your own parameter?"
        name="ownParams"
        value={formData.ownParams}
        onChange={handleInputChange}
        tooltipText="Manually specify polishing parameters instead of using trained or default values. For expert users only."
        options={dropdownOptions}
      />
      <PixelSizeInput
        label="Sigma for velocity (A/dose):"
        placeholder=""
        min={0}
        max={50}
        value={formData.sigmaVelocity}
        name="sigmaVelocity"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Prior sigma for particle velocity (motion rate). Higher values allow more motion. Typical range: 0.2-0.8 Å/dose depending on sample."
        disabled={!isEnable}
      />
      <PixelSizeInput
        label="Sigma for divergence (A):"
        placeholder=""
        min={0}
        max={50000}
        value={formData.sigmaDivergence}
        name="sigmaDivergence"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Prior sigma for divergence (spatial variation of motion). Higher values allow more variable motion across the field. Typical range: 1000-5000 Å."
        disabled={!isEnable}
      />
      <PixelSizeInput
        label="Sigma for accelerations (A/dose):"
        placeholder=""
        min={0}
        max={50}
        value={formData.sigmaAcceleration}
        name="sigmaAcceleration"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Prior sigma for acceleration (change in motion rate). Higher values allow more jerky motion. Usually much smaller than velocity sigma."
        disabled={!isEnable}
      />
      <PixelSizeInput
        label="Minimum resolution for B-factor fit (A):"
        placeholder=""
        min={0}
        max={50}
        value={formData.minResolutionBfac}
        name="minResolutionBfac"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum resolution (Å) for B-factor fitting. Sets the low-resolution cutoff. Default 20Å excludes very low frequencies."
      />
      <PixelSizeInput
        label="Maximum resolution for B-factor fit (A):"
        placeholder=""
        min={-1}
        max={50}
        value={formData.maxResolutionBfac}
        name="maxResolutionBfac"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum resolution (Å) for B-factor fitting. Sets the high-resolution cutoff. Use -1 for automatic detection based on FSC."
      />
    </div>
  );
};

export default Polish;
