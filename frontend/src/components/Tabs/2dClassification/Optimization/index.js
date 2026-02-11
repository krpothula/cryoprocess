import React, { useEffect } from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSixeInput";

const Optimization = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
  particleMetadata,
  maskHint,
}) => {
  const isEMEnabled = formData.useEM === "Yes";
  const isVDAMEnabled = formData.useVDAM === "Yes";

  // EM and VDAM are mutually exclusive - one must always be Yes
  // When EM is enabled, automatically disable VDAM
  useEffect(() => {
    if (isEMEnabled && formData.useVDAM !== "No") {
      handleInputChange({ target: { name: "useVDAM", value: "No" } });
    }
  }, [isEMEnabled]);

  // When VDAM is enabled, automatically disable EM
  useEffect(() => {
    if (isVDAMEnabled && formData.useEM !== "No") {
      handleInputChange({ target: { name: "useEM", value: "No" } });
    }
  }, [isVDAMEnabled]);

  // When VDAM is disabled, automatically enable EM (one must be active)
  useEffect(() => {
    if (!isVDAMEnabled && !isEMEnabled) {
      handleInputChange({ target: { name: "useEM", value: "Yes" } });
    }
  }, [isVDAMEnabled]);

  // When EM is disabled, automatically enable VDAM (one must be active)
  useEffect(() => {
    if (!isEMEnabled && !isVDAMEnabled) {
      handleInputChange({ target: { name: "useVDAM", value: "Yes" } });
    }
  }, [isEMEnabled]);

  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Number of classes:"
        placeholder=""
        min={1}
        max={50}
        value={formData.numberOfClasses}
        name="numberOfClasses"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of 2D class averages to generate. Start with 50-100 for initial sorting. More classes can reveal heterogeneity but require more particles per class."
      />
      <PixelSizeInput
        label="Regularisation parameter T:"
        placeholder=""
        min={1}
        max={10}
        value={formData.regularisationParam}
        name="regularisationParam"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Regularisation parameter T controls smoothness vs detail. Higher T (2-4) for small or noisy particles, lower T (1-2) for large, well-defined particles."
      />
      <CustomDropdown
        label="Use EM algorithm?"
        options={dropdownOptions}
        value={formData.useEM}
        name="useEM"
        onChange={handleInputChange}
        tooltipText="Use Expectation-Maximization algorithm. Traditional RELION approach, good for all dataset sizes. Mutually exclusive with VDAM."
        disabled={isVDAMEnabled}
      />
      <PixelSizeInput
        label="Number of EM iterations:"
        placeholder=""
        min={0}
        max={50}
        value={formData.numberEMIterations}
        name="numberEMIterations"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of EM iterations to run. Typically 25-50 iterations. More iterations can improve convergence but increase processing time."
        disabled={!isEMEnabled}
      />
      <CustomDropdown
        label="Use VDAM algorithm:"
        options={dropdownOptions}
        value={formData.useVDAM}
        name="useVDAM"
        onChange={handleInputChange}
        tooltipText="Use Variable-metric Deterministic Annealing algorithm. Faster for large datasets (>100k particles), GPU-optimized. Mutually exclusive with EM."
        disabled={isEMEnabled}
      />
      <PixelSizeInput
        label="Number of VDAM mini-batches:"
        placeholder=""
        min={100}
        max={1000}
        value={formData.vdamMiniBatches}
        name="vdamMiniBatches"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of mini-batches for VDAM algorithm. More mini-batches = more iterations but finer updates. 200-500 typically sufficient."
        disabled={!isVDAMEnabled || isEMEnabled}
      />
      <div className="mask-diameter-wrapper" style={{ position: 'relative' }}>
        <PixelSizeInput
          label="Mask diameter(A):"
          placeholder=""
          min={0}
          max={500}
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
        label="Mask individual particles with Zeros?"
        options={dropdownOptions}
        value={formData.maskParticlesWithZeros}
        name="maskParticlesWithZeros"
        onChange={handleInputChange}
        tooltipText="Mask particles with zeros instead of noise. 'Yes' recommended for most cases. 'No' may help if particles extend to box edge."
      />
      <PixelSizeInput
        label="Limit resolution E-step to (A):"
        placeholder=""
        min={-1}
        max={50}
        value={formData.limitResolutionEStep}
        name="limitResolutionEStep"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Limit resolution in E-step for faster processing. Set to -1 for no limit. Use 10-15Å for initial classification, then remove limit for final rounds."
      />
      <CustomDropdown
        label="Center class averages?"
        options={dropdownOptions}
        value={formData.centerClassAverages}
        name="centerClassAverages"
        onChange={handleInputChange}
        tooltipText="Center class averages during iterations. Recommended 'Yes' to keep particles centered in the box for better alignment."
      />
    </div>
  );
};

export default Optimization;
