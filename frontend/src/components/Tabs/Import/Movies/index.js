import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const Movies = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
}) => {
  const enable = formData.rawMovies === "Yes";
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Import raw movies/micrographs?"
        options={dropdownOptions}
        value={formData.rawMovies}
        name="rawMovies"
        onChange={handleInputChange}
        tooltipText="Select 'Yes' to import raw movie files (MRC, TIFF, EER) or single micrographs for processing. This is the starting point for a new dataset."
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("inputFiles");
        }}
        name="inputFiles"
        label="Raw input files:"
        placeholder="Micrographs/*.tif"
        tooltipText="Path to your raw data files. Use wildcards (e.g., Movies/*.tif, *.mrc, *.eer) to select multiple files. Supports TIFF, MRC, and EER formats."
        value={formData?.inputFiles}
        disabled={!enable}
      />
      <CustomDropdown
        label="Are these multi-frame movies?"
        onChange={handleInputChange}
        value={formData.multiFrameMovies}
        options={dropdownOptions}
        name="multiFrameMovies"
        tooltipText="Select 'Yes' if importing dose-fractionated movies (multiple frames per exposure). Select 'No' for single-frame micrographs."
        disabled={!enable}
      />
      <SimpleInput
        tooltipText="Name for this optics group. Use different names when combining data from multiple microscope sessions or with different imaging conditions."
        label="Optics group"
        name="opticsGroupName"
        placeholder="Opticsgroup1"
        value={formData.opticsGroupName}
        onChange={handleInputChange}
        disabled={!enable}
      />

      {/* <CustomInput
        label="MTF of the detector"
        placeholder=""
        onChange={handleInputChange}
        name="mtf"
        tooltipText="MTF of the detector"
        disabled={!enable}
      /> */}

      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("mtf");
        }}
        name="mtf"
        label="MTF of the detector"
        placeholder=""
        tooltipText="Modulation Transfer Function file for your detector (STAR format). Improves CTF fitting accuracy by accounting for detector-specific signal dampening at high resolution."
        value={formData?.["mtf"]}
        disabled={!enable}
      />

      <PixelSizeInput
        label="Pixel size (Angstrom):"
        placeholder="1.4"
        min={0}
        max={5}
        value={formData.angpix}
        name="angpix"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Physical pixel size of your detector in Angstroms. Check your microscope settings or EPU session. Common values: K3=0.83Å (super-res), Falcon4=0.75Å."
        disabled={!enable}
      />
      <PixelSizeInput
        label="Voltage (kV):"
        placeholder="300"
        min={0}
        max={500}
        value={formData.kV}
        name="kV"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Microscope accelerating voltage in kilovolts. Most common: 300kV for high-resolution work, 200kV for some applications."
        disabled={!enable}
      />
      <PixelSizeInput
        label="Spherical aberration (mm):"
        placeholder="2.7"
        min={0}
        max={5}
        value={formData.spherical}
        name="spherical"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Spherical aberration coefficient (Cs) of your microscope in mm. Typical values: 2.7mm for most microscopes, 0.001mm for Cs-corrected microscopes."
        disabled={!enable}
      />
      <PixelSizeInput
        label="Amplitude Contrast:"
        placeholder="0.1"
        min={-1}
        max={1}
        value={formData.amplitudeContrast}
        name="amplitudeContrast"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Fraction of amplitude contrast (vs phase contrast). Typically 0.07-0.10 for cryo-EM of biological samples. Higher for negatively stained samples (~0.15)."
        disabled={!enable}
      />
      <PixelSizeInput
        label="Beamtilt in X (mrad):"
        placeholder="0"
        min={-1}
        max={1}
        value={formData.beamtiltX}
        name="beamtiltX"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Known beam tilt in X direction in milliradians. Usually 0 unless specifically measured. Can be refined later in CTF refinement."
        disabled={!enable}
      />
      <PixelSizeInput
        label="Beamtilt in Y (mrad):"
        placeholder="0"
        min={-1}
        max={1}
        value={formData.beamtiltY}
        name="beamtiltY"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Known beam tilt in Y direction in milliradians. Usually 0 unless specifically measured. Can be refined later in CTF refinement."
        disabled={!enable}
      />
    </div>
  );
};

export default Movies;
