import React from "react";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";

const Colors = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
}) => {
  const isblueRedColorParticlesYes = formData.blueRedColorParticles === "Yes";

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Blue <> Red Color Particles?"
        placeholder=""
        options={dropdownOptions}
        value={formData.blueRedColorParticles}
        name="blueRedColorParticles"
        onChange={handleInputChange}
        tooltipText="Color particles by metadata value using a blue-to-red gradient. Useful for visualizing defocus variation or other parameters across picks."
      />
      <SimpleInput
        label="MetaDataLabel for Color:"
        name="metadataLabel"
        value={formData.metadataLabelColor}
        onChange={handleInputChange}
        tooltipText="STAR file column name to use for coloring particles (e.g., rlnDefocusU, rlnAutopickFigureOfMerit)."
        disabled={!isblueRedColorParticlesYes}
      />
      {/* <CustomInput
        onChange={handleInputChange}
        name="starfileWithColorLabel"
        label="STAR file with color label:"
        placeholder=""
        tooltipText="starfileWithColorLabel"
        disabled={!isblueRedColorParticlesYes}
      /> */}
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("starfileWithColorLabel");
        }}
        name="starfileWithColorLabel"
        label="STAR file with color label:"
        placeholder=""
        tooltipText="STAR file containing the metadata label for coloring. Usually the same file as the input coordinates."
        value={formData?.["starfileWithColorLabel"]}
        disabled={!isblueRedColorParticlesYes}
      />
      <PixelSizeInput
        label="Blue Value:"
        placeholder=""
        min={0}
        max={10}
        value={formData.blueValue}
        name="blueValue"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Metadata value mapped to blue (low end of the color scale)."
        disabled={!isblueRedColorParticlesYes}
      />
      <PixelSizeInput
        label="Red Value:"
        placeholder=""
        min={0}
        max={10}
        value={formData.redValue}
        name="redValue"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Metadata value mapped to red (high end of the color scale)."
        disabled={!isblueRedColorParticlesYes}
      />
    </div>
  );
};

export default Colors;
