import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSizeInput";

const Io = ({
  formData,
  handleRangeChange,
  handleInputChange,
  jobType,
}) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageMrcFiles="AutoRefine,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "halfMap", value: val } });
        }}
        name="halfMap"
        placeholder="Select half-map from Auto-Refine"
        tooltipText="Select ONE of the two unfiltered half-maps from Auto-Refine. RELION will automatically find the second half-map for FSC calculation."
        label="One of the 2 unfiltered half-maps:"
        value={formData?.["halfMap"]}
        jobType={jobType}
      />
      <CustomInput
        stageMrcFiles="MaskCreate,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "solventMask", value: val } });
        }}
        name="solventMask"
        placeholder="Select mask from Mask Creation"
        tooltipText="Solvent mask to restrict local resolution calculation to protein region. Same mask used in Post-Processing works well."
        label="User-provided solvent mask:"
        value={formData?.["solventMask"]}
        jobType={jobType}
      />
      <PixelSizeInput
        label="Calibrated pixel size (A):"
        placeholder=""
        min={0}
        max={5}
        value={formData.calibratedPixelSize}
        name="calibratedPixelSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Calibrated pixel size (Å). Important for accurate resolution values. Use same value as in Post-Processing."
      />
    </div>
  );
};

export default Io;
