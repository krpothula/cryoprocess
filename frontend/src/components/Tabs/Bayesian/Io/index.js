import React from 'react'
import CustomInput from '../../common/Input'
import PixelSizeInput from '../../common/PixelSizeInput'
import CustomDropdown from '../../common/Dropdown'

const Io = ({handleInputChange, formData, handleRangeChange, dropdownOptions, jobType}) => {

  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="MotionCorr"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "micrographsFile", value: val } });
        }}
        name="micrographsFile"
        label="Micrographs (from MotionCorr):"
        placeholder="Select corrected_micrographs.star from Motion Correction"
        tooltipText="Select corrected_micrographs.star from Motion Correction. Must be from the same job that produced your original particle stacks."
        value={formData?.["micrographsFile"]}
        jobType={jobType}
      />
      <CustomInput
        stageStarFiles="AutoRefine,CtfRefine"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "particlesFile", value: val } });
        }}
        name="particlesFile"
        label="Particles (from Refine3D or CtfRefine):"
        placeholder="Select particles from Auto-Refine or CTF Refinement"
        tooltipText="Select _data.star from Auto-Refine or CTF Refinement. Particles need accurate orientations for polishing to improve resolution."
        value={formData?.["particlesFile"]}
        jobType={jobType}
      />
      <CustomInput
        stageStarFiles="PostProcess"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "postProcessStarFile", value: val } });
        }}
        name="postProcessStarFile"
        label="Postprocess STAR file:"
        placeholder="Select postprocess.star from Post-Processing"
        tooltipText="Select postprocess.star from Post-Processing. Used for FSC-weighting during polishing optimization."
        value={formData?.["postProcessStarFile"]}
        jobType={jobType}
      />
      <PixelSizeInput
        label="First movie frame:"
        placeholder=""
        min={0}
        max={50}
        value={formData.firstMovieFrame}
        name="firstMovieFrame"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="First frame to include from movies. Usually 1 to start from beginning. Skip early frames only if they show excessive beam-induced motion."
      />
      <PixelSizeInput
        label="Last movie frame:"
        placeholder=""
        min={-1}
        max={200}
        value={formData.lastMovieFrame}
        name="lastMovieFrame"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Last frame to include. Set to -1 to use all frames, or specify a frame number to exclude later damaged frames."
      />
      <PixelSizeInput
        label="Extraction size (pix in unbinned movie):"
        placeholder=""
        min={-1}
        max={1024}
        value={formData.extractionSize}
        name="extractionSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Box size for extraction from unbinned movies. Set to -1 for auto-detect. Should be larger than your particle to capture surrounding motion information."
        step={2}
      />
      <PixelSizeInput
        label="Re-scaled size (pixels):"
        placeholder=""
        min={-1}
        max={1024}
        value={formData.rescaledSize}
        name="rescaledSize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Final box size after rescaling. Set to -1 to keep original size. Use smaller values to reduce file sizes for initial testing."
        step={2}
      />
      <CustomDropdown
        label="Write output in float16?"
        name="float16"
        value={formData.float16}
        onChange={handleInputChange}
        tooltipText="Write particles in 16-bit float format to save disk space. Recommended for large datasets with minimal quality loss."
        options={dropdownOptions}
      />
    </div>
  )
}

export default Io
