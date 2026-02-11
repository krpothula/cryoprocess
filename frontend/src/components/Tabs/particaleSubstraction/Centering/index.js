import React from 'react'
import PixelSizeInput from '../../common/PixelSixeInput'
import InputGroup from '../../common/InputGroup'
import CustomDropdown from '../../common/Dropdown'

const Centering = ({handleInputChange,formData,handleRangeChange,dropdownOptions}) => {
    const isEnable2 = formData.imagesOnMask === "Yes";
  return (
    <div className="grid py-5 tab-content">
    <CustomDropdown
      label="Do center subbtracted images on mask?"
      options={dropdownOptions}
      value={formData.subtracted_images}
      name="subtracted_images"
      onChange={handleInputChange}
      tooltipText="Do centering and reboxing of subtracted particles. Enable to re-center particles on the remaining signal after subtraction."
    />
    <CustomDropdown
      label="Do center on my coordinates?"
      options={dropdownOptions}
      value={formData.centerCoordinates}
      name="centerCoordinates"
      onChange={handleInputChange}
      tooltipText="Re-center particles at a new position. Useful when the signal of interest is offset from the original particle center."
      disabled={!isEnable2}
    />
    <InputGroup
      label="Center coordinate - X Y Z (pix):"
      inputs={[
        {
          name: "coordinateX",
          value: formData.coordinateX,
        },
        {
          name: "coordinateY",
          value: formData.coordinateY,
        },
        {
          name: "coordinateZ",
          value: formData.coordinateZ,
        },
      ]}
      onChange={handleInputChange}
      tooltipText="X, Y, Z coordinates (in pixels) to re-center subtracted particles on. Set relative to the original particle center."
      disabled={!isEnable2}
    />

    <PixelSizeInput
      label="New box size:"
      placeholder=""
      min={0}
      max={50}
      value={formData.newBoxSize}
      name="newBoxSize"
      onChange={handleRangeChange}
      handleInputChange={handleInputChange}
      tooltipText="New box size (pixels) for re-extracted particles. Use a smaller box to focus on the region of interest and reduce computation."
    />
  </div>
  )
}

export default Centering
