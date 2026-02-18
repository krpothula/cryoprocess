import React, { useState, useEffect } from "react";
import Duplicates from "./Duplicates";
import Io from "./Io";
import Subsets from "./Subsets";
import ClassOption from "./ClassOption";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { JobTypes } from "../common/Data/jobs";
import { useBuilder } from "../../../context/BuilderContext";
import { subsetSelectionAPI } from "../../../services/builders/subset/subset";
import { DefaultMessages } from "../common/Data";

const Subset = () => {
  const initialFormData = {
    micrographsStar: "",
    particlesStar: "",
    select2DClass: "No",

    minThresholdAutoSelect: 0.5,
    manyParticles: -1,
    manyClasses: -1,
    approxNr: 1,
    sigmaValue: 4,
    subsetSize: 100,
    numberSubsets: -1,
    minParticleDistance: 30,
    pixelSizeExtraction: -1,

    classAverages: "Yes",
    regroupParticles: "No",
    metaDataValues: "No",
    metaDataLabel: "",
    minMetaData: "",
    maxMetaData: "",
    imageStatics: "No",
    metaDataForImage: "",
    split: "No",
    randomise: "No",
    removeDuplicates: "No",

    submitToQueue: "No",
    queueName: "",
    // submissionScript: '',
    additionalArguments: "",
  };

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
    setLoading(true);
    // Debug: log form data before submission
    subsetSelectionAPI({ ...(formData || {}), project_id: projectId })
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

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];

  return (
    <div className="container">
      {/* Tabs */}
      <div className="tabs-container ">
        <button
          className={activeTab === "I/O" ? "active-tab " : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Class Options" ? "active-tab" : ""}
          onClick={() => handleTabChange("Class Options")}
        >
          Class Options
        </button>
        <button
          className={activeTab === "Subsets" ? "active-tab" : ""}
          onClick={() => handleTabChange("Subsets")}
        >
          Subsets
        </button>
        <button
          className={activeTab === "Duplicates" ? "active-tab" : ""}
          onClick={() => handleTabChange("Duplicates")}
        >
          Duplicates
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
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            jobType={JobTypes["subset_selection"]}
          />
        )}
        {activeTab === "Class Options" && (
          <ClassOption
            formData={formData}
            dropdownOptions={dropdownOptions}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
          />
        )}
        {activeTab === "Subsets" && (
          <Subsets
            formData={formData}
            dropdownOptions={dropdownOptions}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
          />
        )}
        {activeTab === "Duplicates" && (
          <Duplicates
            formData={formData}
            dropdownOptions={dropdownOptions}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
          />
        )}
        {activeTab === "Running" && (
          <Running
            formData={formData}
            dropdownOptions={dropdownOptions}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
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
          className={`px-5 pl-0 m-0 ${
            message?.includes("Error") ? "text-danger" : ""
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default Subset;
