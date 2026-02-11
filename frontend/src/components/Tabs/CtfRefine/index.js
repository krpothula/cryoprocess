import React, { useState, useEffect } from "react";
import Io from "./Io";
import Fit from "./Fit";
import Running from "./Running";
import { JobTypes } from "../common/Data/jobs";
import "../../form.css";
import { ctfRefinementAPI } from "../../../services/builders/ctf-refinement/ctf-refinement";
import SubmitButton from "../common/SubmitButton";
import { DefaultMessages } from "../common/Data";
import { useBuilder } from "../../../context/BuilderContext";

const initialFormData = {
  // I/O
  particlesStar: "",
  postProcessStar: "",

  // Fit parameters
  estimateMagnification: "No",
  ctfParameter: "No",
  fitDefocus: "No",
  fitAstigmatism: "No",
  fitBFactor: "No",
  fitPhaseShift: "No",
  estimateBeamtilt: "No",
  estimateTreFoil: "No",
  aberrations: "No",
  minResolutionFits: 30,

  // Running parameters
  mpiProcs: 1,
  threads: 1,
  minCoresPerNode: 1,
  submitToQueue: "Yes",
  queueName: "",
  queueSubmitCommand: "",
  addArguments: "",
};

const CtfRefine = () => {
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
    if (!e || !e.target) return;
    const { value, name } = e.target;
    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      setFormData((prev) => ({
        ...prev,
        [name]: numericValue,
      }));
    } else {
      alert("Please enter a valid number.");
    }
  };

  // Consistent AutoPicker-style submit
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    ctfRefinementAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.(); // callback when job completes
        }, 2000);
      })
      .catch((error) => {
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

  const handleTabChange = (tab) => {
    setActiveTab(tab);
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
          className={activeTab === "Fit" ? "active-tab" : ""}
          onClick={() => handleTabChange("Fit")}
        >
          Fit
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
            jobType={JobTypes.ctf_refinement}
          />
        )}

        {activeTab === "Fit" && (
          <Fit
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
        <p
          className={`px-5 ${message.includes("Error") ? "text-danger" : ""}`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default CtfRefine;