import React, { useState, useEffect, useMemo } from "react";

import Io from "./Io";
import Reference from "./Reference";
import Ctf from "./Ctf";
import Optimisation from "./Optimization";
import AutoSampling from "./AutoSampling";
import Compute from "./Compute";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { JobTypes } from "../common/Data/jobs";
import { threeDClassificationAPI } from "../../../services/builders/3d-classification/3d-classification";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { mustBePositive, mustBeAtLeast, gpuIdsFormat } from "../../../utils/validationRules";

const initialState = {
  initialLowPassFilter: 60,
  maskDiameter: 200,
  numberOfClasses: 1,
  regularisationParameter: 2,
  numberOfIterations: 25,
  limitResolution: -1,
  initialOffsetRange: 5,
  initialOffsetStep: 1,
  localAngularSearchRange: 5,
  tubeDiameter1: -1,
  tubeDiameter2: -1,
  numberOfUniqueAsymmetrical: 1,
  initialTwist: 0,
  rise: 0,
  centralZlength: 30,
  twistSearch1: 0,
  twistSearch2: 0,
  twistSearch3: 0,
  riseSearchMin: 0,
  riseSearchMax: 0,
  riseSearchStep: 0,
  pooledParticles: 3,
  mpiProcs: 1,
  threads: 1,
  coresPerNode: 1,

  // imagesStarFile: "",
  // continue: "",
  // referenceMap: "",
  // referenceMask: "",
  referenceMapAbsolute: "No",
  resizeReference: "Yes",
  symmetry: "C1",
  ignoreCTFs: "No",
  ctfCorrection: "Yes",
  fastSubsets: "No",
  maskIndividualParticles: "Yes",
  useBlushRegularisation: "No",
  localSearchFromAutoSampling: "Yes",
  initialAngularSampling: "7.5 degrees",
  localAngularSearches: "No",
  relaxSymmetry: "",
  coarserSampling: "No",
  helicalReconstruction: "No",
  keepTiltPriorFixed: "Yes",
  helicalSymmetry: "Yes",
  localSearches: "No",
  useParallelIO: "Yes",
  skipPadding: "No",
  preReadAllParticles: "No",
  copyParticle: "",
  combineIterations: "No",
  gpuAcceleration: "No",
  gpuToUse: "",
  submitToQueue: "Yes",
  queueName: "",
  // StandardSubmissionScript: "",
  additionalArguments: "",
};

