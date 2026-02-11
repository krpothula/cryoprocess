import React from 'react'
import CustomInput from '../../common/Input'
import PixelSizeInput from '../../common/PixelSixeInput'

const Io = ({formData, handleRangeChange, handleInputChange, jobType}) => {

  return (
    <div className="tab-content">
      <CustomInput
        stageMrcFiles="AutoRefine,Class3D,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "halfMap", value: val } });
        }}
        name="halfMap"
        placeholder="Select half-map from Auto-Refine or 3D Classification"
        tooltipText="Select ONE of the two unfiltered half-maps (*_half1_class001_unfil.mrc) from Auto-Refine. RELION will automatically find the second half-map."
        label="One of the 2 unfiltered half-maps:"
        value={formData?.["halfMap"]}
        jobType={jobType}
      />
      <CustomInput
        stageMrcFiles="MaskCreate,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "solventMask", value: val } });
        }}
        name="solventMask"
        placeholder="Select mask from Mask Creation"
        tooltipText="Solvent mask covering your protein density. Required for correct FSC calculation and B-factor estimation. Create one with Mask Creation job first."
        label="Solvent mask:"
        value={formData?.["solventMask"]}
        jobType={jobType}
      />
      <PixelSizeInput
        label="Calibrated pixel size (A):"
        placeholder=""
        min={-1}
        max={10}
        value={formData.calibratedPixelSize}
        name='calibratedPixelSize'
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Calibrated pixel size for your data. Set to -1 to use pixel size from header. Accurate pixel size is important for correct resolution reporting."
      />

  </div>
  )
}

export default Io
