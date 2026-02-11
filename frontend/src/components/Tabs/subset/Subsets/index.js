import React from 'react'
import CustomDropdown from '../../common/Dropdown'
import PixelSizeInput from '../../common/PixelSixeInput'
import SimpleInput from '../../common/SimpleInput'

const Subsets = ({handleInputChange, dropdownOptions,formData,handleRangeChange}) => {
  const isEnabled = formData.metaDataValues === "Yes"; 
  const isEnabled1 = formData.imageStatics === "Yes"; 
  const isEnabled2 = formData.split === "Yes"; 
  return (
    <div className="tab-content">
      
    <CustomDropdown label="Select based on metadata values?"
     options={dropdownOptions}
     value={formData.metaDataValues}
     name="metaDataValues"
     onChange={handleInputChange}
     tooltipText="Select particles based on metadata values (e.g., defocus, resolution, beam tilt). Enable to filter particles by specific STAR file column values."
   />
      <SimpleInput
              label='Metadata label for subset selection:'
              placeholder='rlnCTfMaxResolution'
              name="metaDataLabel"
              value={formData.metaDataLabel}
              disabled = {!isEnabled}
              onChange={handleInputChange}
             
            />
            <SimpleInput
              label='Minimum metadata value:'
              placeholder='-9999.'
              name="minMetaData"
              value={formData.minMetaData}
              disabled = {!isEnabled}
              onChange={handleInputChange}
             
            />
            <SimpleInput
              label='Maximum metadata value:'
              placeholder='9999'
              name="maxMetaData"
              value={formData.maxMetaData}
              disabled = {!isEnabled}
              onChange={handleInputChange}
             
            />
              <CustomDropdown label="OR: select on image statistics?"
     options={dropdownOptions}
     value={formData.imageStatics}
     name="imageStatics"
     onChange={handleInputChange}
     tooltipText="Select particles based on image statistics (mean, standard deviation). Useful for removing outlier particles with unusual intensity values."
   />
      <SimpleInput
              label='Metadata label for images:'
              placeholder='rlnImageName'
              name="metaDataForImage"
              value={formData.metaDataForImage}
              disabled = {!isEnabled1}
              onChange={handleInputChange}
             
            />
      <PixelSizeInput
              label="Sigma-value for discarding images:"
              placeholder=""
              min={1}
              max={10}
              value={formData.SigmaValue}
              name='SigmaValue'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Number of standard deviations from the mean for outlier removal. Particles outside this range are excluded. Default 4 keeps most particles."
              disabled={!isEnabled1}
            />
                <CustomDropdown label="OR: split into subsets?"
     options={dropdownOptions}
     value={formData.split}
     name="split"
     onChange={handleInputChange}
     tooltipText="Split particles into random subsets. Useful for independent validation or creating training/test sets."
   />
      <CustomDropdown label="Randomise order before making subsets?"
     options={dropdownOptions}
     value={formData.randomise}
     name="randomise"
     onChange={handleInputChange}
     tooltipText="Randomize the order of particles before splitting into subsets. Recommended when splitting to avoid systematic bias."
     disabled={!isEnabled2}
   />
    <PixelSizeInput
              label="Subset size:"
              placeholder=""
              min={100}
              max={1000}
              value={formData.subsetSize}
              name='subsetSize'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Number of particles per subset when splitting. Use -1 to split evenly based on the number of subsets."
              disabled={!isEnabled2}
            />
         <PixelSizeInput
              label="OR: number of subsets:"
              placeholder=""
              min={-1}
              max={10}
              value={formData.numberSubsets}
              name='numberSubsets'
              onChange={handleRangeChange}
              handleInputChange={handleInputChange}
              tooltipText="Number of subsets to create. Use -1 to calculate from subset size. Use 2 for half-set validation."
              disabled={!isEnabled2}
            />
    </div>
  )
}

export default Subsets
