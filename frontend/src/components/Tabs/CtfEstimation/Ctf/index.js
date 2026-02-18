import React from "react";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomInput from "../../common/Input";
import CustomDropdown from "../../common/Dropdown";

const Ctf = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <CustomInput
        name="ctfFindExecutable"
        label="CTFFIND-4.1 executable:"
        placeholder="Loaded from server config..."
        tooltipText="Path to CTFFIND4 executable. Configured on the server in the .env file. CTFFIND4 is used for CTF estimation."
        value={formData?.["ctfFindExecutable"]}
        disabled={true}
      />
      <CustomDropdown
        label="Use power spectra of from MotionCorr job?:"
        options={dropdownOptions}
        value={formData.usePowerSpectraFromMotionCorr}
        name="usePowerSpectraFromMotionCorr"
        onChange={handleInputChange}
        tooltipText="Use pre-calculated power spectra from Motion Correction if available. Faster than recalculating, but requires power spectra to have been saved during motion correction."
      />
      <CustomDropdown
        label="Use exhaustive search?"
        options={dropdownOptions}
        value={formData.useExhaustiveSearch}
        name="useExhaustiveSearch"
        onChange={handleInputChange}
        tooltipText="Use exhaustive 2D search instead of 1D. More accurate for data with high astigmatism or poor initial estimates, but significantly slower."
      />

      <PixelSizeInput
        label="Estimate CTF of window size(px):"
        placeholder=""
        min={-1}
        max={50}
        value={formData.ctfWindowSize}
        name="ctfWindowSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Window size in pixels for CTF estimation. Use -1 to use the full micrograph. Smaller windows can capture local CTF variations but may be noisier."
      />
      <PixelSizeInput
        label="FFT box size (pix):"
        placeholder=""
        min={0}
        max={1000}
        value={formData.fftBoxSize}
        name="fftBoxSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Box size for FFT calculation. Should be power of 2 (256, 512, etc.). Larger boxes give better frequency resolution but average over larger areas."
      />
      <PixelSizeInput
        label="Minimum resolution (A):"
        placeholder=""
        min={0}
        max={100}
        value={formData.minResolution}
        name="minResolution"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Lowest resolution (highest frequency) to include in CTF fitting. Default 30Å excludes very low frequencies that may have ice gradients or other artifacts."
      />
      <PixelSizeInput
        label="Maximum resolution (A):"
        placeholder=""
        min={0}
        max={20}
        value={formData.maxResolution}
        name="maxResolution"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Highest resolution to include in CTF fitting. Should be where you still see Thon rings. Typically 3-5Å for good data. Lower for noisy/low-dose data."
      />

      <PixelSizeInput
        label="Minimum defocus value (A):"
        placeholder=""
        min={0}
        max={20000}
        value={formData.minDefocus}
        name="minDefocus"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum defocus to search in Angstroms. Set based on your data collection target defocus range. Typical minimum: 5000Å (0.5μm underfocus)."
      />
      <PixelSizeInput
        label="Maximum defocus value (A):"
        placeholder=""
        min={0}
        max={100000}
        value={formData.maxDefocus}
        name="maxDefocus"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum defocus to search in Angstroms. Set based on your target defocus range. Typical maximum: 50000Å (5μm underfocus). VPP data may use lower defocus."
      />
      <PixelSizeInput
        label="Defocus step size (A):"
        placeholder=""
        min={0}
        max={2000}
        value={formData.defocusStepSize}
        name="defocusStepSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Step size for defocus search in Angstroms. Smaller steps = more accurate but slower. Default 500Å works well. Use 100-200Å for high-resolution work."
      />
    </div>
  );
};

export default Ctf;
