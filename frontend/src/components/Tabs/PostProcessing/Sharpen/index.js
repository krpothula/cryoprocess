import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomInput from "../../common/Input";

const Sharpen = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isAutoBfactor = formData.bFactor === "Yes";
  const isOwnBfactor = formData.ownBfactor === "Yes";
  const isEnabled = formData.skipFSC === "Yes";
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Estimate B-factor automatically?"
        options={dropdownOptions}
        value={formData.bFactor}
        name="bFactor"
        onChange={handleInputChange}
        tooltipText="Automatically estimate B-factor from the Guinier plot. Recommended 'Yes' for most cases. Manual B-factor can be used for specific sharpening needs."
      />
      <PixelSizeInput
        label="Lowest resolution for auto-B fit (A):"
        placeholder=""
        min={1}
        max={50}
        value={formData.lowestResolution}
        name="lowestResolution"
        onChange={handleRangeChange}
              handleInputChange={handleInputChange}
        disabled={!isAutoBfactor}
        tooltipText="Low-resolution limit for B-factor fitting (Å). Default 10Å works well. Use higher values if Guinier plot looks noisy at lower resolutions."
      />
      <CustomDropdown
        label="Use your own B-factor?"
        options={dropdownOptions}
        value={formData.ownBfactor}
        name="ownBfactor"
        onChange={handleInputChange}
        tooltipText="Manually specify B-factor instead of automatic estimation. Useful for maps that don't sharpen well with automatic B-factor."
      />
      <PixelSizeInput
        label="Used-provided B-factor:"
        placeholder=""
        min={-2000}
        max={1}
        value={formData.providedBFactor}
        name="providedBFactor"
        onChange={handleRangeChange}
              handleInputChange={handleInputChange}
        disabled={!isOwnBfactor}
        tooltipText="B-factor value (negative number, typically -50 to -150). More negative values = more sharpening. Too much sharpening amplifies noise."
      />
      <CustomDropdown
        label="Skip FSC-weighting?"
        options={dropdownOptions}
        value={formData.skipFSC}
        name="skipFSC"
        onChange={handleInputChange}
        tooltipText="Skip FSC-weighting and use simple low-pass filter instead. Not recommended for normal processing. Use only for specific visualization needs."
      />
      <PixelSizeInput
        label="Ad-hoc low-pass filter (A):"
        placeholder=""
        min={1}
        max={50}
        value={formData.adHoc}
        name="adHoc"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        disabled={!isEnabled}
        tooltipText="Resolution cutoff (Å) when FSC-weighting is skipped. Only used when 'Skip FSC-weighting' is set to Yes."
      />
      <CustomInput
        label="MTF of the detector (STAR file)"
        name="mtfDetector"
       
        onChange={handleInputChange}
        tooltipText="MTF (Modulation Transfer Function) file for your detector. Available from manufacturer. Corrects for detector response at high frequencies."
      />
      <PixelSizeInput
        label="Original detector pixel size:"
        placeholder=""
        min={0}
        max={3}
        value={formData.originalDetector}
        name="originalDetector"
        onChange={handleRangeChange}
              handleInputChange={handleInputChange}
        tooltipText="Physical pixel size of your detector (not binned). K3=5μm, Falcon4=4.7μm. Used with MTF file for accurate correction."
      />
    </div>
  );
};

export default Sharpen;
