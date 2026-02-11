import React from 'react'
import CustomInput from '../../common/Input'
import CustomDropdown from '../../common/Dropdown'

const PARTICLE_STAGES = "Extract,Class2D,Subset,InitialModel,Class3D,AutoRefine,CtfRefine,Polish,ManualSelect,Subtract,JoinStar";

const Particles = ({
    handleInputChange,
    formData,
    handleRangeChange,
    dropdownOptions,
  }) => {
    const particleEnable = formData.combineParticles === "Yes";

    const makeStarOnChange = (fieldName) => (val = "") => {
      handleInputChange({ target: { name: fieldName, value: val } });
    };

  return (
    <div className="tab-content">
            <CustomDropdown
              label="Combine particle STAR files?"
              options={dropdownOptions}
              value={formData.combineParticles}
              name="combineParticles"
              onChange={handleInputChange}
              tooltipText="Enable combining particle STAR files from multiple jobs into a single file. Useful for merging particles from different processing runs."
            />

            <CustomInput
              stageStarFiles={PARTICLE_STAGES}
              stageRole="particlesStar"
              name="particlesStarFile1"
              label="Particle STAR file 1:"
              placeholder="Select particle STAR file"
              tooltipText="First particle STAR file to combine. Select from any particle-producing job."
              disabled={!particleEnable}
              onChange={makeStarOnChange("particlesStarFile1")}
              value={formData.particlesStarFile1}
            />
            <CustomInput
              stageStarFiles={PARTICLE_STAGES}
              stageRole="particlesStar"
              onChange={makeStarOnChange("particlesStarFile2")}
              name="particlesStarFile2"
              label="Particle STAR file 2:"
              placeholder="Select particle STAR file"
              tooltipText="Second particle STAR file to combine."
              disabled={!particleEnable}
              value={formData.particlesStarFile2}
            />
            <CustomInput
              stageStarFiles={PARTICLE_STAGES}
              stageRole="particlesStar"
              onChange={makeStarOnChange("particlesStarFile3")}
              name="particlesStarFile3"
              label="Particle STAR file 3:"
              placeholder="Select particle STAR file"
              tooltipText="Third particle STAR file to combine (optional)."
              disabled={!particleEnable}
              value={formData.particlesStarFile3}
            />
            <CustomInput
              stageStarFiles={PARTICLE_STAGES}
              stageRole="particlesStar"
              onChange={makeStarOnChange("particlesStarFile4")}
              name="particlesStarFile4"
              label="Particle STAR file 4:"
              placeholder="Select particle STAR file"
              tooltipText="Fourth particle STAR file to combine (optional)."
              disabled={!particleEnable}
              value={formData.particlesStarFile4}
            />
          </div>
  )
}

export default Particles
