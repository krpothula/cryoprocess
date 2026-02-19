import React, { useState, useEffect, useCallback } from "react";
import { useBuilder } from "../../../../context/BuilderContext";
import axiosInstance from "../../../../services/config";
import "./ClassSelector.css";

const ClassSelector = ({ onSelectionComplete, classFromJob }) => {
  const { projectId } = useBuilder();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [classes, setClasses] = useState([]);
  const [selectedClasses, setSelectedClasses] = useState(new Set());
  const [dataStarPath, setDataStarPath] = useState("");
  const [iteration, setIteration] = useState("latest");
  const [availableIterations, setAvailableIterations] = useState([]);
  const [jobId, setJobId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [sortBy, setSortBy] = useState("classNumber");
  const [sortOrder, setSortOrder] = useState("asc");

  // Extract job ID from classFromJob path (e.g., "Class2D/Job020/_it025_data.star")
  useEffect(() => {
    if (classFromJob) {
      // Try to find job ID from the path
      const jobMatch = classFromJob.match(/Job(\d+)/i);
      if (jobMatch) {
        // We need to fetch the actual job ID from the backend
        fetchJobIdByPath(classFromJob);
      }
    }
  }, [classFromJob]);

  const fetchJobIdByPath = async (path) => {
    try {
      // Extract job folder name from path
      const pathParts = path.split("/");
      const jobFolder = pathParts.find((p) => p.toLowerCase().startsWith("job"));
      const stageFolder = pathParts[0]; // e.g., "Class2D"

      if (jobFolder && stageFolder) {
        const jobName = `${stageFolder}/${jobFolder}`;
        // Fetch job by name
        const response = await axiosInstance.get(`/api/jobs/?projectId=${projectId}&jobName=${jobName}`);
        if (response.data && response.data.length > 0) {
          setJobId(response.data[0].id);
        }
      }
    } catch (err) {
      console.error("Error fetching job ID:", err);
    }
  };

  const fetchClasses = useCallback(async () => {
    if (!jobId) return;

    setLoading(true);
    setError("");

    try {
      const response = await axiosInstance.get(
        `/class2d/individual-images/?jobId=${jobId}&iteration=${iteration}`
      );

      if (response.data.status === "success") {
        setClasses(response.data.data.classes);
        setDataStarPath(response.data.data.dataStarPath);
        setAvailableIterations(response.data.data.availableIterations || []);
      } else {
        setError(response.data.message || "Failed to load classes");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error loading class images");
      console.error("Error fetching classes:", err);
    } finally {
      setLoading(false);
    }
  }, [jobId, iteration]);

  useEffect(() => {
    if (jobId) {
      fetchClasses();
    }
  }, [jobId, fetchClasses]);

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

  const selectAll = () => {
    setSelectedClasses(new Set(classes.map((c) => c.classNumber)));
  };

  const selectNone = () => {
    setSelectedClasses(new Set());
  };

  const selectByThreshold = (minFraction) => {
    const selected = classes
      .filter((c) => c.particleFraction >= minFraction)
      .map((c) => c.classNumber);
    setSelectedClasses(new Set(selected));
  };

  const saveSelection = async () => {
    if (selectedClasses.size === 0) {
      setError("Please select at least one class");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const response = await axiosInstance.post("/class2d/save-selection/", {
        projectId,
        dataStarPath,
        selectedClasses: Array.from(selectedClasses),
        outputJobName: "ManualSelect",
      });

      if (response.data.status === "success") {
        // Notify parent component of success
        if (onSelectionComplete) {
          onSelectionComplete({
            outputFile: response.data.data.outputFile,
            numParticles: response.data.data.numParticles,
            selectedClasses: response.data.data.selectedClasses,
            jobId: response.data.data.id,
            jobName: response.data.data.jobName,
          });
        }
        alert(
          `Success! Saved ${response.data.data.numParticles} particles from ${response.data.data.selectedClasses.length} classes to ${response.data.data.outputFile}`
        );
      } else {
        setError(response.data.message || "Failed to save selection");
      }
    } catch (err) {
      setError(err.response?.data?.message || "Error saving selection");
      console.error("Error saving selection:", err);
    } finally {
      setSaving(false);
    }
  };

  const getSortedClasses = () => {
    const sorted = [...classes].sort((a, b) => {
      let aVal, bVal;
      switch (sortBy) {
        case "particleFraction":
          aVal = a.particleFraction;
          bVal = b.particleFraction;
          break;
        case "estimatedResolution":
          aVal = a.estimatedResolution;
          bVal = b.estimatedResolution;
          break;
        default:
          aVal = a.classNumber;
          bVal = b.classNumber;
      }
      return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
    });
    return sorted;
  };

  const totalSelected = selectedClasses.size;
  const totalParticles = classes
    .filter((c) => selectedClasses.has(c.classNumber))
    .reduce((sum, c) => sum + c.distribution, 0);

  if (!classFromJob) {
    return (
      <div className="class-selector">
        <div className="class-selector-placeholder">
          <p>Select a Class2D job above to view and select classes</p>
        </div>
      </div>
    );
  }

  return (
    <div className="class-selector">
      <div className="class-selector-header">
        <h4>Select Classes</h4>
        <div className="class-selector-controls">
          <div className="iteration-selector">
            <label>Iteration:</label>
            <select
              value={iteration}
              onChange={(e) => setIteration(e.target.value)}
            >
              <option value="latest">Latest</option>
              {availableIterations.map((it) => (
                <option key={it} value={it}>
                  Iteration {it}
                </option>
              ))}
            </select>
          </div>
          <div className="sort-controls">
            <label>Sort by:</label>
            <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
              <option value="classNumber">Class #</option>
              <option value="particleFraction">Particle %</option>
              <option value="estimatedResolution">Resolution</option>
            </select>
            <button
              className="sort-order-btn"
              onClick={() => setSortOrder(sortOrder === "asc" ? "desc" : "asc")}
            >
              {sortOrder === "asc" ? "↑" : "↓"}
            </button>
          </div>
        </div>
      </div>

      <div className="class-selector-actions">
        <button onClick={selectAll}>Select All</button>
        <button onClick={selectNone}>Select None</button>
        <button onClick={() => selectByThreshold(1)}>Select &gt;1%</button>
        <button onClick={() => selectByThreshold(2)}>Select &gt;2%</button>
        <button onClick={() => selectByThreshold(5)}>Select &gt;5%</button>
      </div>

      {error && <div className="class-selector-error">{error}</div>}

      {loading ? (
        <div className="class-selector-loading">Loading class images...</div>
      ) : (
        <div className="class-grid">
          {getSortedClasses().map((cls) => (
            <div
              key={cls.classNumber}
              className={`class-item ${
                selectedClasses.has(cls.classNumber) ? "selected" : ""
              }`}
              onClick={() => toggleClass(cls.classNumber)}
            >
              <img src={cls.image} alt={`Class ${cls.classNumber}`} />
              <div className="class-info">
                <span className="class-number">#{cls.classNumber}</span>
                <span className="class-fraction">
                  {cls.particleFraction.toFixed(1)}%
                </span>
                <span className="class-resolution">
                  {cls.estimatedResolution < 100
                    ? `${cls.estimatedResolution.toFixed(1)}Å`
                    : "-"}
                </span>
              </div>
              <div className="class-checkbox">
                <input
                  type="checkbox"
                  checked={selectedClasses.has(cls.classNumber)}
                  onChange={() => {}}
                />
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="class-selector-footer">
        <div className="selection-summary">
          <span>
            Selected: {totalSelected} classes ({(totalParticles * 100).toFixed(1)}%
            of particles)
          </span>
        </div>
        <button
          className="save-selection-btn"
          onClick={saveSelection}
          disabled={saving || selectedClasses.size === 0}
        >
          {saving ? "Saving..." : "Save Selection as particles.star"}
        </button>
      </div>
    </div>
  );
};

export default ClassSelector;
