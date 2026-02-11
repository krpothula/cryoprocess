import React from 'react'
import CustomDropdown from '../../common/Dropdown';

const Ctf = ({formData,handleInputChange,dropdownOptions}) => {
   

  return (
    <div className="tab-content">
       <CustomDropdown
        label="Do CTF-correction?"
        options={dropdownOptions}
        value={formData.ctfCorrection}
        name="ctfCorrection"
        onChange={handleInputChange}
        tooltipText="Apply CTF correction during refinement. Essential for high-resolution reconstruction. Only disable for testing purposes."
      />
       <CustomDropdown
        label="Ignore CTFs until first peak?"
        options={dropdownOptions}
        value={formData.igonreCtf}
        name="igonreCtf"
        onChange={handleInputChange}
        tooltipText="Ignore CTF until the first peak. May help with extremely defocused images. Generally leave as 'No' for standard processing."
      />
   
  </div>
  )
}

export default Ctf
