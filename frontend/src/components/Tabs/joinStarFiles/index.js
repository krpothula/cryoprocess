import React, { useState, useEffect } from "react";
import Running from "./Running";
import Micrographs from "./Micrographs";
import Movies from "./Movies";
import Particles from "./Particles";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { joinStarFilesAPI } from "../../../services/builders/join-star-files/join-star-files";
import { useBuilder } from "../../../context/BuilderContext"; 

const initialFormData = {
  combineParticles: "No",
  combineMicrographs: "No",
  combineMovies: "No",
  minCoresPerNode: 1,
  submitToQueue: "No",
  queueName: "",
  queueSubmitCommand: "",
  additionalArguments: "",
};

const JoinStarFiles = ({ projectId: propProjectId, onJobSuccess: propOnJobSuccess }) => {
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("Particles");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  // Use context if available, otherwise fall back to props
  const { projectId: contextProjectId, onJobSuccess: contextOnJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder() || {};
  const projectId = propProjectId || contextProjectId;
  const onJobSuccess = propOnJobSuccess || contextOnJobSuccess;

  // Load copied job parameters when available
  useEffect(() => {
    if (copiedJobParams && Object.keys(copiedJobParams).length > 0) {
      setFormData(prev => ({ ...prev, ...copiedJobParams }));
      setTimeout(() => clearCopiedJobParams?.(), 100);
    }
  }, [copiedJobParams, clearCopiedJobParams]);

  // Auto-populate inputs from tree job selection
  useEffect(() => {
    if (autoPopulateInputs && Object.keys(autoPopulateInputs).length > 0) {
      setFormData(prev => ({ ...prev, ...autoPopulateInputs }));
      setTimeout(() => clearAutoPopulate?.(), 100);
    }
  }, [autoPopulateInputs, clearAutoPopulate]);

  // Mutual exclusivity: only one of Particles/Micrographs/Movies can be "Yes"
  const combineFields = ['combineParticles', 'combineMicrographs', 'combineMovies'];

  const handleInputChange = (e) => {
    if (e.target.files) {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setFormData((prev) => ({
            ...prev,
            [e.target.name]: reader.result,
          }));
        };
        reader.readAsDataURL(file);
      }
    } else {
      const { name, value } = e.target;

      // When setting a combine field to "Yes", reset the others to "No"
      if (combineFields.includes(name) && value === "Yes") {
        setFormData((prev) => {
          const updated = { ...prev, [name]: value };
          combineFields.forEach((field) => {
            if (field !== name) updated[field] = "No";
          });
          return updated;
        });
      } else {
        setFormData((prev) => ({
          ...prev,
          [name]: value,
        }));
      }
    }
  };

  const handleRangeChange = (e) => {
    const { name, value } = e.target;
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    joinStarFilesAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.();
        }, 2000);
      })
      .catch((error) => {
        console.error("Join Star Files Error:", error);
        setMessage(
          `Error: ${
            error.response?.data?.message 
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
          className={activeTab === "Particles" ? "active-tab" : ""}
          onClick={() => handleTabChange("Particles")}
        >
          Particles
        </button>
        <button
          className={activeTab === "Micrographs" ? "active-tab" : ""}
          onClick={() => handleTabChange("Micrographs")}
        >
          Micrographs
        </button>
        <button
          className={activeTab === "Movies" ? "active-tab" : ""}
          onClick={() => handleTabChange("Movies")}
        >
          Movies
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      {/* Form content */}
      <form onSubmit={handleSubmit} className="form-content">
        {activeTab === "Particles" && (
          <Particles
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Micrographs" && (
          <Micrographs
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Movies" && (
          <Movies
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
          loading={loading}
        />
      </form>

      {message && <p>{message}</p>}
    </div>
  );
};

export default JoinStarFiles;



/*import React, { useEffect, useState } from "react";
import axios from "axios";
import Running from "./Running";
import Micrographs from "./Micrographs";
import Movies from "./Movies";
import Particles from "./Particles";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";

const initialFormData = {
  combinePArticle: "No",
  micrograph: "No",
  combineMovie: "No",
  minCoresPerNode: 1,
  submitToQueue: "Yes",
  queueName: "",
  queueSubmitCommand: "",
  // submissionScript: '',
  additionalArguments: "",
};
const JoinStarFiles = () => {
  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("Particles");
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
    // if (activeTab === "Movies/Mics") {
    //   console.log("Form Data:", formData);
    // }
    // setFormData(initialFormData);
    axios
      .post("api/import/", formData)
      .then((response) => {
        setMessage(`Success: ${response.data.message}`);
      })
      .catch((error) => {
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
  const isEnable = formData.submitToQueue === "Yes";
  const particleEnable = formData.combinePArticle === "Yes";
  const micrographEnable = formData.micrograph === "Yes";
  const movieEnable = formData.combineMovie === "Yes";
  return (
    <div className="container">
      
      <div className="tabs-container">
        <button
          className={activeTab === "Particles" ? "active-tab " : ""}
          onClick={() => handleTabChange("Particles")}
        >
          Particles
        </button>
        <button
          className={activeTab === "Micrographs" ? "active-tab" : ""}
          onClick={() => handleTabChange("Micrographs")}
        >
          Micrographs
        </button>
        <button
          className={activeTab === "Movies" ? "active-tab" : ""}
          onClick={() => handleTabChange("Movies")}
        >
          Movies
        </button>

        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      
      <form onSubmit={handleSubmit} className="form-content ">
        {activeTab === "Particles" && (
          <Particles
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Movies" && (
          <Movies
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Micrographs" && (
          <Micrographs
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

export default JoinStarFiles;*/
