import React, { useState, useEffect } from "react";
import Io from "./Io";
import Relion from "./Relion";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { localResolutionAPI } from "../../../services/builders/local-resolution/local-resolution";
import { DefaultMessages } from "../common/Data";
import { useBuilder } from "../../../context/BuilderContext";

const initialFormData = {
  calibratedPixelSize: 1,
  numberOfMpiProcs: 1,
  bFactor: -100,
  useRelion: "Yes",
  submitToQueue: "No",
  queuename: "",
  queueSubmitCommand: "",
  additionalArguments: "",
  runningmpi: 1,
  threads: 1,
  gres: 0,
  clustername: "",
  arguments: "",
};

const LocalResolution = () => {
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");
  const [isLoading, setLoading] = useState(false);

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

  // Handle text/file input
  const handleInputChange = (e) => {
    if (e.target.files) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData({
            ...formData,
            [e.target.name]: reader.result,
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

  // Handle numeric input/range
  const handleRangeChange = (e) => {
    const { value, name } = e.target;
    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      alert("Please enter a valid number.");
    }
  };

  // Form submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    localResolutionAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.();
        }, 2000);
      })
      .catch((error) => {
        console.error("Local Resolution Error:", error);
        setMessage(
          `Error: ${
            error.response?.data?.message || DefaultMessages.processError
          }`
        );
      })
      .finally(() => {
        setLoading(false);
      });
  };

  const handleTabChange = (tab) => setActiveTab(tab);

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];

  return (
    <div className="container">
      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Relion" ? "active-tab" : ""}
          onClick={() => handleTabChange("Relion")}
        >
          Relion
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} className="form-content">
        {activeTab === "I/O" && (
          <Io
            handleRangeChange={handleRangeChange}
            handleInputChange={handleInputChange}
            formData={formData}
          />
        )}

        {activeTab === "Relion" && (
          <Relion
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
        <p className={`px-5 ${message?.includes("Error") ? "text-danger" : ""}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default LocalResolution;
