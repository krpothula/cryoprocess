import React from "react";
import CustomDropdown from "../../common/Dropdown";

const Ctf = ({ formData, handleInputChange, dropdownOptions }) => {
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Do CTF-correction?"
        options={dropdownOptions}
        value={formData.ctfCorrection}
        name="ctfCorrection"
        onChange={handleInputChange}
        tooltipText="Apply CTF correction during initial model generation. Highly recommended for accurate ab-initio reconstruction."
      />
      <CustomDropdown
        label="Ignore CTFs until first peak?"
        options={dropdownOptions}
        value={formData.igonreCtf}
        name="igonreCtf"
        onChange={handleInputChange}
        tooltipText="Ignore CTF until the first peak. May help with very defocused data or problematic CTF estimates. Generally leave as 'No'."
        disabled={formData.ctfCorrection === "No"}
      />
    </div>
  );
};

export default Ctf;
