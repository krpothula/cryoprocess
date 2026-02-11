import React, { useState, useEffect } from "react";
import Io from "./Io";
import Hmmer from "./Hmmer";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { modelAngeloAPI } from "../../../services/builders/model-angelo/model-angelo";
import { DefaultMessages } from "../common/Data";
import { useBuilder } from "../../../context/BuilderContext";
import { getSoftwareConfig } from "../../../services/softwareConfig";

const initialFormData = {
  modelAngeloExecutable: "",
  bFactorSharpenedMap: "",
  fastaProtein: "",
  fastaDNA: "",
  fastaRNA: "",
  gpuToUse: 0,
  // HMMER search parameters
  performHmmerSearch: "No",
  hmmerSequenceLibrary: "",
  hmmerAlphabet: "amino",
  hmmerF1: 0.02,
  hmmerF2: 0.001,
  hmmerF3: 0.00001,
  hmmerE: 10,
  // Running parameters
  coresPerNode: 0,
  threads: 1,
  submitToQueue: "Yes",
  queueName: "",
  queueSubmitCommand: "",
  arguments: "",
};

const ModelAngelo = () => {
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

  // Load ModelAngelo executable path from .env via API on mount
  useEffect(() => {
    getSoftwareConfig()
      .then((response) => {
        const modelAngeloPath = response?.data?.data?.modelangelo_exe || "relion_python_modelangelo";
        if (modelAngeloPath) {
          setFormData((prev) => ({
            ...prev,
            modelAngeloExecutable: modelAngeloPath,
          }));
        }
      })
      .catch((error) => {
        console.error("Failed to load software config:", error);
        // Set default value on error
        setFormData((prev) => ({
          ...prev,
          modelAngeloExecutable: "relion_python_modelangelo",
        }));
      });
  }, []);

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

    modelAngeloAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.();
        }, 2000);
      })
      .catch((error) => {
        console.error("ModelAngelo Error:", error);
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
          className={activeTab === "Hmmer" ? "active-tab" : ""}
          onClick={() => handleTabChange("Hmmer")}
        >
          Hmmer
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
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Hmmer" && (
          <Hmmer
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

export default ModelAngelo;




/*import React, { useState } from "react";
import axios from "axios";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import Io from "./Io";
import Hmmer from "./Hmmer";

const ModelAngelo = () => {
  const initialFormData = {
    modelAngeloExecutable: "relion_python_modelangelo",
    corespernode: 0,
    threads: 1,
    submitToQueue: "Yes",
    queuename: "",
    queueSubmitCommand: "",
    //StandardSubmissionScript: "",
    arguments: "",
    gpuToUse: 0,
    peformHmmerSearch: "No",
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
      })
      .catch((error) => {
        // Handle error response from the API
        setMessage(`Error: ${error.response.data.message}`);
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
          className={activeTab === "Hmmer" ? "active-tab" : ""}
          onClick={() => handleTabChange("Hmmer")}
        >
          Hmmer
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
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Hmmer" && (
          <Hmmer
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

export default ModelAngelo;
*/