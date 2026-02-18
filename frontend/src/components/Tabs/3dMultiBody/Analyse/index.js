import React from "react";
import CustomDropdown from "../../common/Dropdown";
import PixelSizeInput from "../../common/PixelSizeInput";

const Analyse = ({
  formData,
  handleInputChange,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Run flexibility analysis?"
        onChange={handleInputChange}
        value={formData.runFlexibility}
        tooltipText="Perform principal component analysis on the multi-body orientations to analyze flexibility modes."
        name="runFlexibility"
        options={dropdownOptions}
      />
      <PixelSizeInput
        label="Number of eigenvector movies:"
        placeholder=""
        min={0}
        max={50}
        value={formData.numberOfEigenvectorMovies}
        name="numberOfEigenvectorMovies"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Number of eigenvector movies to generate. Each movie shows motion along one principal component. 3-5 is usually sufficient."
      />
      <CustomDropdown
        label="Select particles based on eigenvalues?"
        onChange={handleInputChange}
        value={formData.selectParticlesEigenValue}
        tooltipText="Select particles based on their eigenvector values. Useful for sorting particles by conformational state."
        name="selectParticlesEigenValue"
        options={dropdownOptions}
      />
      <PixelSizeInput
        label="Select on eigenvalue:"
        placeholder=""
        min={1}
        max={50}
        value={formData.eigenValue}
        name="eigenValue"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Which eigenvector (principal component) to use for particle selection. 1 = largest motion, 2 = second largest, etc."
      />
      <PixelSizeInput
        label="Minimum eigenvalue:"
        placeholder=""
        min={-999}
        max={999}
        value={formData.minEigenValue}
        name="minEigenValue"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Minimum eigenvector value for particle selection. Particles below this value are excluded."
      />
      <PixelSizeInput
        label="Maximum eigenvalue:"
        placeholder=""
        min={-999}
        max={999}
        value={formData.maxEigenValue}
        name="maxEigenValue"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Maximum eigenvector value for particle selection. Particles above this value are excluded."
      />
    </div>
  );
};

export default Analyse;
