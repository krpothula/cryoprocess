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
        tooltipText="Apply CTF correction during classification. Essential for accurate 3D reconstruction. Only disable for special testing purposes."
      />
      <CustomDropdown
        label="Ignore CTFs until first peak?"
        options={dropdownOptions}
        value={formData.ignoreCTFs}
        name="ignoreCTFs"
        onChange={handleInputChange}
        tooltipText="Ignore CTF until the first peak. May help with extremely defocused images or problematic CTF fits. Generally leave as 'No'."
        disabled={formData.ctfCorrection === "No"}
      />
    </div>
  );
};

export default Ctf;
