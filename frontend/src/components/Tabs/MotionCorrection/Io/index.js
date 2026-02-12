import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";

const Io = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
  jobType,
}) => {
  const isMotionCor2 = formData.useRelionImplementation === "No";

  return (
    <div>
      <div className="tab-content ">
        <CustomInput
          isCustomUpload={false}
          stageStarFiles="Import"
          onChange={(val = "") => {
            handleInputChange({ target: { name: "inputMovies", value: val } });
          }}
          name="inputMovies"
          label="Input movies STAR file:"
          placeholder="Select Import STAR file"
          tooltipText="Select a movies.star or micrographs.star file from a completed Import job"
          value={formData?.["inputMovies"]}
          jobType={jobType}
        />

        <PixelSizeInput
          label="First frame for corrected sum:"
          placeholder="1.4"
          min={0}
          max={50}
          value={formData.firstFrame}
          name="firstFrame"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="First frame to include in the motion-corrected sum. Set to 1 to start from the beginning. Early frames may have more beam-induced motion."
        />
        <PixelSizeInput
          label="Last frame for corrected sum:"
          placeholder="1.4"
          min={-1}
          max={50}
          value={formData.lastFrame}
          name="lastFrame"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Last frame to include in the sum. Use -1 to include all frames. Later frames accumulate radiation damage but have less motion."
        />
        <PixelSizeInput
          label="EER fractional:"
          placeholder=""
          min={0}
          max={100}
          value={formData.eerFractionation}
          name="eerFractionation"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Number of EER frames to group together. Only for Falcon4 EER data. Higher values = faster processing but less motion correction accuracy."
        />

        <PixelSizeInput
          label="Dose per frame (e/A²):"
          placeholder="1.4"
          min={0}
          max={10}
          value={formData.dosePerFrame}
          name="dosePerFrame"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Electron dose per frame in electrons per square Angstrom. Required for dose-weighting. Calculate from total dose divided by number of frames."
        />
        <PixelSizeInput
          label="Pre-exposure (e/A²):"
          placeholder=""
          min={0}
          max={50}
          value={formData.preExposure}
          name="preExposure"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Dose accumulated before the first frame (e.g., from search/focus). Usually 0 unless your acquisition software records this."
        />
        <CustomDropdown
          label="Do dose weighting?"
          options={dropdownOptions}
          value={formData.doseWeighting}
          name="doseWeighting"
          onChange={handleInputChange}
          tooltipText="Apply dose-weighting to down-weight high-frequency information in later frames that have accumulated radiation damage. Highly recommended for best resolution."
        />
        <CustomDropdown
          label="Save non dose weighted as well?"
          options={dropdownOptions}
          value={formData.nonDoseWeighted}
          name="nonDoseWeighted"
          onChange={handleInputChange}
          tooltipText="Also save micrographs without dose-weighting. Useful for particle picking or visual inspection. Uses extra disk space."
          disabled={formData.doseWeighting === "No"}
          disabledHint="Enable 'Do dose weighting' first"
        />

        <CustomDropdown
          label="Write output in float16?"
          options={dropdownOptions}
          value={formData.float16Output}
          name="float16Output"
          onChange={handleInputChange}
          tooltipText={isMotionCor2 ? "Not available with MotionCor2" : "Save corrected micrographs in 16-bit format to reduce disk space. Recommended for most workflows with no quality loss."}
          disabled={isMotionCor2}
          disabledHint={isMotionCor2 ? "Not available with MotionCor2" : undefined}
        />

        <CustomDropdown
          label="Save sum of power spectra:"
          options={dropdownOptions}
          value={formData.savePowerSpectra}
          name="savePowerSpectra"
          onChange={handleInputChange}
          tooltipText={isMotionCor2 ? "Not available with MotionCor2" : "Save averaged power spectra for on-the-fly CTF estimation during data collection. Enables faster feedback."}
          disabled={isMotionCor2}
          disabledHint={isMotionCor2 ? "Not available with MotionCor2" : undefined}
        />
        <PixelSizeInput
          label="Sum power spectra every (e/A²):"
          placeholder=""
          min={1}
          max={10}
          value={formData.sumPowerSpectra}
          name="sumPowerSpectra"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Dose interval (in e/A²) at which to save summed power spectra. Lower values give more spectra for CTF estimation but increase disk usage."
          disabled={formData.savePowerSpectra === "No" || isMotionCor2}
          disabledHint={isMotionCor2 ? "Not available with MotionCor2" : "Enable 'Save sum of power spectra' first"}
        />
      </div>
    </div>
  );
};

export default Io;