const Classification = () => {
  const [activeTab, setActiveTab] = useState("I/O");
  const [formData, setFormData] = useState(initialState);
  const [isLoading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filePopupField, setFilePopup] = useState(""); // Field name for file browser popup

  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

  // Validation rules
  const validationRules = useMemo(() => [
    mustBePositive('maskDiameter', 'Mask diameter'),
    { field: 'maskDiameter', validate: (v) => v && Number(v) > 500 ? { level: 'warning', message: 'Mask diameter >500 A is unusual' } : null },
    mustBeAtLeast('numberOfClasses', 'Number of classes', 1),
    mustBeAtLeast('numberOfIterations', 'Iterations', 1),
    gpuIdsFormat('gpuToUse'),
  ], []);

  const { getFieldStatus, hasErrors: hasValidationErrors, errorCount } = useFormValidation(formData, validationRules);

  // Load copied job parameters when available
  useEffect(() => {
    if (copiedJobParams && Object.keys(copiedJobParams).length > 0) {
      setFormData(prev => ({
        ...prev,
        ...copiedJobParams,
      }));
            setTimeout(() => clearCopiedJobParams(), 100);
    }
  }, [copiedJobParams, clearCopiedJobParams]);

  // Auto-populate inputs from tree job selection
  useEffect(() => {
    if (autoPopulateInputs && Object.keys(autoPopulateInputs).length > 0) {
      setFormData(prev => ({ ...prev, ...autoPopulateInputs }));
      setTimeout(() => clearAutoPopulate(), 100);
    }
  }, [autoPopulateInputs, clearAutoPopulate]);


  const handleInputChange = (e) => {
    if (e.target.files) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          const base64String = reader.result;
          setFormData({
            ...formData,
            [e.target.name]: base64String,
          });
        };
        reader.readAsDataURL(file);
      }
    } else {
      setFormData({
        ...formData,
        [e.target.name]: e.target.value,
      });
    }
  };
  const handleRangeChange = (e) => {
    if (!e || !e.target) {
      return;
    }

    const { value, name } = e.target;

    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else {
      alert("Please enter a valid number.");
      return;
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    threeDClassificationAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess();
        }, 2000);
      })
      .catch((error) => {
        // Handle error response from the API
        setMessage(
          `Error: ${
            error?.response?.data?.message || DefaultMessages.processError
          }`
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // onSelectTab(tab)
  };

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];
  const degreeOptions = [
    { label: "30 degrees", value: "30 degrees" },
    { label: "15 degrees", value: "15 degrees" },
    { label: "7.5 degrees", value: "7.5 degrees" },
    { label: "3.7 degrees", value: "3.7 degrees" },
    { label: "1.8 degrees", value: "1.8 degrees" },
    { label: "0.9 degrees", value: "0.9 degrees" },
    { label: "0.5 degrees", value: "0.5 degrees" },
    { label: "0.2 degrees", value: "0.2 degrees" },
    { label: "0.1 degrees", value: "0.1 degrees" },
  ];
  return (
    <div className="container">
      <div className="tabs-container ">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Reference" ? "active-tab" : ""}
          onClick={() => handleTabChange("Reference")}
        >
          Reference
        </button>
        <button
          className={activeTab === "CTF" ? "active-tab" : ""}
          onClick={() => handleTabChange("CTF")}
        >
          CTF
        </button>
        <button
          className={activeTab === "Optimisation" ? "active-tab" : ""}
          onClick={() => handleTabChange("Optimisation")}
        >
          Optimisation
        </button>
        <button
          className={activeTab === "Auto-sampling" ? "active-tab" : ""}
          onClick={() => handleTabChange("Auto-sampling")}
        >
          Auto-sampling
        </button>
        <button
          className={activeTab === "Compute" ? "active-tab" : ""}
          onClick={() => handleTabChange("Compute")}
        >
          Compute
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-content">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            jobType={JobTypes["3d_classification"]}
            setFilePopup={setFilePopup}
          />
        )}

        {activeTab === "Reference" && (
          <Reference
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "CTF" && (
          <Ctf
            formData={formData}
            handleInputChange={handleInputChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Optimisation" && (
          <Optimisation
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Auto-sampling" && (
          <AutoSampling
            formData={formData}
            handleInputChange={handleInputChange}
            degreeOptions={degreeOptions}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Compute" && (
          <Compute
            formData={formData}
            handleInputChange={handleInputChange}
            dropdownOptions={dropdownOptions}
            handleRangeChange={handleRangeChange}
          />
        )}

        {activeTab === "Running" && (
          <Running
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        <SubmitButton
          handleSubmit={handleSubmit}
          formData={formData}
          activeTab={activeTab}
          isLoading={isLoading}
          hasValidationErrors={hasValidationErrors}
          validationSummary={errorCount > 0 ? `${errorCount} parameter error${errorCount > 1 ? 's' : ''} must be fixed before submission` : null}
        />
      </form>
      {message && (
        <p
          className={`px-5 pl-0 m-0 ${
            message?.includes("Error") ? "text-danger" : ""
          }`}
        >
          {message}
        </p>
      )}

      {/* Folder Browser Popup - for browsing MRC files from project folder */}
      {!!filePopupField && (
        <FolderBrowserPopup
          title={
            filePopupField === "referenceMask" ? "Select Reference Mask" :
            "Select Reference Map"
          }
          extensions=".mrc,.map"
          mode="single"
          onClose={() => setFilePopup("")}
          onFileSelect={(file) => {
            handleFormDataChange({
              [filePopupField]: file ? file.path : "",
            });
            setFilePopup("");
          }}
        />
      )}
    </div>
  );
};

export default Classification;
