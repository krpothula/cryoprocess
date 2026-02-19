import React, { useState, useEffect, useCallback } from "react";
import { useBuilder } from "../../../context/BuilderContext";
import axiosInstance from "../../../services/config";
import CustomInput from "../common/Input";
import { JobTypes } from "../common/Data/jobs";
import MolstarViewer from "../../InitialModelDashboard/MolstarViewer";
import { FiBox } from "react-icons/fi";
import "./ManualSelect.css";

const ManualSelect = () => {
  const { projectId, onJobSuccess, copiedJobParams, clearCopiedJobParams, autoPopulateInputs, clearAutoPopulate } = useBuilder();

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

  const [formData, setFormData] = useState({
    classFromJob: "",
    selectedClasses: [],
  });

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [classes, setClasses] = useState([]);
  const [is3D, setIs3D] = useState(false);
  const [selectedClasses, setSelectedClasses] = useState(new Set());
  const [dataStarPath, setDataStarPath] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [viewingClass, setViewingClass] = useState(null);

  const fetchClasses = useCallback(async () => {
    if (!formData.classFromJob || !projectId) return;

    setLoading(true);
    setError("");

    try {
      const url = `/class2d/individual-images/?projectId=${projectId}&jobPath=${encodeURIComponent(formData.classFromJob)}&iteration=latest`;
      const response = await axiosInstance.get(url);

      if (response.data.status === "success") {
        setClasses(response.data.data.classes);
        setIs3D(response.data.data.is3d || false);
        setDataStarPath(response.data.data.dataStarPath);
        setViewingClass(null);
      } else {
        setError(response.data.message || "Failed to load classes");
      }
    } catch (err) {
      console.error("ManualSelect fetchClasses error:", err);
      setError(err.response?.data?.message || err.message || "Error loading class images");
    } finally {
      setLoading(false);
    }
  }, [formData.classFromJob, projectId]);

  useEffect(() => {
    if (formData.classFromJob && projectId) {
      fetchClasses();
    } else {
      setClasses([]);
      setSelectedClasses(new Set());
      setIs3D(false);
      setViewingClass(null);
    }
  }, [formData.classFromJob, projectId, fetchClasses]);

  const handleInputChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const toggleClass = (classNumber) => {
    setSelectedClasses((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(classNumber)) {
        newSet.delete(classNumber);
      } else {
        newSet.add(classNumber);
      }
      return newSet;
    });
  };

  const selectNone = () => {
    setSelectedClasses(new Set());
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();

    if (selectedClasses.size === 0) {
      setError("Please select at least one class");
      return;
    }

    setIsSubmitting(true);
    setError("");
    setMessage("");

    try {
      const response = await axiosInstance.post("/class2d/save-selection/", {
        projectId,
        dataStarPath,
        selectedClasses: Array.from(selectedClasses),
        outputJobName: "ManualSelect",
      });

      if (response.data.status === "success") {
        setMessage(
          `Success! Saved ${response.data.data.numParticles} particles from ${response.data.data.selectedClasses.length} classes to ${response.data.data.outputFile}`
        );
        setTimeout(() => {
          onJobSuccess();
        }, 2000);
      } else {
        setError(response.data.message || "Failed to save selection");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error saving selection");
    } finally {
      setIsSubmitting(false);
    }
  };

  const totalSelected = selectedClasses.size;
  const totalParticles = classes
    .filter((c) => selectedClasses.has(c.classNumber))
    .reduce((sum, c) => sum + (c.distribution || 0), 0);

  return (
    <div className="manual-select-container">
      <form onSubmit={handleSubmit} noValidate>
        <div style={{ marginBottom: 16 }}>
          <CustomInput
            stageStarFiles="Class2D,Class3D,InitialModel"
            stageRole="particlesStar"
            onChange={(val = "") => {
              handleInputChange({
                target: { name: "classFromJob", value: val },
              });
            }}
            name="classFromJob"
            label="Select classification job:"
            placeholder="Select _data.star from 2D/3D Classification or Initial Model"
            tooltipText="Select a classification or initial model job to view and select classes"
            value={formData?.classFromJob}
            jobType={JobTypes["manual_class_selection"]}
          />
        </div>

        {formData.classFromJob && (
          <div className="ms-panel">
            {/* Toolbar */}
            <div className="ms-toolbar">
              <div className="ms-toolbar-summary">
                Selected: <strong>{totalSelected}</strong> classes
                ({(totalParticles * 100).toFixed(1)}% of particles)
              </div>
              <button type="button" className="ms-btn-clear" onClick={selectNone}>
                Clear
              </button>
              <button
                type="button"
                className="ms-btn-save"
                onClick={handleSubmit}
                disabled={isSubmitting || selectedClasses.size === 0}
              >
                {isSubmitting ? "Saving..." : "Save"}
              </button>
            </div>

            {error && (
              <div className="ms-error">{error}</div>
            )}

            {loading ? (
              <div className="ms-loading">Loading class images...</div>
            ) : (
              <>
                {/* Same grid for both 2D and 3D */}
                <div className="ms-class-grid">
                  {classes.map((cls) => {
                    const pct = cls.particleFraction ?? 0;
                    const res = cls.estimatedResolution ?? 999;
                    return (
                      <div
                        key={cls.classNumber}
                        className={`ms-class-card ${selectedClasses.has(cls.classNumber) ? "selected" : ""}`}
                        onClick={() => toggleClass(cls.classNumber)}
                      >
                        <img src={cls.image} alt={`Class ${cls.classNumber}`} />
                        <div className="ms-class-info">
                          <span style={{ color: "var(--color-text-heading)", fontWeight: "bold" }}>#{cls.classNumber}</span>
                          <span style={{ color: "var(--color-success-text)" }}>{pct.toFixed(1)}%</span>
                          <span style={{ color: "var(--color-primary)" }}>
                            {res < 100 ? `${res.toFixed(1)}Å` : "-"}
                          </span>
                        </div>
                        <div className="ms-class-checkbox">
                          <input
                            type="checkbox"
                            checked={selectedClasses.has(cls.classNumber)}
                            onChange={() => {}}
                          />
                        </div>
                        {/* 3D button - only for 3D classes */}
                        {is3D && cls.mrcPath && (
                          <div
                            className="ms-class-3d-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              setViewingClass(
                                viewingClass?.classNumber === cls.classNumber ? null : cls
                              );
                            }}
                            title="View 3D volume"
                          >
                            <FiBox size={12} />
                            <span>3D</span>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>

                {/* Molstar viewer below grid - only when a 3D class is selected for viewing */}
                {is3D && viewingClass && (
                  <div className="ms-molstar-panel">
                    <div className="ms-molstar-toolbar">
                      <div className="ms-molstar-title">
                        <FiBox size={14} />
                        <span>Class #{viewingClass.classNumber}</span>
                        <span className="ms-molstar-meta">
                          {(viewingClass.particleFraction ?? 0).toFixed(1)}%
                          {(viewingClass.estimatedResolution ?? 999) < 100 && (
                            <> | {viewingClass.estimatedResolution.toFixed(1)}&#x212B;</>
                          )}
                        </span>
                      </div>
                      <button
                        type="button"
                        className="ms-molstar-close"
                        onClick={() => setViewingClass(null)}
                      >
                        Close
                      </button>
                    </div>
                    <div className="ms-molstar-viewer">
                      <MolstarViewer
                        jobId={null}
                        mrcFilePath={viewingClass.mrcPath}
                        apiEndpoint="/initialmodel/mrc/"
                        isoValue={1.5}
                      />
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </form>

      {message && (
        <p className={`ms-message ${message.includes("Error") ? "ms-message-error" : "ms-message-success"}`}>
          {message}
        </p>
      )}
    </div>
  );
};

export default ManualSelect;
