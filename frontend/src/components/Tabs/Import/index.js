import React, { useState, useEffect } from "react";
import Movies from "./Movies";
import Other from "./Other";
import Running from "./Running";
import "../../form.css";
import SubmitButton from "../common/SubmitButton";
import { submitImport } from "../../../services/jobs";
import { useBuilder } from "../../../context/BuilderContext";
import { DefaultMessages } from "../common/Data";
import { FolderBrowserPopup } from "../common/FolderBrowser";

const Import = () => {
  const initialFormData = {
    rawMovies: "Yes",
    //   input_files: '',
    multiframemovies: "Yes",
    // mtf: "",

    angpix: 1.4,
    kV: 300,
    spherical: 2.7,
    amplitudeContrast: 0.1,
    beamtilt_x: 0,
    beamtilt_y: 0,
    coresPerNode: 1,

    nodetype: "No",
    // otherInputFile: "",
    otherNodeType: "3D reference",
    renameopticsgroup: "",
    opticsgroupname: "",
    submitToQueue: "Yes",
    queueName: "",
    queueSubmitCommand: "",

    argument: "",
  };

  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("Movies/Mics");
  const [message, setMessage] = useState("");
  const [isLoading, setLoading] = useState(false);
  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();
  const [filePopupField, setFilePopup] = useState(""); // set field name for which file browser is open

  // Load copied job parameters when available
  useEffect(() => {

    if (copiedJobParams && Object.keys(copiedJobParams).length > 0) {
      setFormData((prev) => {
        const newFormData = {
          ...prev,
          ...copiedJobParams,
        };
        return newFormData;
      });
      clearCopiedJobParams();
    } else {
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
      const { name, value } = e.target;

      // Mutual exclusivity: rawMovies and nodetype cannot both be "Yes"
      if (name === "rawMovies" && value === "Yes") {
        setFormData({
          ...formData,
          rawMovies: "Yes",
          nodetype: "No",
        });
      } else if (name === "nodetype" && value === "Yes") {
        setFormData({
          ...formData,
          nodetype: "Yes",
          rawMovies: "No",
        });
      } else {
        setFormData({
          ...formData,
          [name]: value,
        });
      }
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
    }
  };
  const handleSubmit = (e) => {
    e.preventDefault();

    setLoading(true);

    // Log what we're submitting for debugging

    submitImport({ ...(formData || {}), project_id: projectId })
      .then((response) => {
        setMessage(`Success: ${response?.data?.message}`);
        // Reset form only after successful submission
        setFormData(initialFormData);
        setTimeout(() => {
          onJobSuccess();
        }, 2000);
      })
      .catch((error) => {
        // Handle error response from the API
        setMessage(
          `Error: ${error?.response?.data?.message || DefaultMessages.processError
          }`
        );
      })
      .finally(() => {
        setLoading(false);
      });
    return;
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  const handleFormDataChange = (data = {}) => {
    setFormData({ ...formData, ...(data || {}) });
  };

  const dropdownOptions = [
    { label: "Yes", value: "Yes" },
    { label: "No", value: "No" },
  ];
  const nodeOptions = [
    {
      label: "2D references (.mrcs)",
      value: "2D references",
    },
    {
      label: "Particle coordinates (.star)",
      value: "Particle coordinates",
    },
    {
      label: "3D reference (.mrc)",
      value: "3D reference",
    },
    {
      label: "3D mask (.mrc)",
      value: "3D mask",
    },
    {
      label: "Unfiltered half-map (.mrc)",
      value: "Unfiltered half-map",
    },
  ];
  // const isNodeTypeYes = formData.nodetype === "Yes";
  return (
    <div className="container">
      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={activeTab === "Movies/Mics" ? "active-tab " : ""}
          onClick={() => handleTabChange("Movies/Mics")}
        >
          Movies/Mics
        </button>
        <button
          className={activeTab === "Others" ? "active-tab" : ""}
          onClick={() => handleTabChange("Others")}
        >
          Others
        </button>
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      {/* Form content */}
      <form onSubmit={handleSubmit} className="form-content !ml-0 !h-auto">
        {activeTab === "Movies/Mics" && (
          <Movies
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
          />
        )}

        {activeTab === "Others" && (
          <Other
            formData={formData}
            handleInputChange={handleInputChange}
            handleRangeChange={handleRangeChange}
            nodeOptions={nodeOptions}
            dropdownOptions={dropdownOptions}
            setFilePopup={setFilePopup}
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
          className={`px-5 ${message?.includes("Error") ? "text-danger" : ""}`}
        >
          {message}
        </p>
      )}

      {/* Folder browser popup for raw input files (input_files) */}
      {filePopupField === "input_files" && (
        <FolderBrowserPopup
          onClose={() => setFilePopup("")}
          onSelect={({ pattern }) => {
            handleFormDataChange({
              input_files: pattern || "",
            });
            setFilePopup("");
          }}
          mode="files"
          extensions=".mrc,.tiff,.tif,.eer"
          title="Select Raw Movies/Micrographs"
        />
      )}

      {/* Folder browser popup for MTF file */}
      {filePopupField === "mtf" && (
        <FolderBrowserPopup
          onClose={() => setFilePopup("")}
          onFileSelect={(file) => {
            handleFormDataChange({
              mtf: file ? file.path : "",
            });
            setFilePopup("");
          }}
          mode="single"
          extensions=".star"
          title="Select MTF File"
        />
      )}

      {/* Folder browser popup for Others tab - browse ROOT_PATH folders */}
      {filePopupField === "otherInputFile" && (
        <FolderBrowserPopup
          onClose={() => setFilePopup("")}
          onFileSelect={(file) => {
            handleFormDataChange({
              otherInputFile: file ? file.path : "",
            });
            setFilePopup("");
          }}
          extensions={
            formData.otherNodeType === "Particle coordinates" ? ".star" :
            formData.otherNodeType === "2D references" ? ".mrcs,.mrc" :
            ".mrc"
          }
          title={`Select ${formData.otherNodeType || "file"}`}
        />
      )}
    </div>
  );
};

export default Import;
