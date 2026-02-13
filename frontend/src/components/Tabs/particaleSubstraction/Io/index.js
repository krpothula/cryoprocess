import React from 'react'
import CustomInput from '../../common/Input'
import CustomDropdown from '../../common/Dropdown'

const Io = ({handleInputChange, formData, handleRangeChange, dropdownOptions, jobType}) => {
  const isEnable = formData.differentParticles === "Yes";
  const isEnable1 = formData.revertToOriginal === "Yes";
  return (
    <div className="grid py-5 tab-content">
      <CustomInput
        stageOptimiserFiles="AutoRefine,Class3D"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "optimiserStar", value: val } });
        }}
        name="optimiserStar"
        label="Input optimiser star:"
        placeholder="Select optimiser.star from Auto-Refine or 3D Classification"
        tooltipText="Select optimiser STAR file from refinement"
        value={formData?.["optimiserStar"]}
        jobType={jobType}
      />
      <CustomInput
        stageMrcFiles="MaskCreate"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "maskOfSignal", value: val } });
        }}
        name="maskOfSignal"
        label="Mask of the signal to keep:"
        placeholder="Select mask from Mask Creation"
        tooltipText="Select mask defining the signal to keep"
        value={formData?.["maskOfSignal"]}
        jobType={jobType}
      />
      <CustomDropdown
        label="Use different particles"
        options={dropdownOptions}
        value={formData.differentParticles}
        name="differentParticles"
        onChange={handleInputChange}
        tooltipText="Use a different particle set than the one used in refinement. Enable to subtract using particles from a separate extraction or selection."
      />
      <CustomInput
        stageStarFiles="AutoRefine,Class3D,Extract"
        stageRole="particlesStar"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputParticlesStar", value: val } });
        }}
        name="inputParticlesStar"
        label="Input particle star file"
        placeholder="Select particles STAR file"
        tooltipText="Select particles STAR file"
        value={formData?.["inputParticlesStar"]}
        disabled={!isEnable}
        jobType={jobType}
      />
      <CustomDropdown
        label="Write output in float 16?"
        options={dropdownOptions}
        value={formData.outputInFloat16}
        name="outputInFloat16"
        onChange={handleInputChange}
        tooltipText="Write output particles in 16-bit float format. Saves disk space with minimal quality loss. Recommended for large datasets."
      />
      <CustomDropdown
        label="OR: revert to original particles?"
        options={dropdownOptions}
        value={formData.revertToOriginal}
        name="revertToOriginal"
        onChange={handleInputChange}
        tooltipText="Revert previously subtracted particles back to their original (unsubtracted) state."
      />
      <CustomInput
        stageStarFiles="Subtract"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "revertParticles", value: val } });
        }}
        name="revertParticles"
        label="Revert this particle star file:"
        placeholder="Select subtracted particles to revert"
        tooltipText="Select subtracted particles STAR file to revert"
        value={formData?.["revertParticles"]}
        disabled={!isEnable1}
        jobType={jobType}
      />
    </div>
  )
}

export default Io
