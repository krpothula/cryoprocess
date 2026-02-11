import React from 'react'
import PixelSizeInput from '../../common/PixelSixeInput'
import CustomDropdown from '../../common/Dropdown'

const Display = ({handleInputChange,formData,handleRangeChange,dropdownOptions}) => {
  return (
    <div className="tab-content">
            <PixelSizeInput
              label="Particle Diameter (A):"
              placeholder=""
              min={0}
              max={1000}
              value={formData.particleDiameter}
              name='particleDiameter'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Expected particle diameter in Angstroms. Used to draw circles around picked particles in the micrograph viewer."
            />
            <PixelSizeInput
              label="Scale for Micrographs:"
              placeholder=""
              min={0}
              max={5}
              value={formData.scaleForMicrographs}
              name='scaleForMicrographs'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Scale factor for micrograph display. Smaller values show more of the micrograph at lower resolution. Use 0.3-0.5 for large micrographs."
            />
            <PixelSizeInput
              label="Sigma Contrast:"
              placeholder=""
              min={1}
              max={10}
              value={formData.sigmaContrast}
              name='sigmaContrast'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Contrast sigma for micrograph display. Higher values increase contrast. Default 3 works well for most cryo-EM data."
            />
            <PixelSizeInput
              label="White Value:"
              placeholder=""
              min={0}
              max={50}
              value={formData.whiteValue}
              name='whiteValue'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Maximum display value (white point). Pixels above this value appear white. Use 0 for automatic scaling."
            />
            <PixelSizeInput
              label="Black Value:"
              placeholder=""
              min={0}
              max={50}
              value={formData.blackValue}
              name='blackValue'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Minimum display value (black point). Pixels below this value appear black. Use 0 for automatic scaling."
            />
            <PixelSizeInput
              label="Lowpass Filter (A):"
              placeholder=""
              min={0}
              max={50}
              value={formData.lowpassFilter}
              name='lowpassFilter'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Low-pass filter resolution (in Angstroms) for display. Smooths the image. Use 20-30 to see particles more clearly during picking."
            />
            <PixelSizeInput
              label="Highpass Filter (A):"
              placeholder=""
              min={-1}
              max={50}
              value={formData.highpassFilter}
              name='highpassFilter'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="High-pass filter resolution (in Angstroms) for display. Removes low-frequency gradients. Use -1 to disable."
            />
            <PixelSizeInput
              label="Pixel Size (A):"
              placeholder=""
              min={-1}
              max={50}
              value={formData.pixelSize}
              name='pixelSize'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Pixel size in Angstroms. Usually read from the STAR file automatically. Override only if the value is incorrect."
            />
            <CustomDropdown
              label="OR:Use Topaz Denoising?"
              placeholder=""
              options={dropdownOptions}
              value={formData.useTopaz}
              name='useTopaz'
              onChange={handleInputChange}
              tooltipText="Use Topaz for deep learning-based particle picking instead of manual picking."
            />



          </div>
  )
}

export default Display
