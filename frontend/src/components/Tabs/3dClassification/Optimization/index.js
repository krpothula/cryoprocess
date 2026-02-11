import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSixeInput";

const Optimization = ({ formData, handleInputChange, handleRangeChange, dropdownOptions, particleMetadata }) => {
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Number of classes:"
        placeholder=""
        min={1}
        max={100}
        value={formData.numberOfClasses}
        name="numberOfClasses"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of 3D classes to generate. Use 3-6 for heterogeneity analysis. More classes require more particles (~5000-10000 per class minimum)."
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
        tooltipText="Regularisation parameter T. Higher T (3-4) for noisy/small particles, lower T (1-2) for large, well-defined particles. Default 4 is good for most 3D classification."
      />
      <PixelSizeInput
        label="Number of iterations:"
        placeholder=""
        min={1}
        max={50}
        value={formData.numberOfIterations}
        name="numberOfIterations"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of iterations. Typically 25-40 iterations. Check convergence - if classes are still changing, run more iterations."
      />
      <CustomDropdown
        label="Use fast subsets (for large data sets)?"
        options={dropdownOptions}
        value={formData.fastSubsets}
        name="fastSubsets"
        onChange={handleInputChange}
        tooltipText="Use subsets for faster classification of large datasets (>100k particles). Speeds up early iterations but may reduce accuracy for final class assignments."
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
              <span style={{ color: '#6b7280' }}>Box:</span> {particleMetadata.image_size}px | <span style={{ color: '#6b7280' }}>Pixel:</span> {particleMetadata.pixel_size}Å
            </div>
            <div>
              <span style={{ color: '#6b7280' }}>Recommended:</span> <strong>{particleMetadata.suggested_mask_diameter}Å</strong> | <span style={{ color: '#6b7280' }}>Max:</span> {particleMetadata.max_safe_mask_diameter}Å
            </div>
          </div>
        )}
      </div>
      <CustomDropdown
        label="Mask individual particles with zeros:"
        options={dropdownOptions}
        value={formData.maskIndividualparticles}
        name="maskIndividualparticles"
        onChange={handleInputChange}
        tooltipText="Mask particles with zeros instead of noise. 'Yes' recommended for most cases. 'No' may help if particles extend to box edge."
      />
       <PixelSizeInput
        label="Limit resolution E-step to (A):"
        placeholder=""
        min={-1}
        max={10}
        value={formData.limitResolution}
        name="limitResolution"
        onChange={handleRangeChange}
                handleInputChange={handleInputChange}
        tooltipText="Limit resolution in E-step (Å). Set to -1 for no limit. Using 8-10Å can speed up classification while maintaining class separation."
      />
      <CustomDropdown
        label="Use Blush regularisation:"
        options={dropdownOptions}
        value={formData.useBlushRegularisation}
        name="useBlushRegularisation"
        onChange={handleInputChange}
        tooltipText="Use Blush regularisation (neural network-based). Can improve map quality, especially for small proteins. Requires GPU and more memory."
      />
    </div>
  );
};

export default Optimization;
