import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";

const Io = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  jobType,
}) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="Extract,Class2D,Subset,InitialModel,Class3D,AutoRefine,CtfRefine,Polish,ManualSelect,Subtract,JoinStar"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "micrographs", value: val } });
        }}
        name="micrographs"
        label="Input images STAR file:"
        placeholder="Select particles STAR file"
        tooltipText="Select particles or images STAR file"
        value={formData?.["micrographs"]}
        jobType={jobType}
      />

      <CustomInput
        stageMrcFiles="AutoRefine,Class3D"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "consensusMap", value: val } });
        }}
        name="consensusMap"
        label="Consensus map:"
        placeholder="Select consensus map from Auto-Refine or 3D Classification"
        tooltipText="Select consensus map from refinement"
        value={formData?.["consensusMap"]}
        jobType={jobType}
      />

      <PixelSizeInput
        label="Number of Gaussians:"
        placeholder=""
        min={1}
        max={1000}
        value={formData.numGaussians}
        name="numGaussians"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of Gaussians used for the flexibility model. More Gaussians capture finer motions but increase computation time."
      />

      <SimpleInput
        label="Initial map threshold (optional):"
        value={formData.initialMapThreshold || ""}
        onChange={handleInputChange}
        name="initialMapThreshold"
        placeholder=""
        tooltipText="Initial threshold for the consensus map. Leave empty to use automatic threshold."
      />

      <PixelSizeInput
        label="Regularization Factor:"
        placeholder=""
        min={0}
        max={1000}
        value={formData.regularizationFactor}
        name="regularizationFactor"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Regularization factor for the flexibility model. Higher values produce smoother deformations."
      />

      <SimpleInput
        label="DynaMight executable:"
        value={formData.dynamightExecutable || ""}
        onChange={handleInputChange}
        name="dynamightExecutable"
        placeholder="relion_python_dynamight"
        tooltipText="Path to the DynaMight executable. Leave empty to use the default."
      />

      <SimpleInput
        label="Which (single) GPU to use:"
        value={formData.gpuToUse || ""}
        onChange={handleInputChange}
        name="gpuToUse"
        placeholder="0"
        tooltipText="GPU device ID for DynaMight (e.g., '0' for first GPU). DynaMight uses a single GPU."
      />

      <CustomDropdown
        label="Preload images in RAM?"
        options={dropdownOptions}
        value={formData.preloadImages}
        name="preloadImages"
        onChange={handleInputChange}
        tooltipText="Load all particle images into RAM before processing. Faster but requires sufficient memory for the entire dataset."
      />
    </div>
  );
};

export default Io;
