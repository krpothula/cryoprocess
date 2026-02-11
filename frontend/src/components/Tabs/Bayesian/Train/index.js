import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSixeInput";

const Train = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isEnabled = formData.optimalParameters === "Yes";
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Train optimal parameters?"
        name="optimalParameters"
        options={dropdownOptions}
        value={formData.optimalParameters}
        onChange={handleInputChange}
        tooltipText="Train Bayesian polishing parameters on a subset of particles. Recommended before polishing if you have a new microscope or sample type."
      />
      <PixelSizeInput
        label="Fraction of Fourier pixels for testing:"
        placeholder=""
        min={0}
        max={1}
        value={formData.fractionFourierPixels}
        name="fractionFourierPixels"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Fraction of Fourier space to hold out for cross-validation. Default 0.5 is typically good. Higher values give more robust but slower training."
        disabled={!isEnabled}
      />
      <PixelSizeInput
        label="Use this many particles:"
        placeholder=""
        min={0}
        max={100000}
        value={formData.UseParticles}
        name="useParticles"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of particles to use for training. 5000-10000 is usually sufficient. More particles give better estimates but take longer."
        disabled={!isEnabled}
      />
    </div>
  );
};

export default Train;
