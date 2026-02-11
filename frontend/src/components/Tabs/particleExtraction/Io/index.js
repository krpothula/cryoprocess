import React from "react";
import CustomInput from "../../common/Input";
import CustomDropdown from "../../common/Dropdown";
import InputGroup from "../../common/InputGroup";

const Io = ({
  formData,
  handleInputChange,
  dropdownOptions,
  setFilePopup,
  jobType,
}) => {
  const isreExtractRefinedParticlesYes =
    formData.reExtractRefinedParticles === "Yes";

  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="CtfFind"
        onChange={(val = "") => {
          handleInputChange({
            target: { name: "micrographStarFile", value: val },
          });
        }}
        name="micrographStarFile"
        label="Micrograph STAR file:"
        placeholder="Select micrographs_ctf.star from CTF"
        tooltipText="Select micrographs with CTF information"
        value={formData?.["micrographStarFile"]}
      />
      <CustomInput
        stageStarFiles="AutoPick,Extract,ImportCoords"
        onChange={(val = "") => {
          handleInputChange({
            target: { name: "inputCoordinates", value: val },
          });
        }}
        name="inputCoordinates"
        label="Input coordinates:"
        placeholder="Select coordinates from AutoPick, Extract, or Import"
        tooltipText="Select coordinate files from AutoPick job, particles.star from Extract, or imported coordinates/particles from Import"
        value={formData?.["inputCoordinates"]}
      />
      <CustomDropdown
        label="OR Re-extract refined particles?"
        options={dropdownOptions}
        value={formData.reExtractRefinedParticles}
        name="reExtractRefinedParticles"
        onChange={handleInputChange}
        tooltipText="Re-extract particles using refined coordinates from 2D/3D classification or auto-refine. Useful for extracting at different box sizes or with updated particle positions."
      />
      <CustomInput
        stageStarFiles="Extract,Subset,ManualSelect,Class2D,Class3D,InitialModel,AutoRefine,CtfRefine,Polish,Subtract,JoinStar"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({
            target: { name: "refinedParticlesStarFile", value: val },
          });
        }}
        name="refinedParticlesStarFile"
        label="Refined particles STAR file:"
        placeholder="Select particles.star from Select (Manual/Subset), Class2D, Class3D, or Refine"
        tooltipText="Select particles from Select job (Select Classes or Subset Selection), 2D Classification, 3D Classification, or 3D Auto-Refine"
        value={formData?.["refinedParticlesStarFile"]}
        disabled={!isreExtractRefinedParticlesYes}
      />
      <CustomDropdown
        label="Reset the refined offset to Zero?"
        options={dropdownOptions}
        value={formData.resetRefinedOffsets}
        name="resetRefinedOffsets"
        onChange={handleInputChange}
        tooltipText="Reset particle offsets to zero when re-extracting. Use when you want to extract centered particles without applying the refined shifts from previous jobs."
        disabled={!isreExtractRefinedParticlesYes}
      />
      <CustomDropdown
        label="OR: re-center refined coordinates?"
        options={dropdownOptions}
        value={formData.reCenterRefinedCoordinates}
        name="reCenterRefinedCoordinates"
        onChange={handleInputChange}
        tooltipText="Apply refined offsets to coordinates and then reset offsets to zero. Particles will be extracted centered at their refined positions."
        disabled={!isreExtractRefinedParticlesYes}
      />
      <InputGroup
        label="Recenter on - X Y Z(PIX):"
        inputs={[
          { name: "xRec", value: formData.xRec },
          { name: "yRec", value: formData.yRec },
          { name: "zRec", value: formData.zRec },
        ]}
        onChange={handleInputChange}
        tooltipText="X, Y, Z coordinates (in pixels) to recenter particles on a specific feature within the particle. Useful for focusing on a subunit or domain."
        disabled={!isreExtractRefinedParticlesYes}
      />

      {/* <div className="label-box-container">
      <label style={{ font: "medium", fontSize: "16px" }}>Recenter on - X Y Z(PIX):</label>
      <input style={{ width: "167.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", marginLeft: "6px", height: "36px" }} type="number" name="patchesX" value={formData.patchesX} onChange={handleInputChange} />
      <input style={{ width: "167.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", height: "36px", margin: "5px" }} type="number" name="patchesX" value={formData.patchesX} onChange={handleInputChange} />
      <input style={{ width: "167.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", height: "36px" }} type="number" name="patchesY" value={formData.patchesY} onChange={handleInputChange} />
    </div> */}

      <CustomDropdown
        label="Write output in float 16?"
        options={dropdownOptions}
        value={formData.writeOutputInFloat16}
        name="writeOutputInFloat16"
        onChange={handleInputChange}
        tooltipText="Write extracted particles in 16-bit float format instead of 32-bit. Reduces disk space by half with minimal quality loss. Recommended for large datasets."
      />
    </div>
  );
};

export default Io;
