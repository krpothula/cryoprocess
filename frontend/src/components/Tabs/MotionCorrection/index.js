import React, { useState, useEffect } from "react";
import Io from "./Io";
import Motion from "./Motion";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import CommandPreview from "../common/CommandPreview";
import { motionCorrectionAPI } from "../../../services/builders/motion/motion";
import { useBuilder } from "../../../context/BuilderContext";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { DefaultMessages } from "../common/Data";
import { JobTypes } from "../common/Data/jobs";
import { getSoftwareConfig } from "../../../services/softwareConfig";
import useToast from "../../../hooks/useToast";

const MotionCorrection = () => {
  const initialFormData = {
    // inputMovies: '',

    firstFrame: 1,
    lastFrame: -1,
    dosePerFrame: 1,
    preExposure: 0,
    eerFractionation: 32,
    savePowerSpectra: "No",
    sumPowerSpectra: "",
    bfactor: 150,
    groupFrames: 1,
    binningFactor: 1,
    binningFrame: 1,

    threads: 1,
    coresPerNode: 1,
    runningmpi: 1,
    patchesX: 1,
    patchesY: 1,

    float16Output: "Yes",
    doseWeighting: "Yes",
    nonDoseWeighted: "No",
    // savesum: "No",
    powerSpectraEvery: 4,
    //  gainReferenceImage: '',
    gainRotation: "No rotation (0)",
    gainFlip: "No flipping (0)",
    //  defectFile: '',
    useRelionImplementation: "Yes",
    // motioncore: "",
    // gpu: "",
    // othermotion: "",
    submitToQueue: "Yes",

    queuename: "",
    queueSubmitCommand: "",
    //  submissionScript: "",
    arguments: "",
  };
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setLoading] = useState(false);
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");
  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();
  const [softwareConfig, setSoftwareConfig] = useState({});
  const showToast = useToast();

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

  // Fetch software config from .env on mount
  useEffect(() => {
    getSoftwareConfig()
      .then((response) => {
        if (response?.data) {
          setSoftwareConfig(response.data);
        }
      })
      .catch((error) => {
        // Silently ignore 401 errors (user not logged in yet)
        if (error?.response?.status !== 401) {
          console.error("Failed to load software config:", error);
        }
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

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
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
      const { name, value } = e.target;

      // When switching to MotionCor2, auto-disable incompatible options
      if (name === "useRelionImplementation" && value === "No") {
        setFormData({
          ...formData,
          [name]: value,
          float16Output: "No",      // MotionCor2 cannot write float16
          savePowerSpectra: "No",   // MotionCor2 doesn't support power spectra
        });
        showToast("Float16 output and power spectra have been disabled — not supported by MotionCor2", { autoClose: 4000 });
        return;
      }

      setFormData({
        ...formData,
        [name]: value,
      });
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    motionCorrectionAPI({ ...(formData || {}), project_id: projectId })
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

    // try {
    //   // API call for main form submission
    //   const formResponse = await axios.post("api/motioncorrection/", formData);
    //   setMessage(`Success: ${formResponse.data.message}`);

    //   // API call for SLURM data submission
    //   const slurmResponse = await axios.post(
    //     "api/motioncorrection-slurm/",
    //     slurmData
    //   );
    //   setMessage((prev) => `${prev} | ${slurmResponse.data.message}`);
    //   setFormData(initialFormData);

    //   // Resetting states
    //   setFormData(initialFormData);
    // } catch (error) {
    //   // setMessage(`Error: ${error?.response?.data?.message}`);
    // }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];

  const gainRotationOptions = [
    { label: "No rotation (0)", value: "No rotation (0)" },
    { label: "Rotate 90°", value: "Rotate 90°" },
    { label: "Rotate 180°", value: "Rotate 180°" },
    { label: "Rotate 270°", value: "Rotate 270°" },
  ];
  const gainFlipOptions = [
    { label: "No flipping (0)", value: "No flipping (0)" },
    { label: "Flip horizontally", value: "Flip horizontally" },
    { label: "Flip vertically", value: "Flip vertically" },
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
          className={activeTab === "Motion" ? "active-tab" : ""}
          onClick={() => handleTabChange("Motion")}
        >
          Motion
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      <form onSubmit={handleSubmit} className="form-content !h-auto">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
            jobType={JobTypes.motion_correction}
          />
        )}

        {activeTab === "Motion" && (
          <Motion
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            gainRotationOptions={gainRotationOptions}
            gainFlipOptions={gainFlipOptions}
            setFilePopup={setFilePopup}
            softwareConfig={softwareConfig}
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
          previewComponent={
            <CommandPreview
              formData={formData}
              jobType={JobTypes.motion_correction}
              projectId={projectId}
            />
          }
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
          extensions={
            filePopupField === "gainReferenceImage" ? ".mrc,.gain" :
            filePopupField === "defectFile" ? ".txt,.star" :
            ""
          }
          title={
            filePopupField === "gainReferenceImage" ? "Select Gain Reference" :
            filePopupField === "defectFile" ? "Select Defect File" :
            "Browse Project Files"
          }
        />
      )}
    </div>
  );
};

export default MotionCorrection;
