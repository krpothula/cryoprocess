import React, { useState } from "react";
import PixelSizeInput from "../../common/PixelSizeInput";
import CustomDropdown from "../../common/Dropdown";
import CustomInput from "../../common/Input";
import SimpleInput from "../../common/SimpleInput";
import FolderBrowserPopup from "../../common/FolderBrowser/FolderBrowserPopup";

const Topaz = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  setFilePopup,
  onFormDataChange,
}) => {
  const isEnable1 = formData.performTopazPicking === "Yes";
  const iseEnable2 = formData.performTopazTraining === "Yes";

  // State for folder browser popups
  const [showParticlesBrowser, setShowParticlesBrowser] = useState(false);
  const [showCoordinatesBrowser, setShowCoordinatesBrowser] = useState(false);
  const [showModelBrowser, setShowModelBrowser] = useState(false);

  return (
    <div className="tab-content">
      <PixelSizeInput
        label="Particle Diameter (Å):"
        placeholder=""
        min={0}
        max={200}
        value={formData.particleDiameter}
        name="particleDiameter"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Expected particle diameter in Angstroms. Used for particle extraction radius during Topaz picking."
      />
      <CustomDropdown
        label="Perform topaz picking? "
        onChange={handleInputChange}
        value={formData.performTopazPicking}
        tooltipText="Run Topaz deep learning-based particle picking. Requires a trained Topaz model."
        name="performTopazPicking"
        options={dropdownOptions}
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setShowModelBrowser(true);
        }}
        name="trainedTopazParticles"
        label="Trained topaz model:"
        placeholder="Browse project folder to select model file"
        tooltipText="Select a trained Topaz model file (.sav) from the project folder"
        value={formData?.["trainedTopazParticles"]}
        disabled={!isEnable1}
      />
      <CustomDropdown
        label="Perform topaz training?"
        onChange={handleInputChange}
        value={formData.performTopazTraining}
        tooltipText="Train a new Topaz model using manually picked particles. Requires training coordinates."
        name="performTopazTraining"
        options={dropdownOptions}
      />
      <PixelSizeInput
        label="No of particles per micrograph:"
        placeholder=""
        min={-1}
        max={200}
        value={formData.nrParticles}
        name="nrParticles"
        onChange={handleRangeChange}
        handleInputChange={handleInputChange}
        tooltipText="Expected number of particles per micrograph. Helps Topaz calibrate its detection threshold."
        disabled={!iseEnable2}
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setShowCoordinatesBrowser(true);
        }}
        name="inputPickCoordinates"
        label="Input picked coordinates for training"
        placeholder="Browse project folder to select coordinates"
        tooltipText="Select coordinate files (.star) from ManualPick or AutoPick job"
        value={formData?.["inputPickCoordinates"]}
        disabled={!iseEnable2}
      />
      <CustomDropdown
        label="OR train on a set of particles?"
        value={formData.trainParticles}
        tooltipText="Use particle coordinates for Topaz training. Select coordinate files from manual picking."
        name="trainParticles"
        onChange={handleInputChange}
        options={dropdownOptions}
        disabled={!iseEnable2}
      />
      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setShowParticlesBrowser(true);
        }}
        name="particlesStar"
        label="Particles STAR file for training"
        placeholder="Browse project folder to select particles.star"
        tooltipText="Select a particles STAR file from Extract, Class2D, or Select job"
        value={formData?.["particlesStar"]}
        disabled={formData.trainParticles !== "Yes" || !iseEnable2}
      />
      <SimpleInput
        label="Topaz executable"
        placeholder="relion_python_topaz"
        name="topazExecutable"
        value={formData.topazExecutable}
        onChange={handleInputChange}
      />
      <SimpleInput
        label="Additional topaz arguments:"
        placeholder=""
        name="topazArguments"
        value={formData.topazArguments}
        onChange={handleInputChange}
      />

      {/* Folder Browser for Particles STAR file */}
      {showParticlesBrowser && (
        <FolderBrowserPopup
          onClose={() => setShowParticlesBrowser(false)}
          onFileSelect={(file) => {
            if (onFormDataChange) {
              onFormDataChange({ particlesStar: file.path });
            } else {
              handleInputChange({
                target: { name: "particlesStar", value: file.path },
              });
            }
            setShowParticlesBrowser(false);
          }}
          initialPath=""
          mode="single"
          extensions=".star"
          title="Select Particles STAR File for Training"
        />
      )}

      {/* Folder Browser for Input Coordinates */}
      {showCoordinatesBrowser && (
        <FolderBrowserPopup
          onClose={() => setShowCoordinatesBrowser(false)}
          onFileSelect={(file) => {
            if (onFormDataChange) {
              onFormDataChange({ inputPickCoordinates: file.path });
            } else {
              handleInputChange({
                target: { name: "inputPickCoordinates", value: file.path },
              });
            }
            setShowCoordinatesBrowser(false);
          }}
          initialPath=""
          mode="single"
          extensions=".star"
          title="Select Coordinate File for Training"
        />
      )}

      {/* Folder Browser for Trained Model */}
      {showModelBrowser && (
        <FolderBrowserPopup
          onClose={() => setShowModelBrowser(false)}
          onFileSelect={(file) => {
            if (onFormDataChange) {
              onFormDataChange({ trainedTopazParticles: file.path });
            } else {
              handleInputChange({
                target: { name: "trainedTopazParticles", value: file.path },
              });
            }
            setShowModelBrowser(false);
          }}
          initialPath=""
          mode="single"
          extensions=".sav"
          title="Select Trained Topaz Model"
        />
      )}
    </div>
  );
};

export default Topaz;
