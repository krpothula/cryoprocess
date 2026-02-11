import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSixeInput";
import SimpleInput from "../../common/SimpleInput";

const Compute = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
}) => {
  const isEnable = formData.gpuAcceleration === "Yes";
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Use parallel disc I/O?"
        options={dropdownOptions}
        value={formData.useParallelIO}
        name="useParallelIO"
        onChange={handleInputChange}
        tooltipText="Use multiple threads for reading/writing particles to disk. Speeds up I/O on systems with fast storage (SSD/NVMe). Disable for slow network filesystems."
      />
      <PixelSizeInput
        label="Number of pooled particles:"
        placeholder=""
        min={0}
        max={50}
        value={formData.pooledParticles}
        name="pooledParticles"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Process this many particles together per thread. Higher values improve CPU cache efficiency but use more memory. Default 3 is good for most cases."
      />
      <CustomDropdown
        label="Pre read all particles into RAM?"
        options={dropdownOptions}
        value={formData.preReadAllParticles}
        name="preReadAllParticles"
        onChange={handleInputChange}
        tooltipText="Load all particle images into memory before processing. Faster but requires enough RAM to hold the entire dataset. Recommended for small-medium datasets."
      />

      <SimpleInput
        label="Copy particles to scratch directory?"
        placeholder=""
        name="copyParticlesToScratch"
        value={formData.copyParticlesToScratch}
        onChange={handleInputChange}
        tooltipText="Path to fast local storage (e.g., /scratch). Particles are copied here before processing for faster I/O. Leave empty to read from original location."
        disabled={formData.preReadAllParticles === "Yes"}
      />
      <CustomDropdown
        label="Combine iteration through disc?"
        options={dropdownOptions}
        value={formData.combineIterations}
        name="combineIterations"
        onChange={handleInputChange}
        tooltipText="Write intermediate results to disk when combining data from multiple MPI processes. Use Yes when RAM is limited, No for faster processing with sufficient memory."
      />
      <CustomDropdown
        label="Use GPU acceleration?"
        options={dropdownOptions}
        value={formData.gpuAcceleration}
        name="gpuAcceleration"
        onChange={handleInputChange}
        tooltipText="Use GPU for significantly faster processing. Requires CUDA-capable NVIDIA GPU. Highly recommended when available."
      />

      <SimpleInput
        label="Which GPUs to use?"
        placeholder=""
        name="useGPU"
        value={formData.useGPU}
        onChange={handleInputChange}
        tooltipText="Comma-separated GPU device IDs (e.g., '0', '0,1'). Leave empty to use all available GPUs. Each MPI process uses one GPU."
        disabled={!isEnable}
      />
    </div>
  );
};

export default Compute;
