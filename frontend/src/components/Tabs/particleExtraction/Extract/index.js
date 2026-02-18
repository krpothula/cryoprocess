import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSizeInput";

const Extract = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isrescaleParticlesYes = formData.rescaleParticles === "Yes";
  const autopick = formData.useAutopickFOMThreshold === "Yes";

  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Particle box size (pix):"
        placeholder=""
        min={16}
        max={1024}
        step={2}
        value={formData.particleBoxSize}
        name="particleBoxSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Size of the box (in pixels) for extracted particles. Must be even. Should be ~1.5-2x particle diameter. Larger boxes capture more solvent but increase computation time."
      />
      <CustomDropdown
        label="Invert Contrast?"
        options={dropdownOptions}
        value={formData.invertContrast}
        name="invertContrast"
        onChange={handleInputChange}
        tooltipText="Invert particle contrast so proteins appear white on black background. Required for cryo-EM data. Set to 'Yes' for standard cryo-EM processing."
      />
      <CustomDropdown
        label="Normalize Particles?"
        options={dropdownOptions}
        value={formData.normalizeParticles}
        name="normalizeParticles"
        onChange={handleInputChange}
        tooltipText="Normalize particle images to have zero mean and unit standard deviation in the background. Highly recommended for consistent classification and refinement results."
      />

      <PixelSizeInput
        label="Diameter background circle (pix):"
        placeholder=""
        min={-1}
        max={50}
        value={formData.diameterBackgroundCircle}
        name="diameterBackgroundCircle"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Diameter (in pixels) of the circular area used for background estimation during normalization. Set to -1 for automatic (outer ring of the box). Should be larger than your particle."
      />
      <PixelSizeInput
        label="Stddev for white dust removal:"
        placeholder=""
        min={-1}
        max={50}
        value={formData.stddevWhiteDust}
        name="stddevWhiteDust"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Remove bright outlier pixels (dust, hot pixels) above this many standard deviations. Set to -1 to disable. Typical value: 5. Lower values remove more pixels."
      />
      <PixelSizeInput
        label="Stddev for black dust removal:"
        placeholder=""
        min={-1}
        max={50}
        value={formData.stddevBlackDust}
        name="stddevBlackDust"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Remove dark outlier pixels below this many standard deviations. Set to -1 to disable. Typical value: 5. Lower values remove more pixels."
      />

      <CustomDropdown
        label="Rescaled particles:"
        options={dropdownOptions}
        value={formData.rescaleParticles}
        name="rescaleParticles"
        onChange={handleInputChange}
        tooltipText="Rescale (downsample) particles to a smaller box size. Useful for faster 2D/3D classification with binned data. Remember to scale pixel size accordingly."
      />
      <PixelSizeInput
        label="Re-scaled size (pixel):"
        placeholder=""
        min={16}
        max={1024}
        step={2}
        value={formData.rescaledSize}
        name="rescaledSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Target box size (in pixels) after rescaling. Must be even and smaller than original. Common practice: downsample 2-4x for initial classification, then re-extract at full size."
        disabled={!isrescaleParticlesYes}
        disabledHint="Enable 'Rescaled particles' to set target size"
      />

      <CustomDropdown
        label="Use autopick FOM threshold?"
        options={dropdownOptions}
        value={formData.useAutopickFOMThreshold}
        name="useAutopickFOMThreshold"
        onChange={handleInputChange}
        tooltipText="Filter particles based on autopicker Figure-of-Merit scores. Useful for removing low-confidence picks without manual inspection."
      />
      <PixelSizeInput
        label="Minimum autopick FOM:"
        placeholder=""
        min={0}
        max={50}
        value={formData.minimumAutopickFOM}
        name="minimumAutopickFOM"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum FOM score for particles to be extracted. Only particles with FOM >= this value will be included. Check your autopicking results to determine appropriate threshold."
        disabled={!autopick}
        disabledHint="Enable 'Use autopick FOM threshold' first"
      />
    </div>
  );
};

export default Extract;
