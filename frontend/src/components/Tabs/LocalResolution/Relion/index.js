import React from 'react'

import PixelSizeInput from '../../common/PixelSizeInput'
import CustomInput from '../../common/Input'

const Relion = ({handleRangeChange, handleInputChange, formData}) => {
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="User-provided B-factor:"
        placeholder=""
        min={-1000}
        max={0}
        value={formData.bFactor}
        name='bFactor'
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="B-factor for local resolution calculation. Use the value from Post-Processing (negative number). Affects the local resolution estimates."
      />
      <CustomInput
        onChange={handleInputChange}
        name="mtfDetector"
        placeholder=""
        tooltipText="MTF file for your detector. Same file used in Post-Processing. Corrects for detector response in resolution calculation."
        label="MTF of the detector (STAR file):"
      />
    </div>
  )
}

export default Relion
