import React, { useState, useEffect } from "react";
import Io from "./Io";
import Display from "./Display";
import Colors from "./Colors";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { manualPickingAPI } from "../../../services/builders/manual-picking/manual-picking";

const ManualPicking = () => {
  const [activeTab, setActiveTab] = useState("I/O");

  const initialFormData = {
    // inputMicrographs: '',
    pickCoordinatesHelices: "No",
    useAutopickThreshold: "No",

    autopickFOM: 1,
    particleDiameter: 100,
    scaleForMicrographs: 0.2,
    sigmaContrast: 3,
    whiteValue: 0,
    blackValue: 0,
    lowpassFilter: 20,
    highpassFilter: -1,
    pixelSize: -1,
    blueValue: 0,
    redValue: 2,
    coresPerNode: 1,

    useTopaz: "No",
    // starfile: "",
    blueRedColorParticles: "No",
    metadataLabel: "",
    submitToQueue: "Yes",
    queueName: "",
  };

  // Relion parameters state
  const [formData, setFormData] = useState(initialFormData);
  const [isLoading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open


  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

  // Load copied job parameters when available
  useEffect(() => {
    if (copiedJobParams && Object.keys(copiedJobParams).length > 0) {
      setFormData(prev => ({ ...prev, ...copiedJobParams }));
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

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];

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
  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };
  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    setLoading(true);
    manualPickingAPI({ ...(formData || {}), project_id: projectId })
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

    // console.log(formData, "formData");
    // setFormData(initialFormData);

    // const combinedData = {
    //   relion: formData,
    //   slurm: slurmData,
    // };

    // try {
    //   const response = await axios.post("/api/manualpicker/", combinedData);
    //   setFormData(initialFormData);
    //   console.log("Success:", response.data);
    // } catch (error) {
    //   console.error("Error submitting the form:", error);
    // }
  };

  return (
    <div className="container">
      {/* Tab Headers */}
      <div className="tabs-container ">
        <button
          onClick={() => handleTabChange("I/O")}
          className={activeTab === "I/O" ? "active-tab" : ""}
        >
          I/O
        </button>
        <button
          onClick={() => handleTabChange("Display")}
          className={activeTab === "Display" ? "active-tab" : ""}
        >
          Display
        </button>
        <button
          onClick={() => handleTabChange("Colors")}
          className={activeTab === "Colors" ? "active-tab" : ""}
        >
          Colors
        </button>
        <button
          onClick={() => handleTabChange("Running")}
          className={activeTab === "Running" ? "active-tab" : ""}
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
          />
        )}

        {activeTab === "Display" && (
          <Display
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Colors" && (
          <Colors
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
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

      {!!filePopupField && (
        <FolderBrowserPopup
          onClose={() => setFilePopup("")}
          onFileSelect={(file) => {
            handleFormDataChange({
              [filePopupField]: file ? file.path : "",
            });
            setFilePopup("");
          }}
          extensions={filePopupField === "starfileWithColorLabel" ? ".star" : ""}
          title={filePopupField === "starfileWithColorLabel" ? "Select STAR File" : "Browse Project Files"}
        />
      )}
    </div>
  );
};

export default ManualPicking;
