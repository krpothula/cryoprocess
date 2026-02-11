import React from "react";
import CustomInput from "../../common/Input";

const Io = ({ formData, handleInputChange }) => {
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
        placeholder="Select particles.star from Extraction or Select"
        tooltipText="Select particles.star from Particle Extraction job or Select (Manual Selection) job"
        value={formData?.["inputStarFile"]}
      />
      <CustomInput
        stageOptimiserFiles="Class2D"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "continueFrom", value: val } });
        }}
        name="continueFrom"
        label="Continue from here:"
        placeholder="Select optimiser.star to continue stalled job"
        tooltipText="Select _optimiser.star file from last completed iteration to continue a stalled 2D classification job"
        value={formData?.["continueFrom"]}
      />
    </div>
  );
};

export default Io;
