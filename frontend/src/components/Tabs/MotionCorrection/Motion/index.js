import React from "react";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomInput from "../../common/Input";
import SimpleInput from "../../common/SimpleInput";
import CustomDropdown from "../../common/Dropdown";
import InputGroup from "../../common/InputGroup";

const Motion = ({
  handleInputChange,
  formData,
  handleRangeChange,
  gainRotationOptions,
  dropdownOptions,
  gainFlipOptions,
  setFilePopup,
  softwareConfig,
}) => {
  const isUseRelionImplementationYes =
    formData.useRelionImplementation === "Yes";
  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Bfactor:"
        placeholder=""
        min={0}
        max={1000}
        value={formData.bfactor}
        name="bfactor"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="B-factor for exponential filter applied to motion traces. Higher values smooth motion more. Default 150 works well for most data. Increase for noisy/low-dose data."
      />
      <InputGroup
        label="Number of patches X, Y:"
        inputs={[
          { name: "patchesX", value: formData.patchesX },
          { name: "patchesY", value: formData.patchesY },
        ]}
        onChange={handleInputChange}
        tooltipText="Divide micrograph into patches for local motion correction. More patches = more accurate but slower. 5x5 is good for most data. Use 1x1 for global-only correction."
      />

      <PixelSizeInput
        label="Group frames:"
        placeholder=""
        min={0}
        max={50}
        value={formData.groupFrames}
        name="groupFrames"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Group this many frames together for motion estimation. Higher values improve signal but reduce temporal resolution. Default 1 processes each frame individually."
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("gainReferenceImage");
        }}
        name="gainReferenceImage"
        label="Gain-reference image:"
        placeholder=""
        tooltipText="Gain reference file from your detector to correct pixel-to-pixel sensitivity variations. Essential for K2/K3 and Falcon detectors. Usually provided with your data."
        value={formData?.["gainReferenceImage"]}
      />

      <CustomDropdown
        label="Gain rotation:"
        options={gainRotationOptions}
        value={formData.gainRotation}
        name="gainRotation"
        onChange={handleInputChange}
        tooltipText="Rotation to apply to gain reference before use. May be needed if gain was saved in different orientation than movies. Try different values if gain correction looks wrong."
      />

      <CustomDropdown
        label="Gain flip:"
        options={gainFlipOptions}
        value={formData.gainFlip}
        name="gainFlip"
        onChange={handleInputChange}
        tooltipText="Flip gain reference horizontally or vertically. Required if gain and movies were saved with different orientations. Check your detector documentation."
      />

      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("defectFile");
        }}
        name="defectFile"
        label="Defect file:"
        placeholder=""
        tooltipText="File listing defective/hot pixels on your detector to be masked during processing. Optional but improves results if your detector has known bad pixels."
        value={formData?.["defectFile"]}
      />

      <CustomDropdown
        label="Use RELION's own implementation:"
        options={dropdownOptions}
        value={formData.useRelionImplementation}
        name="useRelionImplementation"
        onChange={handleInputChange}
        tooltipText="Use RELION's built-in motion correction. Recommended for most cases. Select 'No' to use external MotionCor2 if you have specific requirements."
      />
      <CustomInput
        onChange={() => {}}
        name="motioncore"
        label="MOTIONCOR2 executable:"
        placeholder="Configured in .env file"
        tooltipText="Path to MotionCor2 executable. This is configured on the server in the .env file. Only used when RELION's implementation is disabled."
        value={softwareConfig?.motioncor2_exe || "Not configured"}
        disabled={true}
        readOnly={true}
      />
      <SimpleInput
        onChange={handleInputChange}
        name="gpu"
        label="Which GPUs to use:"
        placeholder="0"
        tooltipText="GPU device IDs for MotionCor2 (e.g., '0' for first GPU, '0,1' for two GPUs). Only applies when using external MotionCor2."
        value={formData?.["gpu"] || ""}
        disabled={isUseRelionImplementationYes}
        disabledHint="Switch to MotionCor2 to configure GPUs"
      />
      <SimpleInput
        onChange={handleInputChange}
        name="othermotion"
        label="Other MOTIONCOR2 arguments:"
        placeholder=""
        tooltipText="Additional command-line arguments for MotionCor2. For advanced users only. Refer to MotionCor2 documentation for available options."
        value={formData?.["othermotion"] || ""}
        disabled={isUseRelionImplementationYes}
        disabledHint="Switch to MotionCor2 to use extra arguments"
      />
    </div>
  );
};

export default Motion;
