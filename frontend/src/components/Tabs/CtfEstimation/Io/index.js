import React from "react";
import CustomInput from "../../common/Input";
import PixelSizeInput from "../../common/PixelSixeInput";
import CustomDropdown from "../../common/Dropdown";
import InputGroup from "../../common/InputGroup";

const Io = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
  jobType
}) => {
  const isEnable = formData.estimatePhaseShifts === "Yes";
  return (
    <div className="tab-content">
      <CustomInput
        isCustomUpload={false}
        stageStarFiles="Import,MotionCorr"
        onChange={(val = "") => {
          handleInputChange({ target: { name: "inputStarFile", value: val } });
        }}
        name="inputStarFile"
        label="Input micrographs STAR file:"
        placeholder="Select micrographs STAR file"
        tooltipText="Select micrographs.star from Import (for raw micrographs) or corrected_micrographs.star from Motion Correction (recommended)"
        value={formData?.["inputStarFile"]}
        jobType={jobType}
      />

      <CustomDropdown
        label="Use micrograph without dose-weighting:"
        options={dropdownOptions}
        value={formData.useMicrographWithoutDoseWeighting}
        name="useMicrographWithoutDoseWeighting"
        onChange={handleInputChange}
        tooltipText="Use non-dose-weighted micrographs for CTF estimation. Recommended 'Yes' as dose-weighting reduces high-frequency signal needed for accurate CTF fitting."
      />

      <CustomDropdown
        label="Estimate phase shifts:"
        options={dropdownOptions}
        value={formData.estimatePhaseShifts}
        name="estimatePhaseShifts"
        onChange={handleInputChange}
        tooltipText="Enable for data collected with a Volta Phase Plate (VPP). Phase plates add an additional phase shift that must be estimated along with defocus."
      />
      <InputGroup
        label="Phase shift-Min,Max,Step(deg):"
        inputs={[
          { name: "phaseShiftMin", value: formData.phaseShiftMin },
          { name: "phaseShiftMax", value: formData.phaseShiftMax },
          { name: "phaseShiftStep", value: formData.phaseShiftStep },
        ]}
        onChange={handleInputChange}
        tooltipText="Search range for phase shift estimation (in degrees). Typical VPP range: 0-180°. Step determines accuracy vs speed tradeoff."
        disabled={!isEnable}
        disabledHint="Enable 'Estimate phase shifts' first"
      />
      {/* <div className="label-box-container">
      <label style={{ font: "medium", fontSize: "16px" }}>Phase shift-Min,Max,Step(deg):</label>
      <input style={{ width: "161.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", marginLeft: "6px", height: "36px" }} type="number" name="patchesX" value={formData.patchesX} onChange={handleInputChange} />
      <input style={{ width: "162.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", height: "36px", margin: "5px" }} type="number" name="patchesX" value={formData.patchesX} onChange={handleInputChange} />
      <input style={{ width: "162.5px", backgroundColor: "#ffffe3", border: "1px solid gray", borderRadius: "4px", height: "36px" }} type="number" name="patchesY" value={formData.patchesY} onChange={handleInputChange} />
    </div> */}

      <PixelSizeInput
        label="Amount of astigmatism (A):"
        placeholder=""
        min={1}
        max={1000}
        value={formData.astigmatism}
        name="astigmatism"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Expected astigmatism amount in Angstroms. Use 100-200Å for well-aligned microscopes. Higher values (500-1000Å) for poorer alignment or VPP data."
      />
    </div>
  );
};

export default Io;
