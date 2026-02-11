import React from 'react'
import CustomInput from '../../common/Input'

const Io = ({handleInputChange, formData, handleRangeChange, dropdownOptions, jobType}) => {

  return (
    <div className="tab-content">
      <CustomInput
        stageMrcFiles="AutoRefine,Class3D,InitialModel,Import"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputMap", value: val } });
        }}
        name="inputMap"
        label="Input 3D map:"
        placeholder="Select map from Auto-Refine, 3D Classification, or Initial Model"
        tooltipText="Select a 3D map (from Auto-Refine, 3D Classification, or Initial Model) to create a mask from. The map should be well-resolved and low-pass filtered."
        value={formData?.["inputMap"]}
        jobType={jobType}
      />
    </div>
  )
}

export default Io
