import React from 'react'
import CustomDropdown from '../../common/Dropdown'
import PixelSizeInput from '../../common/PixelSizeInput'

const Duplicates = ({handleInputChange, dropdownOptions,formData,handleRangeChange}) => {
  const isEnabled1 = formData.removeDuplicates === "Yes"; 
  return (
    <div className="tab-content">
      
    <CustomDropdown label="OR: remove duplicates?"
     options={dropdownOptions}
     value={formData.removeDuplicates}
     name="removeDuplicates"
     onChange={handleInputChange}
     tooltipText="Remove duplicate particles that appear on overlapping micrograph areas. Recommended when combining data from multiple sessions."
   />
      <PixelSizeInput
              label="Minimum inter-particle distance (A)"
              placeholder=""
              min={10}
              max={1000}
              value={formData.minParticleDistance}
              name='minParticleDistance'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Minimum distance (in Angstroms) between particles. Particles closer than this are considered duplicates and one will be removed."
              disabled={!isEnabled1}
            />
         <PixelSizeInput
              label="Pixel size before extraction (A)"
              placeholder=""
              min={-1}
              max={10}
              value={formData.pixelSizeExtraction}
              name='pixelSizeExtraction'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Pixel size used during extraction (in Angstroms). Set to -1 to read from the STAR file header. Only needed if pixel size information is missing."
              disabled={!isEnabled1}
            />
           
    </div>
  )
}

export default Duplicates
