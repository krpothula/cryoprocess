import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";

const Fit = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  // When magnification estimation is enabled, disable all other CTF options
  const isMagEnabled = formData.estimateMagnification === "Yes";
  const isBeamtiltEnabled = formData.estimateBeamtilt === "Yes" && !isMagEnabled;
  const isCtfEnabled = formData.ctfParameter === "Yes" && !isMagEnabled;

  // Options for CTF fitting parameters: No, Per-micrograph, Per-particle
  const fitModeOptions = [
    { label: "No", value: "No" },
    { label: "Per-micrograph", value: "Per-micrograph" },
    { label: "Per-particle", value: "Per-particle" },
  ];

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Estimate (anisotropic) magnification?"
        options={dropdownOptions}
        value={formData.estimateMagnification}
        name="estimateMagnification"
        onChange={handleInputChange}
        tooltipText="Estimate and correct for anisotropic magnification (pixel size variations). Run this separately from other CTF refinements. Useful for datasets with magnification distortions."
      />
      <CustomDropdown
        label="Perform CTF parameter fitting?"
        options={dropdownOptions}
        value={formData.ctfParameter}
        name="ctfParameter"
        onChange={handleInputChange}
        tooltipText="Enable fitting of CTF parameters (defocus, astigmatism, B-factor, phase shift). Recommended for high-resolution refinement after initial Auto-Refine."
        disabled={isMagEnabled}
      />
      <CustomDropdown
        label="Fit defocus?"
        options={fitModeOptions}
        value={formData.fitDefocus}
        name="fitDefocus"
        onChange={handleInputChange}
        tooltipText="Refine defocus values. 'Per-particle' gives best results but requires more particles. 'Per-micrograph' is more robust for thin samples."
        disabled={!isCtfEnabled || isMagEnabled}
      />
      <CustomDropdown
        label="Fit astigmatism?"
        options={fitModeOptions}
        value={formData.fitAstigmatism}
        name="fitAstigmatism"
        onChange={handleInputChange}
        tooltipText="Refine astigmatism. 'Per-micrograph' recommended for most cases. 'Per-particle' only if you have very many particles per micrograph."
        disabled={!isCtfEnabled || isMagEnabled}
      />
      <CustomDropdown
        label="Fit B-factor?"
        options={fitModeOptions}
        value={formData.fitBFactor}
        name="fitBFactor"
        onChange={handleInputChange}
        tooltipText="Refine per-particle B-factors to account for radiation damage or sample drift. Can improve resolution for datasets with variable particle quality."
        disabled={!isCtfEnabled || isMagEnabled}
      />
      <CustomDropdown
        label="Fit phase-shift?"
        options={fitModeOptions}
        value={formData.fitPhaseShift}
        name="fitPhaseShift"
        onChange={handleInputChange}
        tooltipText="Refine phase shifts (for Volta Phase Plate data). Only relevant if your data was collected with a VPP."
        disabled={!isCtfEnabled || isMagEnabled}
      />
      <CustomDropdown
        label="Estimate beamtilt?"
        options={dropdownOptions}
        value={formData.estimateBeamtilt}
        name="estimateBeamtilt"
        onChange={handleInputChange}
        tooltipText="Estimate and correct beam tilt aberrations. Can significantly improve resolution, especially for data collected with beam-image shift."
        disabled={isMagEnabled}
      />
      <CustomDropdown
        label="Also estimate trefoil?"
        options={dropdownOptions}
        value={formData.estimateTreFoil}
        name="estimateTreFoil"
        onChange={handleInputChange}
        tooltipText="Also estimate trefoil (3-fold) aberrations along with beam tilt. Requires beam tilt estimation to be enabled. Can help with poorly aligned microscopes."
        disabled={!isBeamtiltEnabled || isMagEnabled}
      />
      <CustomDropdown
        label="Estimate 4th order aberrations?"
        options={dropdownOptions}
        value={formData.aberrations}
        name="aberrations"
        onChange={handleInputChange}
        tooltipText="Estimate 4th order aberrations (spherical aberration correction, tetrafoil). For high-resolution data where other aberrations are already corrected."
        disabled={isMagEnabled}
      />
      <PixelSizeInput
        label="Minimum resolution for fits (A):"
        placeholder=""
        min={0}
        max={250}
        value={formData.minResolutionFits}
        name="minResolutionFits"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum resolution (Å) to include in fits. Higher values (e.g., 30Å) exclude noisy high-resolution data. Use lower values (e.g., 8Å) for high-quality data."
      />
    </div>
  );
};

export default Fit;
