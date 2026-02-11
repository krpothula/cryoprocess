import React from "react";
import CustomDropdown from "../../common/Dropdown";

const Ctf = ({ formData, handleInputChange, dropdownOptions }) => {
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Do CTF correction:"
        options={dropdownOptions}
        value={formData.ctfCorrection}
        name="ctfCorrection"
        onChange={handleInputChange}
        tooltipText="Apply CTF correction during classification. Highly recommended for accurate results. Only disable for testing or special cases."
      />
      <CustomDropdown
        label="Ignore CTFs until first peak:"
        options={dropdownOptions}
        value={formData.ignoreCTFs}
        name="ignoreCTFs"
        onChange={handleInputChange}
        tooltipText="Ignore CTF until the first peak. Can help with very defocused images or problematic CTF fits. Generally leave as 'No' for standard processing."
        disabled={formData.ctfCorrection === "No"}
      />
    </div>
  );
};

export default Ctf;
