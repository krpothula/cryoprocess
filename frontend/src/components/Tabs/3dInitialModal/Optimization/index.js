import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSixeInput";
import SimpleInput from "../../common/SimpleInput";

const Optimization = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
  particleMetadata,
}) => {
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Number of VDAM mini-batches:"
        placeholder=""
        min={1}
        max={1000}
        value={formData.numberOfVdam}
        name="numberOfVdam"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of VDAM mini-batches for SGD optimization. More mini-batches = longer but potentially better convergence. 200-500 typical."
      />

      <PixelSizeInput
        label="Regularisation parameter T:"
        placeholder=""
        min={1}
        max={10}
        value={formData.regularisationParameter}
        name="regularisationParameter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Regularisation parameter T controls smoothness. Higher T (3-4) for noisy data or small particles. Lower T (1-2) for larger, well-defined particles."
      />
      <PixelSizeInput
        label="Number of classes:"
        placeholder=""
        min={1}
        max={50}
        value={formData.numberOfClasses}
        name="numberOfClasses"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of 3D classes/models to generate. Use 1 for homogeneous samples. Use 2-4 for heterogeneous samples to separate different conformations."
      />

      <div className="mask-diameter-wrapper" style={{ position: 'relative' }}>
        <PixelSizeInput
          label="Mask diameter (A):"
          placeholder=""
          min={10}
          max={1000}
          value={formData.maskDiameter}
          name="maskDiameter"
          onChange={handleRangeChange}
          handleInputChange={handleInputChange}
          tooltipText="Circular mask diameter in Angstroms. WARNING: If the mask is too large relative to the box size, RELION will report 'No pixels in background are found. Radius of circular mask is too large.' Ensure the mask diameter is smaller than the box size to leave background pixels for normalization."
        />
        {particleMetadata && (
          <div style={{
            position: 'absolute',
            right: '0',
            bottom: '0',
            fontSize: '10px',
            color: '#065f46',
            padding: '4px 8px',
            backgroundColor: '#d1fae5',
            border: '1px solid #059669',
            borderRadius: '4px',
            textAlign: 'left',
            lineHeight: '1.4',
            whiteSpace: 'nowrap',
            height: '36px',
            display: 'flex',
            flexDirection: 'column',
            justifyContent: 'center'
          }}>
            <div>
              <span style={{ color: "var(--color-text-secondary)" }}>Box:</span> {particleMetadata.image_size}px | <span style={{ color: "var(--color-text-secondary)" }}>Pixel:</span> {particleMetadata.pixel_size}Å
            </div>
            <div>
              <span style={{ color: "var(--color-text-secondary)" }}>Recommended:</span> <strong>{particleMetadata.suggested_mask_diameter}Å</strong> | <span style={{ color: "var(--color-text-secondary)" }}>Max:</span> {particleMetadata.max_safe_mask_diameter}Å
            </div>
          </div>
        )}
      </div>
      <CustomDropdown
        label="Flatten and enforce non-negative solvent?"
        options={dropdownOptions}
        value={formData.nonNegativeSolvent}
        name="nonNegativeSolvent"
        onChange={handleInputChange}
        tooltipText="Flatten solvent and enforce non-negative density. Recommended 'Yes' for cleaner maps with no negative density artifacts in solvent regions."
      />
      <SimpleInput
        label="Symmetry:"
        placeholder=""
        value={formData.Symmetry}
        name="Symmetry"
        onChange={handleInputChange}
        tooltipText="Point group symmetry (C1, C2, D2, etc.). Use C1 if unknown. Correct symmetry dramatically speeds up processing and improves resolution."
      />
      <CustomDropdown
        label="Run in C1 and apply symmetry later?"
        options={dropdownOptions}
        value={formData.runInC1}
        name="runInC1"
        onChange={handleInputChange}
        tooltipText="Run SGD in C1 (no symmetry) and apply symmetry afterwards. Can help discover correct symmetry or avoid imposing wrong symmetry initially."
      />
    </div>
  );
};

export default Optimization;
