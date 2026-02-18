import React, { useState, useEffect } from "react";
import Io from "./Io";
import Laplacian from "./Laplacian";
import Topaz from "./Topaz";
import References from "./References";
import Autopicking from "./Autopicking";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { useBuilder } from "../../../context/BuilderContext";
import { autoPickerAPI } from "../../../services/builders/auto-pick/auto-pick";
import { DefaultMessages } from "../common/Data";
import { JobTypes } from "../common/Data/jobs";
const initialFormData = {
  pixelSize: -1,
  minDiameter: 200,
  maxDiameter: 250,
  maxResolution: 20,
  upperThreshold: 999,
  defaultThreshold: 0,
  particleDiameter: -1,
  nrParticles: -1,
  lowpassFilterReference: 20,
  highpassFilterReference: -1,
  pixelSizeReference: -1,
  angular: 5,
  pickingThreshold: 0.05,
  tubeDiameter: 200,
  minLength: -1,
  pick2DHelicalSeg: "No",
  interParticle: 100,
  maxStddev: 1.0,
  minavg: -999,
  shrinkFactor: 0,

  templateMatching: "No",
  laplacianGaussian: "No",
  useTopaz: "No",
  continueManually: "No",
  areParticlesWhite: "No",
  // inputPickCoordinates: "",
  trainParticles: "No",
  // particlesStar: "",
  topazExecutable: "",
  topazArguments: "",
  //   twoDReferences: "",
  provideReference: "No",
  //   threeDReference: "",
  symmetry: "",
  contrast: "Yes",
  corrected: "Yes",
  peak: "No",
  submitToQueue: "Yes",
  queueName: "",
  writeFOMMaps: "No",
  readFOMMaps: "No",
  useAcceleration: "No",
  gpuToUse: "",
  performTopazPicking: "No",
  performTopazTraining: "No",
  lowpassFilter: 20,
  highpassFilter: -1,
  angularSampling: "5 degrees",
  additionalArguments: "",
};

const AutoPicker = () => {
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setLoading] = useState(false);
  // SLURM parameters are managed in a separate state
  const [slurmData] = useState({
    mpiProcs: 1,
    submissionScript: "",
    coresPerNode: 1,
  });
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");

  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

  // Debug: log on every render

  // Load copied job parameters when available
  useEffect(() => {
    if (copiedJobParams && Object.keys(copiedJobParams).length > 0) {
      setFormData(prev => {
        const newData = { ...prev, ...copiedJobParams };
        return newData;
      });
            // Clear after a short delay to ensure state is updated
      setTimeout(() => {
        clearCopiedJobParams();
      }, 100);
    }
  }, [copiedJobParams, clearCopiedJobParams]);

  // Auto-populate inputs from tree job selection
  useEffect(() => {
    if (autoPopulateInputs && Object.keys(autoPopulateInputs).length > 0) {
      setFormData(prev => ({ ...prev, ...autoPopulateInputs }));
      setTimeout(() => clearAutoPopulate(), 100);
    }
  }, [autoPopulateInputs, clearAutoPopulate]);

  // Mutual exclusivity: only one picking method can be "Yes" at a time
  const pickingMethodFields = ['templateMatching', 'laplacianGaussian'];

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
      const { name, value } = e.target;

      // When setting a picking method to "Yes", reset the other to "No"
      if (pickingMethodFields.includes(name) && value === "Yes") {
        setFormData((prev) => {
          const updated = { ...prev, [name]: value };
          pickingMethodFields.forEach((field) => {
            if (field !== name) updated[field] = "No";
          });
          return updated;
        });
      } else {
        setFormData({
          ...formData,
          [name]: value,
        });
      }
    }
  };

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    autoPickerAPI({ ...(formData || {}), ...(slurmData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess();
        }, 2000);
      })
      .catch((error) => {
        // Handle error response from the API
        setMessage(
          `Error: ${error?.response?.data?.message || DefaultMessages.processError
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

  // Determine which picking method is active
  // Note: Template matching and Topaz are currently hidden/disabled
  const isTemplateMatching = formData.templateMatching === "Yes";
  const isLaplacian = formData.laplacianGaussian === "Yes";
  // Enable/disable tabs based on picking method
  const isLaplacianTabEnabled = isLaplacian;
  const isReferencesTabEnabled = isTemplateMatching;

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
          className={`${activeTab === "Laplacian" ? "active-tab" : ""} ${!isLaplacianTabEnabled ? "disabled-tab" : ""}`}
          onClick={() => isLaplacianTabEnabled && handleTabChange("Laplacian")}
          disabled={!isLaplacianTabEnabled}
        >
          Laplacian
        </button>
        {/* Topaz tab hidden - not currently supported */}
        <button
          className={`${activeTab === "References" ? "active-tab" : ""} ${!isReferencesTabEnabled ? "disabled-tab" : ""}`}
          onClick={() => isReferencesTabEnabled && handleTabChange("References")}
          disabled={!isReferencesTabEnabled}
        >
          References
        </button>
        <button
          className={activeTab === "AutoPicking" ? "active-tab" : ""}
          onClick={() => handleTabChange("AutoPicking")}
        >
          AutoPicking
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
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
            jobType={JobTypes.auto_picking}
          />
        )}

        {activeTab === "Laplacian" && (
          <Laplacian
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Topaz" && (
          <Topaz
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
            onFormDataChange={handleFormDataChange}
          />
        )}

        {activeTab === "References" && (
          <References
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            degreeOptions={degreeOptions}
            setFilePopup={setFilePopup}
            onFormDataChange={handleFormDataChange}
          />
        )}
        {activeTab === "AutoPicking" && (
          <Autopicking
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
        />
      </form>

      {message && (
        <p
          className={`px-5 ${message?.includes("Error") ? "text-danger" : ""}`}
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

export default AutoPicker;
