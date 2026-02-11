import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";

const Tasks = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <CustomInput
        stageStarFiles="Dynamight"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "checkpointFile", value: val } });
        }}
        name="checkpointFile"
        label="Checkpoint file:"
        placeholder="Select checkpoint from previous DynaMight job"
        tooltipText="Select a checkpoint file from a previous DynaMight job to continue from."
        value={formData?.["checkpointFile"]}
      />

      <CustomDropdown
        label="Do visualization?"
        options={dropdownOptions}
        value={formData.doVisulization}
        name="doVisulization"
        onChange={handleInputChange}
        tooltipText="Generate visualization of the flexibility analysis results."
      />

      <PixelSizeInput
        label="Half-set to visualize:"
        placeholder=""
        min={1}
        max={2}
        value={formData.halfSetToVisualize}
        name="halfSetToVisualize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Which half-set to use for visualization (1 or 2)."
      />

      <CustomDropdown
        label="Do inverse-deformation estimation?"
        options={dropdownOptions}
        value={formData.inverseDeformation}
        name="inverseDeformation"
        onChange={handleInputChange}
        tooltipText="Estimate inverse deformations for generating deformed maps."
      />

      <PixelSizeInput
        label="Number of epochs to perform:"
        placeholder=""
        min={1}
        max={1000}
        value={formData.numEpochs}
        name="numEpochs"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of training epochs. More epochs may improve results but take longer."
      />

      <CustomDropdown
        label="Store deformations in RAM?"
        options={dropdownOptions}
        value={formData.storeDeformations}
        name="storeDeformations"
        onChange={handleInputChange}
        tooltipText="Keep deformation fields in memory for faster processing. Requires more RAM."
      />

      <CustomDropdown
        label="Do deformed backprojection?"
        options={dropdownOptions}
        value={formData.deformedBackProjection}
        name="deformedBackProjection"
        onChange={handleInputChange}
        tooltipText="Perform backprojection using estimated deformations to reconstruct flexibility-corrected maps."
      />

      <PixelSizeInput
        label="Backprojection batchsize:"
        placeholder=""
        min={1}
        max={1000}
        value={formData.backprojBatchsize}
        name="backprojBatchsize"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Batch size for deformed backprojection. Larger values use more GPU memory but are faster."
      />
    </div>
  );
};

export default Tasks;
