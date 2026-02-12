import React, { useState, useEffect } from "react";

import Io from "./Io";
import Ctf from "./Ctf";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { ctfEstimationAPI } from "../../../services/builders/ctf/ctf";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { JobTypes } from "../common/Data/jobs";
import { getSoftwareConfig } from "../../../services/softwareConfig";

const CtfEstimation = () => {
  const initialFormData = {
    // inputStarFile: '',
    useMicrographWithoutDoseWeighting: "No",
    estimatePhaseShifts: "No",
    ctfFindExecutable: '', // Will be loaded from .env via API
    usePowerSpectraFromMotionCorr: "Yes",
    useExhaustiveSearch: "No",
    astigmatism: 100,
    phaseShiftMin: 0,
    phaseShiftMax: 180,
    phaseShiftStep: 10,
    ctfWindowSize: -1,
    fftBoxSize: 512,
    minResolution: 30,
    maxResolution: 5,
    minDefocus: 5000,
    maxDefocus: 50000,
    defocusStepSize: 500,
    runningmpi: 1,
    executable: 0,
    coresPerNode: 1,
    Cs: 0,
    Q0: 0,
    beamtilt_x: 0,
    beamtilt_y: 0,
    submitToQueue: "Yes",
    queueName: "",
    queueSubmitCommand: "",
    //  submissionScript: '',
    additionalArguments: "",
  };

  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setLoading] = useState(false);
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");

  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

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

  // Load CTFFIND executable path from .env via API on mount
  useEffect(() => {
    getSoftwareConfig()
      .then((response) => {
        const ctffindPath = response?.data?.data?.ctffind_exe || "";
        if (ctffindPath) {
          setFormData((prev) => ({
            ...prev,
            ctfFindExecutable: ctffindPath,
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to load software config:", error);
      });
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    ctfEstimationAPI({ ...(formData || {}), project_id: projectId })
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

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

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
          className={activeTab === "CTFFIND" ? "active-tab" : ""}
          onClick={() => handleTabChange("CTFFIND")}
        >
          CTFFIND-4.1
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-content ">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
            jobType={JobTypes.ctf_estimation}
          />
        )}

        {activeTab === "CTFFIND" && (
          <Ctf
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

export default CtfEstimation;
