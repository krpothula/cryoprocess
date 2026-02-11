import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";

const Io = ({ handleInputChange, formData, handleRangeChange, jobType }) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="CtfFind,MotionCorr"
        onChange={(val = "") => {
          handleInputChange({
            target: { name: "microGraphsStar", value: val },
          });
        }}
        name="microGraphsStar"
        label="Select from micrographs star:"
        placeholder="Select micrographs STAR file"
        tooltipText="Select micrographs STAR file from CTF or Motion Correction"
        value={formData?.["microGraphsStar"]}
        jobType={jobType}
      />
      <CustomInput
        stageStarFiles="Extract,Class2D,Subset,InitialModel,Class3D,AutoRefine,CtfRefine,Polish,ManualSelect,Subtract,JoinStar"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({
            target: { name: "particlesStar", value: val },
          });
        }}
        name="particlesStar"
        label="Select from particles star:"
        placeholder="Select particles STAR file"
        tooltipText="Select particles STAR file from Extraction, Classification, or Refinement"
        value={formData?.["particlesStar"]}
        jobType={jobType}
      />
      <PixelSizeInput
        label="Minimum threshold for auto-selection:"
        placeholder=""
        min={0}
        max={250}
        value={formData.minThresholdAutoSelect}
        name="minThresholdAutoSelect"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum class score threshold for automatic selection. Classes with scores below this will be excluded. Higher values are more selective."
      />
    </div>
  );
};

export default Io;
