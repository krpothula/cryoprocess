import React, { useState, useEffect } from "react";

import Io from "./Io";

import Ctf from "./Ctf";
import Optimisation from "./Optimization";

import Compute from "./Compute";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { FolderBrowserPopup } from "../common/FolderBrowser";
import { JobTypes } from "../common/Data/jobs";
import { threeDIntialModelAPI } from "../../../services/builders/3d-initialmodel/3d-initialmodel";
import { getParticleMetadataApi } from "../../../services/builders/jobs";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";

const initialState = {
  numberOfVdam: 200,
  regularisationParameter: 4,
  numberOfClasses: 1,
  maskDiameter: 200,
  numberOfPooledParticle: 3,
  numberOfMpiProcs: 1,
  numberOfThreads: 1,
  minimumDedicatedcoresPerNode: 1,

  // imagesStarFile: "",
  // continue: "",

  ctfCorrection: "Yes",
  igonreCtf: "No",
  nonNegativeSolvent: "Yes",
  Symmetry: "C1",
  runInC1: "Yes",
  Useparalleldisc: "Yes",
  preReadAllParticles: "No",
  copyParticle: "",
  combineIterations: "No",
  GpuAcceleration: "No",
  gpuToUse: "",
  submitToQueue: "Yes",
  queuename: "",
  queueSubmitCommand: "",
  // StandardSubmissionScript: "",
  additionalArguments: "",
};

const InitialModal = () => {
  const [activeTab, setActiveTab] = useState("I/O");
  const [isLoading, setLoading] = useState(false);
  const [formData, setFormData] = useState(initialState);
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open
  const [message, setMessage] = useState("");
  const [particleMetadata, setParticleMetadata] = useState(null);

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

  // Auto-fetch particle metadata when input file is selected
  useEffect(() => {
    if (!formData.inputStarFile || !projectId) {
      setParticleMetadata(null);
      return;
    }

    getParticleMetadataApi(projectId, formData.inputStarFile)
      .then((response) => {
        const data = response?.data?.data;
        if (data?.metadata) {
          setParticleMetadata(data.metadata);

          // Auto-fill mask diameter if it's still at default and we have a suggestion
          if (data.metadata.suggested_mask_diameter > 0 && formData.maskDiameter === 200) {
            setFormData(prev => ({
              ...prev,
              maskDiameter: data.metadata.suggested_mask_diameter
            }));
          }
        }
      })
      .catch(() => {
        // Silently fail - metadata is optional
        setParticleMetadata(null);
      });
  }, [formData.inputStarFile, projectId]);

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

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    threeDIntialModelAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess();
        }, 2000);
      })
      .catch((error) => {
        setMessage(
          `Error: ${
            error?.response?.data?.error ||
            error.response?.data?.message ||
            DefaultMessages.processError
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
      <div className="tabs-container ">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>

        <button
          className={activeTab === "CTF" ? "active-tab" : ""}
          onClick={() => handleTabChange("CTF")}
        >
          CTF
        </button>
        <button
          className={activeTab === "Optimisation" ? "active-tab" : ""}
          onClick={() => handleTabChange("Optimisation")}
        >
          Optimisation
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

      <form onSubmit={handleSubmit} className="form-content">
        {activeTab === "I/O" && (
          <Io
            formData={formData}
            handleInputChange={handleInputChange}
            setFilePopup={setFilePopup}
            jobType={JobTypes["3d_initial_model"]}
          />
        )}

        {activeTab === "CTF" && (
          <Ctf
            formData={formData}
            handleInputChange={handleInputChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Optimisation" && (
          <Optimisation
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            particleMetadata={particleMetadata}
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
          className={`px-5 pl-0 m-0 ${
            message?.includes("Error") ? "text-danger" : ""
          }`}
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

export default InitialModal;
