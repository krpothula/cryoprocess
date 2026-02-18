import React, { useState, useEffect } from "react";
import Io from "./Io";
import Mas from "./Mas";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { DefaultMessages } from "../common/Data";
import { useBuilder } from "../../../context/BuilderContext";
import { maskCreationAPI } from "../../../services/builders/mask-creation/mask-creation";
import { JobTypes } from "../common/Data/jobs";

const initialFormData = {
  // I/O
  inputMap: "",
  // Mask parameters (matching backend field names)
  lowpassFilter: 15,
  angpix: -1,  // -1 means use header value
  initialThreshold: 0.004,  // Lower default - most maps have max values around 0.02-0.05
  extendBinaryMask: 3,
  softEdgeWidth: 6,
  invertMask: "No",
  fillWithSpheres: "No",
  sphereRadius: 10,
  // Running
  coresPerNode: 1,
  threads: 1,
  submitToQueue: "No",
  queueName: "",
  additionalArguments: "",
};

const Mask = () => {
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

  // Unified handleSubmit (same as Bayesian, Dynamight, etc.)
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    maskCreationAPI({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        setTimeout(() => {
          onJobSuccess?.(); // callback on success
        }, 2000);
      })
      .catch((error) => {
        console.error("Mask Creation Error:", error);
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
      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={activeTab === "I/O" ? "active-tab" : ""}
          onClick={() => handleTabChange("I/O")}
        >
          I/O
        </button>
        <button
          className={activeTab === "Mask" ? "active-tab" : ""}
          onClick={() => handleTabChange("Mask")}
        >
          Mask
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
            dropdownOptions={dropdownOptions}
            jobType={JobTypes.mask_creation}

          />
        )}

        {activeTab === "Mask" && (
          <Mas
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

export default Mask;






/*import React, { useState } from "react";
import axios from "axios";
import Io from "./Io";
import Mas from "./Mas";
import Helix from "./Helix";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";

const Mask = () => {
  const initialFormData = {
    // map: "",

    filtermap: 15,
    pixelSize: -1,
    binarisation: 0.02,
    extendBinaryMap: 3,
    softEdge: 3,
    centralZLength: 30,
    corespernode: 0,
    threads: 1,
    mask3DHelix: "No",
    submitToQueue: "Yes",
    queueName: "",
    queueSubmitCommand: "",
    //StandardSubmissionScript: "",
    arguments: "",
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
  const isEnable = formData.mask3DHelix === "Yes";
  const isEnable1 = formData.submitToQueue === "Yes";
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
          className={activeTab === "Mask" ? "active-tab" : ""}
          onClick={() => handleTabChange("Mask")}
        >
          Mask
        </button>
        <button
          className={activeTab === "Helix" ? "active-tab" : ""}
          onClick={() => handleTabChange("Helix")}
        >
          Helix
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
        {activeTab === "Mask" && (
          <Mas
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
          />
        )}
        {activeTab === "Helix" && (
          <Helix
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

export default Mask;*/
