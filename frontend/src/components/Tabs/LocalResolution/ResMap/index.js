import React from 'react'
import CustomDropdown from '../../common/Dropdown'
import CustomInput from '../../common/Input'
import PixelSizeInput from '../../common/PixelSizeInput'

const ResMap = ({formData,handleInputChange,dropdownOptions,handleRangeChange}) => {
  return (
    <div className="tab-content">
         <CustomDropdown label="Use ResMap?"
           options={dropdownOptions}
           value={formData.useResMap}
           name="useResMap"
           onChange={handleInputChange}
           tooltipText="Use ResMap for local resolution estimation instead of RELION's built-in method. ResMap must be installed separately."
         />
           <CustomInput
           label='ResMap executable:'
           placeholder='/ResMap/ResMap-1.1.4-linux64'
           name="resMapExecutable"
          
           onChange={handleInputChange}
          tooltipText="Path to the ResMap executable. Leave empty to use the default system path."
         />
    <PixelSizeInput
           label="P-value:"
           placeholder=""
           min={0}
           max={1}
           value={formData.pValue}
           name='pValue'
           onChange={handleRangeChange}
           handleInputChange={handleInputChange}
           tooltipText="Statistical significance level for ResMap. Default 0.05. Lower values are more conservative."
         />
           <PixelSizeInput
           label="Highest resolution (A):"
           placeholder=""
           min={0}
           max={5}
           value={formData.highestResolution}
           name='highestResolution'
           onChange={handleRangeChange}
           handleInputChange={handleInputChange}
           tooltipText="Highest resolution (Angstroms) to test. Set to 0 for automatic detection based on the FSC."
         />
       
          <PixelSizeInput
           label="Lowest resolution (A):"
           placeholder=""
           min={0}
           max={5}
           value={formData.lowestResolution}
           name='lowestResolution'
           onChange={handleRangeChange}
           handleInputChange={handleInputChange}
           tooltipText="Lowest resolution (Angstroms) to test. Set to 0 for automatic detection."
         />
           <PixelSizeInput
           label="Resolution step size (A):"
           placeholder=""
           min={0}
           max={5}
           value={formData.resolutionStepSize}
           name='resolutionStepSize'
           onChange={handleRangeChange}
           handleInputChange={handleInputChange}
           tooltipText="Resolution step size (Angstroms) between tested resolutions. Smaller steps give finer resolution maps but take longer."
         />

</div>
  )
}

export default ResMap
