import React, { useState, useEffect, useMemo } from "react";
import Io from "./Io";
import Ctf from "./Ctf";
import Optimization from "./Optimization";
import AutoSampling from "./AutoSampling";
import Compute from "./Compute";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { useBuilder } from "../../../context/BuilderContext";
import { twoDClassificationAPI } from "../../../services/builders/2d-classification/2d-classification";
import { getParticleMetadataApi } from "../../../services/builders/jobs";
import { DefaultMessages } from "../common/Data";
import { useFormValidation } from "../../../hooks/useFormValidation";
import { mustBePositive, mustBeAtLeast, vdamMiniBatchesRule, gpuIdsFormat } from "../../../utils/validationRules";

const intitalFormData = {
  ctfCorrection: "Yes",
  ignoreCTFs: "No",
  numberOfClasses: 1,
  regularisationParam: 2,
  numberEMIterations: 25,
  vdamMiniBatches: 200,
  maskDiameter: 200,
  limitResolutionEStep: -1,
  angularSearchRange: 6,
  offsetSearchRange: 5,
  offsetSearchStep: 1,
  tubeDiameter: 200,
  angularSearchpsi: 6,
  helicalRise: 4.75,
  pooledParticles: 3,
  mpiProcs: 1,
  threads: 1,
  coresPerNode: 1,
  useEM: "No",
  useVDAM: "Yes",
  maskParticlesWithZeros: "Yes",
  centerClassAverages: "Yes",
  performImageAlignment: "Yes",
  allowCoarseSampling: "No",
  classify2DHelical: "No",
  doBimodalAngular: "Yes",
  restrictHelicalOffsets: "Yes",
  useParallelIO: "Yes",
  preReadAllParticles: "No",
  copyParticlesToScratch: "",
  combineIterations: "No",
  gpuAcceleration: "No",
  useGPU: "",
  submitToQueue: "Yes",
  queueName: "",
  queueSubmitCommand: "",
  additionalArguments: "",
};
const DClassification = () => {
  const [formData, setFormData] = useState(intitalFormData);
  const [isLoading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState("I/O");
  const [message, setMessage] = useState("");
  const [particleMetadata, setParticleMetadata] = useState(null);
  const [maskHint, setMaskHint] = useState("");

  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

  // Validation rules
  const validationRules = useMemo(() => [
    mustBePositive('maskDiameter', 'Mask diameter'),
    { field: 'maskDiameter', validate: (v) => v && Number(v) > 500 ? { level: 'warning', message: 'Mask diameter >500 A is unusual' } : null },
    mustBeAtLeast('numberOfClasses', 'Number of classes', 1),
    vdamMiniBatchesRule(),
    mustBeAtLeast('numberEMIterations', 'EM iterations', 1),
    gpuIdsFormat('useGPU'),
  ], []);

  const { getFieldStatus, hasErrors: hasValidationErrors, errorCount } = useFormValidation(formData, validationRules);

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
      setMaskHint("");
      return;
    }

    getParticleMetadataApi(projectId, formData.inputStarFile)
      .then((response) => {
        const data = response?.data?.data;
        if (data?.metadata) {
          setParticleMetadata(data.metadata);
          setMaskHint(data.hint || "");

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
        setMaskHint("");
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

  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);
    twoDClassificationAPI({ ...(formData || {}), project_id: projectId })
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

  // Force MPI to 1 when VDAM is enabled (VDAM does not support multiple MPI processes)
  useEffect(() => {
    if (formData.useVDAM === "Yes") {
      setFormData(prev => ({ ...prev, runningmpi: 1, numberOfMpiProcs: 1, mpiProcs: 1 }));
    }
  }, [formData.useVDAM]);

  const handleTabChange = (tab) => {
    setActiveTab(tab);
    // onSelectTab(tab)
  };
  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];
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
          className={activeTab === "Sampling" ? "active-tab" : ""}
          onClick={() => handleTabChange("Sampling")}
        >
          Sampling
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
          />
        )}

        {activeTab === "CTF" && (
          <Ctf
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}

        {activeTab === "Optimisation" && (
          <Optimization
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            particleMetadata={particleMetadata}
            maskHint={maskHint}
            getFieldStatus={getFieldStatus}
          />
        )}

        {activeTab === "Sampling" && (
          <AutoSampling
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
          hasValidationErrors={hasValidationErrors}
          validationSummary={errorCount > 0 ? `${errorCount} parameter error${errorCount > 1 ? 's' : ''} must be fixed before submission` : null}
          previewComponent={
            formData.useVDAM === "Yes" ? (
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "10px 14px",
                  marginTop: "10px",
                  marginLeft: "5px",
                  backgroundColor: "#fef2f2",
                  border: "1px solid #fecaca",
                  borderRadius: "8px",
                  color: "#dc2626",
                  fontSize: "13px",
                  fontWeight: 500,
                  lineHeight: 1.4,
                }}
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#dc2626" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </svg>
                VDAM algorithm requires exactly 1 MPI process. Use threads and GPUs for parallelism.
              </div>
            ) : null
          }
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

export default DClassification;
