import React, { useState, useEffect } from "react";
import "../../form.css";
import { useBuilder } from "../../../context/BuilderContext";
import { submitLinkMovies } from "../../../services/jobs";
import { DefaultMessages } from "../common/Data";
import SimpleInput from "../common/SimpleInput";
import SubmitButton from "../common/SubmitButton";

const LinkMovies = () => {
  const initialFormData = {
    source_path: "",
  };

  const [formData, setFormData] = useState(initialFormData);
  const [activeTab, setActiveTab] = useState("Running");
  const [message, setMessage] = useState("");
  const [isLoading, setLoading] = useState(false);
  const { projectId, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

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
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    try {
      const response = await submitLinkMovies({
        ...formData,
        project_id: projectId,
      });

      if (response?.data?.status === "success" || response?.data?.status === "running") {
        setMessage(`Success: ${response?.data?.message || "Job submitted successfully"}`);
        setFormData(initialFormData);
      } else {
        setMessage(`Error: ${response?.data?.message || "Failed to link movies"}`);
      }
    } catch (error) {
      setMessage(
        `Error: ${error.response?.data?.message || DefaultMessages.processError}`
      );
    } finally {
      setLoading(false);
    }
  };

  const handleTabChange = (tab) => {
    setActiveTab(tab);
  };

  return (
    <div className="container">
      {/* Tabs */}
      <div className="tabs-container">
        <button
          className={activeTab === "Running" ? "active-tab" : ""}
          onClick={() => handleTabChange("Running")}
        >
          Running
        </button>
      </div>

      {/* Form content */}
      <form onSubmit={handleSubmit} className="form-content !ml-0 !h-auto">
        {activeTab === "Running" && (
          <div className="space-y-4">
            <SimpleInput
              name="source_path"
              label="Movies Folder:"
              value={formData.source_path}
              onChange={handleInputChange}
              placeholder="/path/to/movies/folder"
              tooltipText="Full path to the folder containing your movies"
            />
          </div>
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
          className={`px-5 mt-4 ${message?.includes("Error") ? "text-danger" : "text-green-600"}`}
        >
          {message}
        </p>
      )}
    </div>
  );
};

export default LinkMovies;
