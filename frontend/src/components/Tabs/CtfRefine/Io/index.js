import React from "react";
import CustomInput from "../../common/Input";

const Io = ({handleInputChange, formData, handleRangeChange, dropdownOptions, jobType}) => {

  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="AutoRefine,Class3D"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "particlesStar", value: val } });
        }}
        name="particlesStar"
        label="Particles (from Refine3D):"
        placeholder="Select particles from Auto-Refine or 3D Classification"
        tooltipText="Select _data.star from a completed 3D Auto-Refine or 3D Classification job. Particles must have accurate orientations for CTF refinement to work."
        value={formData?.["particlesStar"]}
        jobType={jobType}
      />
      <CustomInput
        stageStarFiles="PostProcess"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "postProcessStar", value: val } });
        }}
        name="postProcessStar"
        label="Postprocess STAR file:"
        placeholder="Select postprocess.star from Post-Processing"
        tooltipText="Select postprocess.star from Post-Processing job. Required for FSC-weighting during CTF parameter estimation. Run Post-Processing before CTF Refinement."
        value={formData?.["postProcessStar"]}
        jobType={jobType}
      />
    </div>
  );
};

export default Io;
