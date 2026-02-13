import React, { useState, useEffect } from "react";
import Io from "./Io";
import Train from "./Train";
import Polish from "./Polish";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { JobTypes } from "../common/Data/jobs";
import { DefaultMessages } from "../common/Data";
import { bayesianPolishingAPI } from "../../../services/builders/bayesian-polishing/bayesian-polishing";
import { useBuilder } from "../../../context/BuilderContext";

const initialFormData = {
  optimalParameters: "No",
  firstMovieFrame: 1,
  lastMovieFrame: -1,      // -1 = use all frames (RELION default)
  extractionSize: -1,      // -1 = auto-detect from particle size
  rescaledSize: -1,        // -1 = keep original size
  fractions: 0.5,          // Fraction of Fourier pixels for testing
  manyParticles: 5000,     // Number of particles for training
  fractionFourierPixels: 0.5,
  useParticles: 10000,     // RELION GUI default
  // Polish parameters
  optimisedParameterFile: "",
  sigmaVelocity: 0.2,      // RELION GUI default velocity sigma (A/dose)
  sigmaDivergence: 5000,   // Default divergence sigma (A)
  sigmaAcceleration: 2,    // Default acceleration sigma (A/dose)
  minResolutionBfac: 20,   // B-factor fit min resolution (A)
  maxResolutionBfac: -1,   // B-factor fit max resolution (-1 = auto from FSC)
  // Running parameters
  mpiProcs: 1,
  threads: 1,
  minCoresPerNode: 1,
  performParticle: "Yes",
  particlePolishing: "Yes",
  ownParams: "No",
  submitToQueue: "Yes",
  float16: "Yes",
  queueName: "",
  queueSubmitCommand: "",
  addArguments: "",
};

const Bayesian = () => {
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

  // Updated to match AutoPicker / CtfRefine structure
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    bayesianPolishingAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.();
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
          className={activeTab === "Train" ? "active-tab" : ""}
          onClick={() => handleTabChange("Train")}
        >
          Train
        </button>
        <button
          className={activeTab === "Polish" ? "active-tab" : ""}
          onClick={() => handleTabChange("Polish")}
        >
          Polish
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
            jobType={JobTypes.bayesian_polishing}
          />
        )}

        {activeTab === "Train" && (
          <Train
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Polish" && (
          <Polish
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            jobType={JobTypes.bayesian_polishing}
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

export default Bayesian;












/*import React, { useEffect, useState } from "react";
import axios from "axios";

import Io from "./Io";
import Train from "./Train";
import Polish from "./Polish";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { JobTypes } from "../common/Data/jobs";

const Bayesian = () => {
  const initialFormData = {
    optimalParameters: "No",
    firstMovieFrame: 1,
    lastMovieFrame: 1,
    extractionSize: 1,
    rescaledSize: 1,
    fractions: 1,
    manyParticles: 1,
    velocity: 0.02,
    divergence: 5000,
    accelerations: 2,
    minResolution: 20,
    maxResolution: -1,
    mpiProcs: 0,
    threads: 0,
    minCoresPerNode: 0,
    performParticle: "Yes",
    ownParams: "No",
    submitToQueue: "Yes",
    float16: "Yes",
    queueName: "",
    queueSubmitCommand: "",
    //submissionScript: "",
    addArguments: "",
  };
  const isFormFilled = () => {
    const requiredFields = Object.keys(formData).filter((key) => {
      return !key.includes("File") && typeof formData[key] !== "undefined";
    });

    const fieldsFilled = requiredFields.every((key) => {
      const value = formData[key];
      if (typeof value === "object" && value !== null) {
        return Object.values(value).every(
          (innerValue) =>
            innerValue !== "" && innerValue !== null && innerValue !== undefined
        );
      }
      return value !== "" && value !== null && value !== undefined;
    });

    return fieldsFilled;
  };

  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");

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
    setFormData(initialFormData);
    axios
      .post("api/import/", formData)
      .then((response) => {
        setMessage(`Success: ${response.data.message}`);
      })
      .catch((error) => {
        // Handle error response from the API
        setMessage(`Error: ${error?.response?.data?.message || 'An error occurred'}`);
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
     
      <div className="tabs-container ">
        <button
          className={activeTab === "I/O" ? "active-tab " : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Train" ? "active-tab" : ""}
          onClick={() => handleTabChange("Train")}
        >
          Train
        </button>
        <button
          className={activeTab === "Polish" ? "active-tab" : ""}
          onClick={() => handleTabChange("Polish")}
        >
          Polish
        </button>

        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      
      <form onSubmit={handleSubmit} className="form-content h-[485px]">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            jobType={JobTypes.bayesian_polishing}
          />
        )}
        {activeTab === "Train" && (
          <Train
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Polish" && (
          <Polish
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
        />
      </form>

      {message && <p>{message}</p>}
    </div>
  );
};

export default Bayesian;*/
