import React from "react";
import CustomInput from "../../common/Input";

const Io = ({ formData, handleInputChange, jobType, setFilePopup }) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="Extract,Class2D,Subset,InitialModel,Class3D,AutoRefine,CtfRefine,Polish,ManualSelect,Subtract,JoinStar"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputStarFile", value: val } });
        }}
        name="inputStarFile"
        placeholder="Select particles.star"
        tooltipText="STAR file from Extraction, 2D Classification, Subset Selection, Initial Model, 3D Classification, Auto-Refine, CTF Refinement, or Bayesian Polishing"
        label="Input images STAR file:"
        value={formData?.["inputStarFile"]}
      />
      <CustomInput
        stageOptimiserFiles="AutoRefine"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "continueFrom", value: val } });
        }}
        name="continueFrom"
        placeholder="Select optimiser file to continue a stalled job"
        tooltipText="Continue from a previous 3D Auto-Refine run. Select the latest _optimiser.star file from a stalled or incomplete job."
        label="Continue from here:"
        value={formData?.["continueFrom"]}
      />
      <CustomInput
        stageMrcFiles="InitialModel,Class3D,AutoRefine,PostProcess,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "referenceMap", value: val } });
        }}
        name="referenceMap"
        placeholder="Select reference map"
        tooltipText="Reference 3D map from Initial Model, 3D Classification, Auto-Refine, or Post Processing"
        label="Reference map:"
        jobType={jobType}
        value={formData?.["referenceMap"]}
        showBrowseButton={true}
        onBrowseClick={() => setFilePopup("referenceMap")}
      />
      <CustomInput
        stageMrcFiles="MaskCreate"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "referenceMask", value: val } });
        }}
        name="referenceMask"
        placeholder="Select mask file"
        tooltipText="Optional solvent mask to focus refinement on a specific region"
        label="Reference mask (optional):"
        value={formData?.["referenceMask"]}
        showBrowseButton={true}
        onBrowseClick={() => setFilePopup("referenceMask")}
      />
    </div>
  );
};

export default Io;
