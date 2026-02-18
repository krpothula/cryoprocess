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
}) => {
  const isEnable = formData.useAutopickThreshold === "Yes";
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="CtfFind"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputMicrographs", value: val } });
        }}
        name="inputMicrographs"
        label="Input micrographs:"
        placeholder="Select micrographs_ctf.star from CTF"
        tooltipText="Select micrographs with CTF information from CTF Estimation job."
        value={formData?.["inputMicrographs"]}
      />
      <CustomDropdown
        label="Pick start-end coordinates helices?"
        options={dropdownOptions}
        value={formData.pickCoordinatesHelices}
        name="pickCoordinatesHelices"
        onChange={handleInputChange}
        tooltipText="Pick helical segments instead of single particles. Enable for filamentous samples like microtubules or actin."
      />
      <CustomDropdown
        label="Use autopick FOM threshold?"
        options={dropdownOptions}
        value={formData.useAutopickThreshold}
        name="useAutopickThreshold"
        onChange={handleInputChange}
        tooltipText="Filter displayed picks by autopicker Figure-of-Merit (FOM) score. Only show picks above the specified threshold."
      />
      <PixelSizeInput
        label="Minimum autopick FOM:"
        placeholder=""
        min={0}
        max={10}
        value={formData.autopickFOM}
        name="autopickFOM"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum autopicker FOM score for displayed picks. Higher values show only the most confident picks."
        disabled={!isEnable}
      />
    </div>
  );
};

export default Io;
