import React from 'react'
import CustomDropdown from '../../common/Dropdown'
import PixelSizeInput from '../../common/PixelSizeInput'

const ClassOption = ({handleInputChange, dropdownOptions,formData,handleRangeChange}) => {
  const isEnabled = formData.select2DClass === "Yes"; 
  const isEnabled1 = formData.regroupParticles === "Yes"; 
  return (
    <div className="tab-content">
      
    <CustomDropdown label="Automatically select 2D classes?"
     options={dropdownOptions}
     value={formData.select2DClass}
     name="select2DClass"
     onChange={handleInputChange}
     tooltipText="Automatically select 2D class averages based on a score threshold. Useful for high-throughput processing without manual class selection."
   />
      <PixelSizeInput
              label="Minimum threshold for auto-selection:"
              placeholder=""
              min={0}
              max={2}
              value={formData.minThresholdAutoSelect}
              name='minThresholdAutoSelect'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Minimum class score threshold for automatic selection. Classes with scores below this will be excluded. Higher values are more selective."
              disabled={!isEnabled}
            />
         <PixelSizeInput
              label="Select at least this many particles:"
              placeholder=""
              min={-1}
              max={2}
              value={formData.manyParticles}
              name='manyParticles'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Minimum number of particles to select regardless of threshold. Set to -1 to disable. Ensures a minimum dataset size for downstream processing."
              disabled={!isEnabled}
            />
              <PixelSizeInput
              label="OR: select at least this many classes:"
              placeholder=""
              min={-1}
              max={2}
              value={formData.manyClasses}
              name='manyClasses'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Minimum number of classes to select regardless of threshold. Set to -1 to disable. Use as an alternative to particle-based selection."
              disabled={!isEnabled}
            />
       <CustomDropdown label="Re-center the class averages?"
     options={dropdownOptions}
     value={formData.classAverages}
     name="classAverages"
     onChange={handleInputChange}
     tooltipText="Re-center class averages based on their center of mass. Helps correct off-center classes before further processing."
   />
       
       <CustomDropdown label="Regroup the particles?"
     options={dropdownOptions}
     value={formData.regroupParticles}
     name="regroupParticles"
     onChange={handleInputChange}
     tooltipText="Regroup particles into new micrograph groups with similar defocus values. Improves CTF refinement by ensuring sufficient particles per group."
   />
     <PixelSizeInput
              label="Approximate nr of groups:"
              placeholder=""
              min={0}
              max={1}
              value={formData.approxNr}
              name='approxNr'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Approximate number of micrograph groups to regroup into. RELION will distribute particles into roughly this many groups based on defocus similarity."
              disabled={!isEnabled1}
            />
    </div>
  )
}

export default ClassOption
