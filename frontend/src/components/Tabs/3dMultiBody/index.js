import React, { useState, useEffect } from "react";

import Io from "./Io";
import Compute from "./Compute";
import Running from "./Running";
import Analyse from "./Analyse";
import AutoSampling from "./AutoSampling";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { JobTypes } from "../common/Data/jobs";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { threeDMultiBodyAPI } from "../../../services/builders/3d-multibody/3d-multibody";

const initialState = {
  initialOffsetRange: 3,
  initialOffsetStep: 1.5,
  numberOfEigenvectorMovies: 3,
  eigenValue: 1,
  minEigenValue: -999,
  maxEigenValue: 999,
  mpiProcs: 1,
  threads: 1,
  coresPerNode: 1,
  pooledParticles: 3,
  bodyStarFile: "",
  // consensusRefinement:'',
  // continue:'',
  reconstructSubtracted: "Yes",
  blushRegularisation: "No",
  initialAngularSampling: "1.8 degrees",
  runFlexibility: "Yes",
  selectParticlesEigenValue: "No",
  useParallelIO: "Yes",
  skipPadding: "No",
  preReadAllParticles: "No",
  copyParticle: "",
  combineIterations: "No",
  gpuAcceleration: "No",
  gpuToUse: "",
  submitToQueue: "Yes",
  queueName: "",
  //StandardSubmissionScript: "",
  additionalArguments: "",
};

const MultiBody = () => {
  const [activeTab, setActiveTab] = useState("I/O");
  const [formData, setFormData] = useState(initialState);
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
    threeDMultiBodyAPI({ ...(formData || {}), project_id: projectId })
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
  const degreeOptions = [
    { label: "7.5 degrees", value: "7.5 degrees" },
    { label: "1.8 degrees", value: "1.8 degrees" },
  ];
  return (
    <div className="container">
      <div className="tabs-container ">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>

        <button
          className={activeTab === "Auto-sampling" ? "active-tab" : ""}
          onClick={() => handleTabChange("Auto-sampling")}
        >
          Auto-sampling
        </button>
        <button
          className={activeTab === "Analyse" ? "active-tab" : ""}
          onClick={() => handleTabChange("Analyse")}
        >
          Analyse
        </button>

        <button
          className={activeTab === "Compute" ? "active-tab" : ""}
          onClick={() => handleTabChange("Compute")}
        >
          Compute
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
            dropdownOptions={dropdownOptions}
            jobType={JobTypes["3d_multi_body"]}
          />
        )}

        {activeTab === "Auto-sampling" && (
          <AutoSampling
            formData={formData}
            handleInputChange={handleInputChange}
            degreeOptions={degreeOptions}
          />
        )}

        {activeTab === "Analyse" && (
          <Analyse
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Compute" && (
          <Compute
            formData={formData}
            handleInputChange={handleInputChange}
            dropdownOptions={dropdownOptions}
            handleRangeChange={handleRangeChange}
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

export default MultiBody;
