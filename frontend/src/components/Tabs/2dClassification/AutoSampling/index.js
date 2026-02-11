import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";

const AutoSampling = ({
  formData,
  handleInputChange,
  degreeOptions,
  handleRangeChange,
  dropdownOptions,
}) => {
  const disableImageAlignment = formData.performImageAlignment === "No";

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Perform image alignment?"
        options={dropdownOptions}
        value={formData.performImageAlignment}
        name="performImageAlignment"
        onChange={handleInputChange}
        tooltipText="Perform in-plane rotation and translation alignment. Set to 'Yes' for standard classification. 'No' only if particles are already perfectly aligned."
      />
      <PixelSizeInput
        label="In-plane angular sampling:"
        placeholder=""
        min={0}
        max={20}
        value={formData.angularSearchRange}
        name="angularSearchRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="In-plane angular sampling rate (degrees). Note: For efficient GPU calculations, RELION may automatically adjust this value (e.g., to 5.625°). Values that are multiples of 360/64 work best for GPU optimization."
        disabled={disableImageAlignment}
      />
      <PixelSizeInput
        label="Offset search range(pix):"
        placeholder=""
        min={0}
        max={20}
        value={formData.offsetSearchRange}
        name="offsetSearchRange"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum shift (in pixels) to search for particle centering. Use ~10% of box size. Larger values for poorly centered particles but slower."
        disabled={disableImageAlignment}
      />
      <PixelSizeInput
        label="Offset search step(pix):"
        placeholder=""
        min={0}
        max={10}
        value={formData.offsetSearchStep}
        name="offsetSearchStep"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Step size (in pixels) for offset search. Smaller steps = more precise but slower. Usually 1-2 pixels is sufficient."
        disabled={disableImageAlignment}
      />
      <CustomDropdown
        label="Allow coarser sampling?"
        options={dropdownOptions}
        value={formData.allowCoarseSampling}
        name="allowCoarseSampling"
        onChange={handleInputChange}
        tooltipText="Allow coarser angular sampling in early iterations for speed. Recommended 'Yes' for faster convergence, especially with large datasets."
        disabled={disableImageAlignment}
      />
    </div>
  );
};

export default AutoSampling;
