import React, { useState, useEffect } from "react";
import Io from "./Io";
import Centering from "./Centering";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { particleSubtractionAPI } from "../../../services/builders/particle-subtraction/particle-subtraction.js";
import { DefaultMessages } from "../common/Data";
import { useBuilder } from "../../../context/BuilderContext";
import { JobTypes } from "../common/Data/jobs";


const initialFormData = {
  differentParticles: "No",
  outputInFloat16: "Yes",
  revertToOriginal: "No",
  subtractedImages: "No",
  centerCoordinates: "No",
  coordinateX: 0,
  coordinateY: 0,
  coordinateZ: 0,
  newBoxSize: -1,
  mpiProcs: 1,
  coresPerNode: 1,
  submitToQueue: "No",
  queueName: "",
  additionalArguments: "",
};

const ParticleSubtraction = () => {
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

  const handleRangeChange = (e) => {
    const { value, name } = e.target;
    const numericValue = Number(value);
    if (!isNaN(numericValue)) {
      setFormData((prev) => ({ ...prev, [name]: numericValue }));
    } else {
      alert("Please enter a valid number.");
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    particleSubtractionAPI({ ...(formData || {}), projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.();
        }, 2000);
      })
      .catch((error) => {
        console.error("Particle Subtraction Error:", error);
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
      <div className="tabs-container w-[30%] gap-2 text-nowrap">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Centering" ? "active-tab" : ""}
          onClick={() => handleTabChange("Centering")}
        >
          Centering
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      {/* Form */}
      <form onSubmit={handleSubmit} noValidate className="form-content">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            jobType={JobTypes.particle_subtraction}
          />
        )}

        {activeTab === "Centering" && (
          <Centering
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

export default ParticleSubtraction;





/*import React, { useEffect, useState } from "react";
import axios from "axios";
import Io from "./Io";
import Centering from "./Centering";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";

const ParticleSubtraction = () => {
  const initialFormData = {
    //  optimiserStar: "",
    //  maskOfSignal: "",
    differentParticles: "No",
    //  inputPArticlesStar: "",
    outputInFloat16: "Yes",
    revertToOriginal: "No",
    //  revertThsPArticles: "",
    subtractedImages: "No",
    centerCoordinates: "No",

    coordinateX: 0,
    coordinateY: 0,
    coordinateZ: 0,
    newBoxSize: -1,
    mpiProcs: 1,
    coresPerNode: 1,
    pixelSize: -1,

    submitToQueue: "Yes",
    queueName: "",
    queueSubmitCommand: "",

    additionalArguments: "",
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
        setFormData(initialFormData);
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
  const isEnable = formData.differentParticles === "Yes";
  const isEnable1 = formData.revertToOriginal === "Yes";
  const isEnable2 = formData.subtractedImages === "Yes";
  const isEnable3 = formData.submitToQueue === "Yes";
  return (
    <div className="">
      <div className="tabs-container w-[30%] gap-2  text-nowrap">
        <button
          className={activeTab === "I/O" ? "active-tab " : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Centering" ? "active-tab" : ""}
          onClick={() => handleTabChange("Centering")}
        >
          Centering
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>
      <form onSubmit={handleSubmit} noValidate className="form-content">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Centering" && (
          <Centering
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

export default ParticleSubtraction;*/
