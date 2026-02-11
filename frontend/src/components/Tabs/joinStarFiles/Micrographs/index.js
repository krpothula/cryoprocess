import React from 'react'
import CustomInput from '../../common/Input'
import CustomDropdown from '../../common/Dropdown'

const MICROGRAPH_STAGES = "CtfFind,MotionCorr,Import";

const Micrographs = ({
    handleInputChange,
    formData,
    handleRangeChange,
    dropdownOptions,
  }) => {
    const micrographEnable = formData.combineMicrographs === "Yes";

    const makeStarOnChange = (fieldName) => (val = "") => {
      handleInputChange({ target: { name: fieldName, value: val } });
    };

  return (
    <div className="tab-content">
            <CustomDropdown
              label="Combine micrograph STAR files?"
              options={dropdownOptions}
              value={formData.combineMicrographs}
              name="combineMicrographs"
              onChange={handleInputChange}
              tooltipText="Enable combining micrograph STAR files from multiple jobs into a single file. Useful when merging data from different sessions or subsets."
            />

            <CustomInput
              stageStarFiles={MICROGRAPH_STAGES}
              name="micrographStarFile1"
              label="Micrograph STAR file 1:"
              placeholder="Select micrograph STAR file"
              tooltipText="First micrograph STAR file to combine. Select from CTF Estimation, Motion Correction, or Import jobs."
              disabled={!micrographEnable}
              onChange={makeStarOnChange("micrographStarFile1")}
              value={formData.micrographStarFile1}
            />
            <CustomInput
              stageStarFiles={MICROGRAPH_STAGES}
              onChange={makeStarOnChange("micrographStarFile2")}
              name="micrographStarFile2"
              label="Micrograph STAR file 2:"
              placeholder="Select micrograph STAR file"
              tooltipText="Second micrograph STAR file to combine."
              disabled={!micrographEnable}
              value={formData.micrographStarFile2}
            />
            <CustomInput
              stageStarFiles={MICROGRAPH_STAGES}
              onChange={makeStarOnChange("micrographStarFile3")}
              name="micrographStarFile3"
              label="Micrograph STAR file 3:"
              placeholder="Select micrograph STAR file"
              tooltipText="Third micrograph STAR file to combine (optional)."
              disabled={!micrographEnable}
              value={formData.micrographStarFile3}
            />
            <CustomInput
              stageStarFiles={MICROGRAPH_STAGES}
              onChange={makeStarOnChange("micrographStarFile4")}
              name="micrographStarFile4"
              label="Micrograph STAR file 4:"
              placeholder="Select micrograph STAR file"
              tooltipText="Fourth micrograph STAR file to combine (optional)."
              disabled={!micrographEnable}
              value={formData.micrographStarFile4}
            />
          </div>
  )
}

export default Micrographs
