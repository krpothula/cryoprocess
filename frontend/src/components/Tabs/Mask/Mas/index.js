import React from "react";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomDropdown from "../../common/Dropdown";

const Mas = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isFillWithSpheres = formData.fillWithSpheres === "Yes";

  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Lowpass filter map (A)"
        placeholder=""
        min={0}
        max={50}
        value={formData.lowpassFilter}
        name="lowpassFilter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Low-pass filter the map before mask creation (Å). Removes high-frequency noise. Use 15-20Å for most maps to get a smooth mask."
      />
      <PixelSizeInput
        label="Pixel size (A)"
        placeholder=""
        min={-1}
        max={10}
        value={formData.angpix}
        name="angpix"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Pixel size of the input map in Angstroms. Set to -1 to use the value from the input map header (recommended). Otherwise specify the exact pixel size."
      />
      <PixelSizeInput
        label="Initial binarisation threshold"
        placeholder=""
        min={0}
        max={0.1}
        step={0.001}
        value={formData.initialThreshold}
        name="initialThreshold"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Threshold for creating binary mask. Voxels above this value become 1, below become 0. Start low (0.002-0.01) and increase if mask is too large. Check your map's max value in the header - threshold should be well below max."
      />
      <PixelSizeInput
        label="Extend binary mask (pixels)"
        placeholder=""
        min={0}
        max={50}
        value={formData.extendBinaryMask}
        name="extendBinaryMask"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Extend the binary mask by this many pixels. Ensures the mask fully covers your protein including flexible regions. Typical value: 3-6 pixels."
      />
      <PixelSizeInput
        label="Soft edge width (pixels)"
        placeholder=""
        min={0}
        max={50}
        value={formData.softEdgeWidth}
        name="softEdgeWidth"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Add soft (cosine) edge of this width in pixels. Prevents sharp mask artifacts. Typical value: 3-6 pixels. Total mask padding = extend + soft edge."
      />
      <CustomDropdown
        label="Invert mask?"
        placeholder=""
        options={dropdownOptions}
        value={formData.invertMask}
        name="invertMask"
        onChange={handleInputChange}
        tooltipText="Invert the final mask so that the protein region becomes 0 and the solvent becomes 1. Useful for creating solvent masks."
      />
      <CustomDropdown
        label="Fill mask with spheres?"
        placeholder=""
        options={dropdownOptions}
        value={formData.fillWithSpheres}
        name="fillWithSpheres"
        onChange={handleInputChange}
        tooltipText="Fill the interior of the mask with overlapping spheres. Useful for helical reconstructions where the mask interior may have holes."
      />
      <PixelSizeInput
        label="Sphere radius (pixels)"
        placeholder=""
        min={1}
        max={50}
        value={formData.sphereRadius}
        name="sphereRadius"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Radius of the spheres used to fill the mask interior (in pixels)."
        disabled={!isFillWithSpheres}
      />
    </div>
  );
};

export default Mas;
