import React, { useState } from "react";
import CustomDropdown from "../../common/Dropdown";
import CustomInput from "../../common/Input";
import SimpleInput from "../../common/SimpleInput";
import PixelSizeInput from "../../common/PixelSixeInput";
import FolderBrowserPopup from "../../common/FolderBrowser/FolderBrowserPopup";

const References = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  degreeOptions,
  setFilePopup,
  onFormDataChange,
}) => {
  const disable3dReferences = formData.provideReference === "No";

  // State for folder browser popups
  const [show2DRefBrowser, setShow2DRefBrowser] = useState(false);
  const [show3DRefBrowser, setShow3DRefBrowser] = useState(false);

  return (
    <div className="tab-content">
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setShow2DRefBrowser(true);
        }}
        name="twoDReferences"
        label="2D References"
        placeholder="Browse project folder to select 2D references"
        tooltipText="Select 2D class averages (.star or .mrcs) to use as templates for picking"
        value={formData?.["twoDReferences"]}
      />
      <CustomDropdown
        label="OR: provide a 3D reference?"
        value={formData.provideReference}
        tooltipText="Use a 3D reference map instead of 2D references for template matching"
        name="provideReference"
        options={dropdownOptions}
        onChange={handleInputChange}
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setShow3DRefBrowser(true);
        }}
        name="threeDReference"
        label="3D reference"
        placeholder="Browse project folder to select 3D reference"
        tooltipText="Select a 3D reference map (.mrc) to use for template matching"
        value={formData?.["threeDReference"]}
        disabled={disable3dReferences}
      />

      {/* Folder Browser for 2D References */}
      {show2DRefBrowser && (
        <FolderBrowserPopup
          onClose={() => setShow2DRefBrowser(false)}
          onFileSelect={(file) => {
            if (onFormDataChange) {
              onFormDataChange({ twoDReferences: file.path });
            } else {
              handleInputChange({
                target: { name: "twoDReferences", value: file.path },
              });
            }
            setShow2DRefBrowser(false);
          }}
          initialPath=""
          mode="single"
          extensions=".star,.mrcs"
          title="Select 2D References"
        />
      )}

      {/* Folder Browser for 3D Reference */}
      {show3DRefBrowser && (
        <FolderBrowserPopup
          onClose={() => setShow3DRefBrowser(false)}
          onFileSelect={(file) => {
            if (onFormDataChange) {
              onFormDataChange({ threeDReference: file.path });
            } else {
              handleInputChange({
                target: { name: "threeDReference", value: file.path },
              });
            }
            setShow3DRefBrowser(false);
          }}
          initialPath=""
          mode="single"
          extensions=".mrc"
          title="Select 3D Reference"
        />
      )}
      <SimpleInput
        label="Symmetey"
        placeholder="C1"
        name="Symmetry"
        value={formData.Symmetry}
        onChange={handleInputChange}
        disabled={disable3dReferences}
      />
      <CustomDropdown
        label="3D angular sampling"
        value={formData.angularSampling}
        tooltipText="Angular sampling for template projections (degrees). Finer sampling = more templates but slower. 5-10 degrees is typical."
        name="angularSampling"
        options={degreeOptions}
        onChange={handleInputChange}
        disabled={disable3dReferences}
      />
      <PixelSizeInput
        label="Lowpass filter reference (A):"
        placeholder=""
        min={0}
        max={200}
        value={formData.lowpassFilterReference}
        name="lowpassFilterReference"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Low-pass filter references to this resolution (Angstroms). Prevents overfitting to high-frequency noise in templates. Use 15-25 Angstroms."
      />
      <PixelSizeInput
        label="Highpassfilter reference (A):"
        placeholder=""
        min={0}
        max={200}
        value={formData.HighpassFilterReference}
        name="HighpassFilterReference"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="High-pass filter references (Angstroms). Removes low-frequency variations. Use -1 to disable."
      />

      <PixelSizeInput
        label="Pixel size in references(A):"
        placeholder=""
        min={0}
        max={200}
        value={formData.pixelRefe}
        name="pixelRefe"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Pixel size of reference images (Angstroms). Set to -1 to read from the STAR file header."
      />
      <PixelSizeInput
        label="In-plane angular sampling (deg):"
        placeholder=""
        min={0}
        max={200}
        value={formData.angular}
        name="angular"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Angular search range for in-plane rotation of templates (degrees). Use -1 for full 360 degree search."
      />

      <CustomDropdown
        label="References have inverted contrast?"
        value={formData.contrast}
        onChange={handleInputChange}
        tooltipText="Particle contrast relative to background. Use 'White' for negative stain, 'Black' for cryo-EM (protein darker than ice)."
        name="contrast"
        options={dropdownOptions}
      />
      <CustomDropdown
        label="Are Refrences CTF corrected?"
        value={formData.corrected}
        tooltipText="Use CTF-corrected references for template matching. Recommended for improved accuracy."
        onChange={handleInputChange}
        name="corrected"
        options={dropdownOptions}
      />
      <CustomDropdown
        label="Ignore CTF until first peak?"
        placeholder="openmpi"
        value={formData.peak}
        tooltipText="Use peak search instead of cross-correlation for particle detection. Can reduce false positives near ice edges."
        onChange={handleInputChange}
        name="peak"
        options={dropdownOptions}
        disabled={formData.corrected === "No"}
      />
    </div>
  );
};

export default References;
