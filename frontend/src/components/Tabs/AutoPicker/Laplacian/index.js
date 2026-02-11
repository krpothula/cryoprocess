import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";

const Laplacian = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Min. Diameter for LoG filter (Å):"
        placeholder=""
        min={0}
        max={1000}
        value={formData.minDiameter}
        name="minDiameter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum expected particle diameter in Angstroms. LoG will detect blob-like objects larger than this. Set slightly smaller than your smallest expected particle."
      />
      <PixelSizeInput
        label="Max. Diameter for LoG filter (Å):"
        placeholder=""
        min={0}
        max={1000}
        value={formData.maxDiameter}
        name="maxDiameter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum expected particle diameter in Angstroms. LoG will detect blob-like objects smaller than this. Set slightly larger than your largest expected particle."
      />
      <CustomDropdown
        label="Are the particles white?"
        onChange={handleInputChange}
        value={formData.areParticlesWhite}
        tooltipText="Set to 'Yes' if particles appear white (bright) on a dark background in your micrographs. Typically 'No' for cryo-EM data where protein appears dark."
        name="areParticlesWhite"
        options={dropdownOptions}
      />

      <PixelSizeInput
        label="Max Resolution to consider (A):"
        placeholder=""
        min={0}
        max={999}
        value={formData.maxResolution}
        name="maxResolution"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum resolution (in Angstroms) to consider during picking. Lower values (e.g., 20Å) filter out high-frequency noise, making picking more robust but may miss small features."
      />
      <PixelSizeInput
        label="Adjust default threshold (stddev):"
        placeholder=""
        min={-5}
        max={9999}
        value={formData.defaultThreshold}
        name="defaultThreshold"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Picking threshold in standard deviations above the mean. Lower values pick more particles (including false positives). Start with 0 and adjust based on results. Negative values pick more aggressively."
      />
      <PixelSizeInput
        label="Upper threshold (stddev):"
        placeholder=""
        min={0}
        max={9999}
        value={formData.upperThreshold}
        name="upperThreshold"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Upper threshold to exclude ice crystals or other artifacts that appear as very strong signals. Peaks above this threshold will be excluded from picking."
      />
    </div>
  );
};

export default Laplacian;
