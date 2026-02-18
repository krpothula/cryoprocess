import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomDropdown from "../../common/Dropdown";

const Io = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
  jobType,
}) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="CtfFind"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputMicrographs", value: val } });
        }}
        name="inputMicrographs"
        label="Input micrographs for autopick"
        placeholder="Select CTF estimation output"
        tooltipText="Select micrographs_ctf.star from CTF estimation job"
        value={formData?.["inputMicrographs"]}
      />
      <PixelSizeInput
        label="Pixel size in micrographs (A):"
        placeholder=""
        min={0}
        max={50}
        value={formData.pixelSize}
        name="pixelSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Pixel size of the micrographs in Angstroms. Should match your data acquisition settings. This is used to correctly scale particle detection parameters."
      />
      <CustomDropdown
        label="Use reference-based template-matching?"
        options={dropdownOptions}
        value={formData.templateMatching}
        name="templateMatching"
        onChange={handleInputChange}
        tooltipText="Use 2D class averages as templates to find particles. Best for well-characterized particles. Requires good templates from previous 2D classification or manually created references."
      />
      <CustomDropdown
        label="OR: use Laplacian-of-Gaussian?"
        options={dropdownOptions}
        value={formData.laplacianGaussian}
        name="laplacianGaussian"
        onChange={handleInputChange}
        tooltipText="Template-free picking using blob detection. Good for initial picking when no templates are available. Works well for spherical particles. Specify min/max diameter in the Laplacian tab."
      />
    </div>
  );
};

export default Io;
