import React, { useState, useEffect, useMemo } from "react";
import "../../form.css";
import Io from "./Io";
import Extract from "./Extract";
import Running from "./Running";
import SubmitButton from "../common/SubmitButton";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { particleExtractionAPI } from "../../../services/builders/particle-extraction/particle-extraction";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { JobTypes } from "../common/Data/jobs";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { mustBeEven, mustBePositive, conditionalEven } from "../../../utils/validationRules";

const ParticleExtraction = () => {
  const initialFormData = {
    // micrographStarFile: '',
    // inputCoordinates: '',
    reExtractRefinedParticles: "No",
    //  refinedParticlesStarFile: '',
    resetRefinedOffsets: "No",
    reCenterRefinedCoordinates: "No",

    writeOutputInFloat16: "Yes",

    xRec: 0,
    yRec: 0,
    zRec: 0,
    particleBoxSize: 128,
    diameterBackgroundCircle: -1,
    stddevWhiteDust: -1,
    stddevBlackDust: -1,
    rescaledSize: 128,
    minimumAutopickFOM: 0,
    tubeDiameter: 200,
    numAsymmetricalUnits: 1,
    helicalRise: 1,
    mpiProcs: 1,
    coresPerNode: 1,

    invertContrast: "Yes",
    normalizeParticles: "Yes",
    rescaleParticles: "No",

    useAutopickFOMThreshold: "No",

    extractHelicalSegments: "No",
    submitToQueue: "Yes",
    queueName: "",
    // submissionScript: '',
    useBimodalAngularPriors: "Yes",
    coordinatesStartEndOnly: "Yes",
    cutHelicalSegments: "Yes",
    additionalArguments: "",
  };
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setLoading] = useState(false);
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");
  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

  // Validation rules
  const validationRules = useMemo(() => [
    mustBeEven('particleBoxSize', 'Box size'),
    mustBePositive('particleBoxSize', 'Box size'),
    conditionalEven('rescaledSize', 'Rescaled size', 'rescaleParticles', 'Yes'),
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

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    setLoading(true);
    particleExtractionAPI({ ...(formData || {}), projectId })
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
  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];
  return (
    <div className="container">
      <div className="tabs-container">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Extract" ? "active-tab" : ""}
          onClick={() => handleTabChange("Extract")}
        >
          Extract
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      <form onSubmit={handleSubmit} noValidate className="form-content ">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
            jobType={JobTypes.particle_extraction}
          />
        )}

        {activeTab === "Extract" && (
          <Extract
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Running" && (
          <Running
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
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

      {/* Folder Browser - Popup */}
      {!!filePopupField && (
        <FolderBrowserPopup
          onClose={() => setFilePopup("")}
          onFileSelect={(file) => {
            handleFormDataChange({
              [filePopupField]: file ? file.path : "",
            });
            setFilePopup("");
          }}
          title="Browse Project Files"
        />
      )}
    </div>
  );
};

export default ParticleExtraction;
