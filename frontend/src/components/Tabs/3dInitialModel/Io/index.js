import React from "react";
import CustomInput from "../../common/Input";

const Io = ({ formData, handleInputChange, setFilePopup, jobType }) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="Extract,Class2D,Subset,InitialModel,Class3D,AutoRefine,CtfRefine,Polish,ManualSelect,Subtract,JoinStar"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputStarFile", value: val } });
        }}
        name="inputStarFile"
        label="Input images STAR file:"
        placeholder="Select particles from 2D Classification, Subset Selection, Select, or Extraction"
        tooltipText="Select the latest _data.star file from 2D Classification (preferred), particles.star from Subset Selection, particles.star from Select (Manual Selection), or particles.star from Extraction"
        value={formData?.["inputStarFile"]}
      />
      <CustomInput
        stageOptimiserFiles="InitialModel"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "continueFrom", value: val } });
        }}
        name="continueFrom"
        label="Continue from here:"
        placeholder="Select optimiser file to continue a stalled job"
        tooltipText="Continue from a previous Initial Model run. Select the latest _optimiser.star file from a stalled or incomplete job."
        value={formData?.["continueFrom"]}
      />
    </div>
  );
};

export default Io;
