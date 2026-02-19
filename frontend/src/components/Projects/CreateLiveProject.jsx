import React, { useState } from "react";
import { createLiveSession } from "../../services/liveSession";
import { createProjectApi } from "../../services/projects/projects";
import useToast from "../../hooks/useToast";
import { useNavigate } from "react-router-dom";
import {
  FiArrowLeft,
  FiLoader,
  FiAlertCircle,
  FiX,
  FiChevronDown,
} from "react-icons/fi";

const INITIAL_FORM_DATA = {
  // Project & Data Source
  projectName: "",
  description: "",
  inputMode: "watch",
  watchDirectory: "",
  filePattern: "*.tiff",
  movieThreshold: 0,
  // Optics
  pixelSize: 1.0,
  voltage: 300,
  cs: 2.7,
  amplitudeContrast: 0.1,
  // Motion Correction
  motionEnabled: true,
  binFactor: 1,
  dosePerFrame: 1.0,
  patchX: 5,
  patchY: 5,
  motionUseGpu: false,
  motionGpuIds: "0",
  // CTF Estimation
  ctfEnabled: true,
  defocusMin: 5000,
  defocusMax: 50000,
  defocusStep: 500,
  // Particle Picking
  pickEnabled: true,
  pickMethod: "LoG",
  minDiameter: 100,
  maxDiameter: 200,
  pickThreshold: 0.0,
  // Particle Extraction
  extractEnabled: true,
  boxSize: 256,
  rescale: false,
  rescaledSize: 128,
  // 2D Classification
  class2dEnabled: false,
  numClasses: 50,
  particleThreshold: 5000,
  class2dParticleDiameter: 200,
  class2dIterations: 200,
  class2dUseVdam: true,
  class2dVdamMiniBatches: 200,
  // Quality Filters
  ctfResolutionMax: 5.0,
  totalMotionMax: 30.0,
  // SLURM Settings
  queue: "",
  threads: 4,
  mpiProcs: 1,
  gpuCount: 1,
};

const INITIAL_OPEN_SECTIONS = {
  project: true,
  optics: true,
  motion: true,
  ctf: true,
  picking: true,
  extraction: true,
  class2d: false,
  quality: false,
  slurm: true,
};

const CreateLiveProject = () => {
  const [formData, setFormData] = useState(INITIAL_FORM_DATA);
  const [openSections, setOpenSections] = useState(INITIAL_OPEN_SECTIONS);
  const [isLoading, setLoading] = useState(false);
  const [disable, setDisable] = useState(false);
  const [error, setError] = useState(null);
  const showToast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value, type } = e.target;
    let newValue = value;
    if (type === "number") {
      newValue = value === "" ? "" : Number(value);
    }
    setFormData((prev) => ({ ...prev, [name]: newValue }));
    if (error) setError(null);
  };

  const handleToggle = (field) => {
    setFormData((prev) => ({ ...prev, [field]: !prev[field] }));
    if (error) setError(null);
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const validate = () => {
    if (!formData.projectName.trim()) {
      return "Project name is required.";
    }
    if (!formData.watchDirectory.trim()) {
      return "Watch directory is required.";
    }
    if (!(parseFloat(formData.pixelSize) > 0)) {
      return "Pixel size must be greater than 0.";
    }
    if (!(parseFloat(formData.voltage) > 0)) {
      return "Voltage must be greater than 0.";
    }
    if (!(parseFloat(formData.cs) > 0)) {
      return "Spherical aberration (Cs) must be greater than 0.";
    }
    if (!(parseFloat(formData.amplitudeContrast) > 0)) {
      return "Amplitude contrast must be greater than 0.";
    }
    return null;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);

    const validationError = validate();
    if (validationError) {
      setError({ message: validationError, type: "validation" });
      return;
    }

    setLoading(true);

    try {
      // Step 1: Create the project
      const projectResp = await createProjectApi({
        projectName: formData.projectName,
        description: formData.description,
      });

      // response.created returns: { success, status, data: { id, project_name, ... } }
      const projectId = projectResp.data?.data?.id;

      // Step 2: Create the live session with full config
      const payload = {
        projectId: projectId,
        projectName: formData.projectName,
        description: formData.description,
        inputMode: formData.inputMode,
        watchDirectory: formData.watchDirectory,
        filePattern: formData.filePattern,
        movieThreshold: parseInt(formData.movieThreshold) || 0,
        optics: {
          pixelSize: parseFloat(formData.pixelSize),
          voltage: parseFloat(formData.voltage),
          cs: parseFloat(formData.cs),
          amplitudeContrast: parseFloat(formData.amplitudeContrast),
        },
        motionConfig: {
          enabled: formData.motionEnabled,
          binFactor: parseInt(formData.binFactor),
          dosePerFrame: parseFloat(formData.dosePerFrame),
          patchX: parseInt(formData.patchX),
          patchY: parseInt(formData.patchY),
          useGpu: formData.motionUseGpu,
          gpuIds: formData.motionGpuIds || "0",
        },
        ctfConfig: {
          enabled: formData.ctfEnabled,
          defocusMin: parseFloat(formData.defocusMin),
          defocusMax: parseFloat(formData.defocusMax),
          defocusStep: parseFloat(formData.defocusStep),
        },
        pickingConfig: {
          enabled: formData.pickEnabled,
          method: formData.pickMethod,
          minDiameter: parseFloat(formData.minDiameter),
          maxDiameter: parseFloat(formData.maxDiameter),
          threshold: parseFloat(formData.pickThreshold),
        },
        extractionConfig: {
          enabled: formData.extractEnabled,
          boxSize: parseInt(formData.boxSize),
          rescale: formData.rescale,
          rescaledSize: parseInt(formData.rescaledSize),
        },
        class2dConfig: {
          enabled: formData.class2dEnabled,
          numClasses: parseInt(formData.numClasses),
          particleThreshold: parseInt(formData.particleThreshold),
          particleDiameter: parseInt(formData.class2dParticleDiameter),
          iterations: parseInt(formData.class2dIterations),
          useVdam: formData.class2dUseVdam,
          vdamMiniBatches: parseInt(formData.class2dVdamMiniBatches),
        },
        thresholds: {
          ctfResolutionMax: parseFloat(formData.ctfResolutionMax),
          totalMotionMax: parseFloat(formData.totalMotionMax),
        },
        slurmConfig: {
          queue: formData.queue || null,
          threads: parseInt(formData.threads),
          mpiProcs: parseInt(formData.mpiProcs),
          gpuCount: parseInt(formData.gpuCount),
        },
      };

      // response.success returns: { success, status, data: session, sessionId, sessionName }
      const sessionResp = await createLiveSession(payload);
      const sessionId = sessionResp.data?.sessionId || sessionResp.data?.data?.id;

      showToast("Live session created successfully!", {
        type: "success",
        autoClose: 3000,
      });
      setDisable(true);
      setTimeout(() => {
        navigate(`/live/${sessionId}`);
      }, 1500);
    } catch (err) {
      const errorMessage =
        err?.response?.data?.message ||
        "Something went wrong while creating the live session, please try again.";
      const errorType = err?.response?.data?.errorType || "unknown";
      setError({ message: errorMessage, type: errorType });
    } finally {
      setLoading(false);
    }
  };

  const getErrorTitle = (errorType) => {
    switch (errorType) {
      case "validation":
        return "Validation Error";
      case "duplicate_name":
        return "Project Name Already Exists";
      case "folder_exists":
        return "Project Folder Already Exists";
      case "permission_denied":
        return "Permission Denied";
      case "path_not_found":
        return "Path Not Found";
      default:
        return "Error Creating Session";
    }
  };

  const handleCancel = () => {
    navigate("/projects");
  };

  // Reusable section header renderer
  const renderSectionHeader = (key, title, description, enableField) => {
    const isOpen = openSections[key];
    return (
      <div className="lp-section-header" onClick={() => toggleSection(key)}>
        <div className="lp-section-header-left">
          <div className="lp-section-title-row">
            <h3 className="lp-section-title">{title}</h3>
            {enableField && (
              <div
                className="lp-toggle-wrapper"
                onClick={(e) => e.stopPropagation()}
              >
                <label className="lp-toggle">
                  <input
                    type="checkbox"
                    checked={formData[enableField]}
                    onChange={() => handleToggle(enableField)}
                  />
                  <span className="lp-toggle-slider"></span>
                </label>
                <span className="lp-toggle-label">
                  {formData[enableField] ? "Enabled" : "Disabled"}
                </span>
              </div>
            )}
          </div>
          <p className="lp-section-desc">{description}</p>
        </div>
        <FiChevronDown
          className={`lp-section-chevron ${isOpen ? "lp-chevron-open" : ""}`}
        />
      </div>
    );
  };

  // Check if a section's toggle is disabled
  const isSectionDisabled = (enableField) => {
    return enableField ? !formData[enableField] : false;
  };

  return (
    <div className="lp-page">
      {/* Header */}
      <div className="lp-header">
        <button className="lp-back-btn" onClick={handleCancel}>
          <FiArrowLeft />
          <span>Back to Projects</span>
        </button>
      </div>

      {/* Form Card */}
      <div className="lp-card">
        <div className="lp-card-header">
          <h1 className="lp-card-title">Create Live Processing Session</h1>
          <p className="lp-card-subtitle">
            Configure a real-time cryo-EM data processing pipeline from
            microscope to 2D classification
          </p>
        </div>

        {/* Error Card */}
        {error && (
          <div className="lp-error-card">
            <div className="lp-error-card-icon">
              <FiAlertCircle />
            </div>
            <div className="lp-error-card-content">
              <h4 className="lp-error-card-title">
                {getErrorTitle(error.type)}
              </h4>
              <p className="lp-error-card-message">{error.message}</p>
            </div>
            <button
              className="lp-error-card-close"
              onClick={() => setError(null)}
            >
              <FiX />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="lp-form">
          {/* ── Section 1: Project & Data Source ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "project",
              "Project & Data Source",
              "Name your session and specify where movies are located"
            )}
            {openSections.project && (
              <div className="lp-section-body">
                <div className="lp-form-group">
                  <label htmlFor="projectName">Project Name</label>
                  <input
                    type="text"
                    id="projectName"
                    name="projectName"
                    value={formData.projectName}
                    onChange={handleChange}
                    placeholder="e.g. Ribosome_20250205"
                    required
                  />
                </div>

                <div className="lp-form-group">
                  <label htmlFor="description">Description</label>
                  <textarea
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Brief description of the dataset (optional)"
                    rows="2"
                    maxLength={300}
                  />
                  <span className="lp-char-count">
                    {formData.description.length}/300
                  </span>
                </div>

                <div className="lp-form-group">
                  <label>Input Mode</label>
                  <div className="lp-mode-toggle">
                    <button
                      type="button"
                      className={`lp-mode-btn ${formData.inputMode === "watch" ? "lp-mode-active" : ""}`}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          inputMode: "watch",
                        }))
                      }
                    >
                      Watch Directory
                    </button>
                    <button
                      type="button"
                      className={`lp-mode-btn ${formData.inputMode === "existing" ? "lp-mode-active" : ""}`}
                      onClick={() =>
                        setFormData((prev) => ({
                          ...prev,
                          inputMode: "existing",
                        }))
                      }
                    >
                      Existing Movies
                    </button>
                  </div>
                  <span className="lp-form-hint">
                    {formData.inputMode === "watch"
                      ? "Watches for new files arriving from the microscope"
                      : "Process all existing movies in the directory once"}
                  </span>
                </div>

                <div className="lp-form-group">
                  <label htmlFor="watchDirectory">Watch Directory</label>
                  <input
                    type="text"
                    id="watchDirectory"
                    name="watchDirectory"
                    value={formData.watchDirectory}
                    onChange={handleChange}
                    placeholder="/data/microscope/session_001"
                    required
                  />
                </div>

                <div className="lp-form-group">
                  <label htmlFor="filePattern">File Pattern</label>
                  <input
                    type="text"
                    id="filePattern"
                    name="filePattern"
                    value={formData.filePattern}
                    onChange={handleChange}
                    placeholder="*.tiff"
                  />
                </div>

                <div className="lp-form-group">
                  <label htmlFor="movieThreshold">
                    Min Movies Before Processing
                  </label>
                  <input
                    type="number"
                    id="movieThreshold"
                    name="movieThreshold"
                    value={formData.movieThreshold}
                    onChange={handleChange}
                    min="0"
                    step="1"
                  />
                  <span className="lp-form-hint">
                    Wait until this many movies are detected before starting the
                    pipeline. Set to 0 to start immediately.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 2: Optics ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "optics",
              "Optics",
              "Microscope and detector parameters"
            )}
            {openSections.optics && (
              <div className="lp-section-body">
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="pixelSize">Pixel Size (A/px)</label>
                    <input
                      type="number"
                      id="pixelSize"
                      name="pixelSize"
                      value={formData.pixelSize}
                      onChange={handleChange}
                      step="any"
                      min="0"
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="voltage">Voltage (kV)</label>
                    <input
                      type="number"
                      id="voltage"
                      name="voltage"
                      value={formData.voltage}
                      onChange={handleChange}
                      step="1"
                      min="0"
                    />
                  </div>
                </div>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="cs">Spherical Aberration Cs (mm)</label>
                    <input
                      type="number"
                      id="cs"
                      name="cs"
                      value={formData.cs}
                      onChange={handleChange}
                      step="any"
                      min="0"
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="amplitudeContrast">
                      Amplitude Contrast
                    </label>
                    <input
                      type="number"
                      id="amplitudeContrast"
                      name="amplitudeContrast"
                      value={formData.amplitudeContrast}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      max="1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 3: Motion Correction ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "motion",
              "Motion Correction",
              "Beam-induced motion correction settings",
              "motionEnabled"
            )}
            {openSections.motion && (
              <div
                className={`lp-section-body ${isSectionDisabled("motionEnabled") ? "lp-disabled" : ""}`}
              >
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="binFactor">Binning Factor</label>
                    <input
                      type="number"
                      id="binFactor"
                      name="binFactor"
                      value={formData.binFactor}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      disabled={!formData.motionEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="dosePerFrame">
                      Dose per Frame (e/A^2)
                    </label>
                    <input
                      type="number"
                      id="dosePerFrame"
                      name="dosePerFrame"
                      value={formData.dosePerFrame}
                      onChange={handleChange}
                      step="any"
                      min="0"
                      disabled={!formData.motionEnabled}
                    />
                  </div>
                </div>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="patchX">Patch X</label>
                    <input
                      type="number"
                      id="patchX"
                      name="patchX"
                      value={formData.patchX}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      disabled={!formData.motionEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="patchY">Patch Y</label>
                    <input
                      type="number"
                      id="patchY"
                      name="patchY"
                      value={formData.patchY}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      disabled={!formData.motionEnabled}
                    />
                  </div>
                </div>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label>Use GPU (MotionCor2)</label>
                    <div
                      className="lp-toggle-wrapper"
                      style={{ marginTop: 4 }}
                    >
                      <label className="lp-toggle">
                        <input
                          type="checkbox"
                          checked={formData.motionUseGpu}
                          onChange={() => handleToggle("motionUseGpu")}
                          disabled={!formData.motionEnabled}
                        />
                        <span className="lp-toggle-slider"></span>
                      </label>
                      <span className="lp-toggle-label">
                        {formData.motionUseGpu ? "GPU" : "CPU (RELION)"}
                      </span>
                    </div>
                    <span className="lp-form-hint">
                      {formData.motionUseGpu
                        ? "Uses MotionCor2 with GPU acceleration"
                        : "Uses RELION's own CPU implementation"}
                    </span>
                  </div>
                  {formData.motionUseGpu && (
                    <div className="lp-form-group">
                      <label htmlFor="motionGpuIds">GPU IDs</label>
                      <input
                        type="text"
                        id="motionGpuIds"
                        name="motionGpuIds"
                        value={formData.motionGpuIds}
                        onChange={handleChange}
                        placeholder="0"
                        disabled={!formData.motionEnabled}
                      />
                      <span className="lp-form-hint">
                        Comma-separated GPU IDs (e.g., 0,1,2)
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 4: CTF Estimation ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "ctf",
              "CTF Estimation",
              "Contrast transfer function estimation parameters",
              "ctfEnabled"
            )}
            {openSections.ctf && (
              <div
                className={`lp-section-body ${isSectionDisabled("ctfEnabled") ? "lp-disabled" : ""}`}
              >
                <div className="lp-form-row lp-form-row-3">
                  <div className="lp-form-group">
                    <label htmlFor="defocusMin">Min Defocus (A)</label>
                    <input
                      type="number"
                      id="defocusMin"
                      name="defocusMin"
                      value={formData.defocusMin}
                      onChange={handleChange}
                      step="100"
                      min="0"
                      disabled={!formData.ctfEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="defocusMax">Max Defocus (A)</label>
                    <input
                      type="number"
                      id="defocusMax"
                      name="defocusMax"
                      value={formData.defocusMax}
                      onChange={handleChange}
                      step="100"
                      min="0"
                      disabled={!formData.ctfEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="defocusStep">Defocus Step (A)</label>
                    <input
                      type="number"
                      id="defocusStep"
                      name="defocusStep"
                      value={formData.defocusStep}
                      onChange={handleChange}
                      step="50"
                      min="0"
                      disabled={!formData.ctfEnabled}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 5: Particle Picking ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "picking",
              "Particle Picking",
              "Automated particle detection on micrographs",
              "pickEnabled"
            )}
            {openSections.picking && (
              <div
                className={`lp-section-body ${isSectionDisabled("pickEnabled") ? "lp-disabled" : ""}`}
              >
                <div className="lp-form-group">
                  <label htmlFor="pickMethod">Method</label>
                  <select
                    id="pickMethod"
                    name="pickMethod"
                    value={formData.pickMethod}
                    onChange={handleChange}
                    disabled={!formData.pickEnabled}
                  >
                    <option value="LoG">LoG</option>
                    <option value="template">Template</option>
                  </select>
                </div>
                <div className="lp-form-row lp-form-row-3">
                  <div className="lp-form-group">
                    <label htmlFor="minDiameter">Min Diameter (A)</label>
                    <input
                      type="number"
                      id="minDiameter"
                      name="minDiameter"
                      value={formData.minDiameter}
                      onChange={handleChange}
                      step="10"
                      min="0"
                      disabled={!formData.pickEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="maxDiameter">Max Diameter (A)</label>
                    <input
                      type="number"
                      id="maxDiameter"
                      name="maxDiameter"
                      value={formData.maxDiameter}
                      onChange={handleChange}
                      step="10"
                      min="0"
                      disabled={!formData.pickEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="pickThreshold">Picking Threshold</label>
                    <input
                      type="number"
                      id="pickThreshold"
                      name="pickThreshold"
                      value={formData.pickThreshold}
                      onChange={handleChange}
                      step="0.1"
                      disabled={!formData.pickEnabled}
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 6: Particle Extraction ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "extraction",
              "Particle Extraction",
              "Extract particle images from micrographs",
              "extractEnabled"
            )}
            {openSections.extraction && (
              <div
                className={`lp-section-body ${isSectionDisabled("extractEnabled") ? "lp-disabled" : ""}`}
              >
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="boxSize">Box Size (px)</label>
                    <input
                      type="number"
                      id="boxSize"
                      name="boxSize"
                      value={formData.boxSize}
                      onChange={handleChange}
                      step="16"
                      min="16"
                      disabled={!formData.extractEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label>Rescale</label>
                    <div
                      className="lp-toggle-wrapper"
                      style={{ marginTop: 4 }}
                    >
                      <label className="lp-toggle">
                        <input
                          type="checkbox"
                          checked={formData.rescale}
                          onChange={() => handleToggle("rescale")}
                          disabled={!formData.extractEnabled}
                        />
                        <span className="lp-toggle-slider"></span>
                      </label>
                      <span className="lp-toggle-label">
                        {formData.rescale ? "Yes" : "No"}
                      </span>
                    </div>
                  </div>
                </div>
                {formData.rescale && (
                  <div className="lp-form-group">
                    <label htmlFor="rescaledSize">Rescaled Size (px)</label>
                    <input
                      type="number"
                      id="rescaledSize"
                      name="rescaledSize"
                      value={formData.rescaledSize}
                      onChange={handleChange}
                      step="16"
                      min="16"
                      disabled={!formData.extractEnabled}
                    />
                  </div>
                )}
              </div>
            )}
          </div>

          {/* ── Section 7: 2D Classification ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "class2d",
              "2D Classification",
              "Run 2D class averaging once enough particles accumulate",
              "class2dEnabled"
            )}
            {openSections.class2d && (
              <div
                className={`lp-section-body ${isSectionDisabled("class2dEnabled") ? "lp-disabled" : ""}`}
              >
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="numClasses">Number of Classes</label>
                    <input
                      type="number"
                      id="numClasses"
                      name="numClasses"
                      value={formData.numClasses}
                      onChange={handleChange}
                      min="1"
                      step="1"
                      disabled={!formData.class2dEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="particleThreshold">
                      Particle Threshold per Run
                    </label>
                    <input
                      type="number"
                      id="particleThreshold"
                      name="particleThreshold"
                      value={formData.particleThreshold}
                      onChange={handleChange}
                      min="100"
                      step="100"
                      disabled={!formData.class2dEnabled}
                    />
                    <span className="lp-form-hint">
                      2D runs at N, 2N, 3N... cumulative particles (e.g. 5000
                      triggers at 5K, 10K, 15K...)
                    </span>
                  </div>
                </div>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="class2dParticleDiameter">
                      Particle Diameter (A)
                    </label>
                    <input
                      type="number"
                      id="class2dParticleDiameter"
                      name="class2dParticleDiameter"
                      value={formData.class2dParticleDiameter}
                      onChange={handleChange}
                      min="10"
                      step="10"
                      disabled={!formData.class2dEnabled}
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="class2dIterations">
                      Number of Iterations
                    </label>
                    <input
                      type="number"
                      id="class2dIterations"
                      name="class2dIterations"
                      value={formData.class2dIterations}
                      onChange={handleChange}
                      min="1"
                      max="999"
                      step="1"
                      disabled={!formData.class2dEnabled}
                    />
                  </div>
                </div>
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="class2dUseVdam">
                      Use VDAM (Gradient Optimization)
                    </label>
                    <select
                      id="class2dUseVdam"
                      name="class2dUseVdam"
                      value={formData.class2dUseVdam ? "true" : "false"}
                      onChange={(e) =>
                        handleChange({
                          target: {
                            name: "class2dUseVdam",
                            value: e.target.value === "true",
                            type: "select",
                          },
                        })
                      }
                      disabled={!formData.class2dEnabled}
                    >
                      <option value="true">Yes</option>
                      <option value="false">No</option>
                    </select>
                  </div>
                  {formData.class2dUseVdam && (
                    <div className="lp-form-group">
                      <label htmlFor="class2dVdamMiniBatches">
                        VDAM Mini-batch Size
                      </label>
                      <input
                        type="number"
                        id="class2dVdamMiniBatches"
                        name="class2dVdamMiniBatches"
                        value={formData.class2dVdamMiniBatches}
                        onChange={handleChange}
                        min="100"
                        max="1000"
                        step="50"
                        disabled={!formData.class2dEnabled}
                      />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ── Section 8: Quality Filters ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "quality",
              "Quality Filters",
              "Automatic rejection thresholds for micrographs"
            )}
            {openSections.quality && (
              <div className="lp-section-body">
                <div className="lp-form-row">
                  <div className="lp-form-group">
                    <label htmlFor="ctfResolutionMax">
                      Max CTF Resolution (A)
                    </label>
                    <input
                      type="number"
                      id="ctfResolutionMax"
                      name="ctfResolutionMax"
                      value={formData.ctfResolutionMax}
                      onChange={handleChange}
                      step="0.5"
                      min="0"
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="totalMotionMax">
                      Max Total Motion (px)
                    </label>
                    <input
                      type="number"
                      id="totalMotionMax"
                      name="totalMotionMax"
                      value={formData.totalMotionMax}
                      onChange={handleChange}
                      step="1"
                      min="0"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* ── Section 9: SLURM Settings ── */}
          <div className="lp-section">
            {renderSectionHeader(
              "slurm",
              "SLURM Settings",
              "Cluster submission configuration"
            )}
            {openSections.slurm && (
              <div className="lp-section-body">
                <div className="lp-form-group">
                  <label htmlFor="queue">Queue / Partition</label>
                  <input
                    type="text"
                    id="queue"
                    name="queue"
                    value={formData.queue}
                    onChange={handleChange}
                    placeholder="default (optional)"
                  />
                </div>
                <div className="lp-form-row lp-form-row-3">
                  <div className="lp-form-group">
                    <label htmlFor="threads">Threads</label>
                    <input
                      type="number"
                      id="threads"
                      name="threads"
                      value={formData.threads}
                      onChange={handleChange}
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="mpiProcs">MPI Processes</label>
                    <input
                      type="number"
                      id="mpiProcs"
                      name="mpiProcs"
                      value={formData.mpiProcs}
                      onChange={handleChange}
                      min="1"
                      step="1"
                    />
                  </div>
                  <div className="lp-form-group">
                    <label htmlFor="gpuCount">GPU Count</label>
                    <input
                      type="number"
                      id="gpuCount"
                      name="gpuCount"
                      value={formData.gpuCount}
                      onChange={handleChange}
                      min="0"
                      step="1"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="lp-form-actions">
            <button type="button" onClick={handleCancel} className="lp-btn-cancel">
              Cancel
            </button>
            <button
              type="submit"
              className={`lp-btn-submit ${disable ? "lp-btn-disabled" : ""}`}
              disabled={disable || isLoading}
            >
              {isLoading ? (
                <>
                  <FiLoader className="lp-btn-loader" />
                  Creating Session...
                </>
              ) : (
                "Create Live Session"
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .lp-page {
          min-height: calc(100vh - 56px);
          background: var(--color-bg-card);
          padding: 32px 48px;
        }

        .lp-header {
          margin-bottom: 32px;
        }

        .lp-back-btn {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 8px 0;
          background: none;
          border: none;
          color: var(--color-text-secondary);
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          transition: color 0.15s ease;
        }

        .lp-back-btn:hover {
          color: var(--color-text-heading);
        }

        .lp-card {
          max-width: 720px;
        }

        .lp-card-header {
          margin-bottom: 32px;
        }

        .lp-card-title {
          font-size: 28px;
          font-weight: 600;
          color: var(--color-text-heading);
          margin: 0 0 8px 0;
          letter-spacing: -0.5px;
        }

        .lp-card-subtitle {
          font-size: 15px;
          color: var(--color-text-secondary);
          margin: 0;
        }

        /* ── Error Card ── */
        .lp-error-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger-border);
          border-radius: 10px;
          margin-bottom: 24px;
        }

        .lp-error-card-icon {
          flex-shrink: 0;
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: var(--color-danger-text);
          font-size: 20px;
        }

        .lp-error-card-content {
          flex: 1;
        }

        .lp-error-card-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--color-danger-text);
          margin: 0 0 4px 0;
        }

        .lp-error-card-message {
          font-size: 13px;
          color: var(--color-danger-text);
          margin: 0;
          line-height: 1.5;
        }

        .lp-error-card-close {
          flex-shrink: 0;
          padding: 4px;
          background: none;
          border: none;
          color: var(--color-danger-text);
          cursor: pointer;
          border-radius: 4px;
          transition: background 0.15s ease;
        }

        .lp-error-card-close:hover {
          background: var(--color-danger-bg);
        }

        .lp-error-card-close svg {
          font-size: 16px;
        }

        /* ── Form Layout ── */
        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

        /* ── Collapsible Sections ── */
        .lp-section {
          border: 1px solid var(--color-border);
          border-radius: 10px;
          overflow: hidden;
        }

        .lp-section-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          cursor: pointer;
          user-select: none;
          transition: background 0.15s ease;
        }

        .lp-section-header:hover {
          background: var(--color-bg);
        }

        .lp-section-header-left {
          flex: 1;
          min-width: 0;
        }

        .lp-section-title-row {
          display: flex;
          align-items: center;
          gap: 16px;
          flex-wrap: wrap;
        }

        .lp-section-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--color-text-heading);
          margin: 0;
        }

        .lp-section-desc {
          font-size: 13px;
          color: var(--color-text-muted);
          margin: 4px 0 0 0;
        }

        .lp-section-chevron {
          flex-shrink: 0;
          font-size: 18px;
          color: var(--color-text-muted);
          transition: transform 0.2s ease;
          margin-left: 12px;
        }

        .lp-chevron-open {
          transform: rotate(180deg);
        }

        .lp-section-body {
          padding: 4px 20px 20px 20px;
          display: flex;
          flex-direction: column;
          gap: 16px;
          border-top: 1px solid var(--color-border-light);
          transition: opacity 0.15s ease;
        }

        .lp-section-body.lp-disabled {
          opacity: 0.45;
          pointer-events: none;
        }

        /* ── Form Groups ── */
        .lp-form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
          min-width: 0;
        }

        .lp-form-group label {
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-label);
        }

        .lp-form-group input,
        .lp-form-group textarea,
        .lp-form-group select {
          padding: 10px 12px;
          font-size: 14px;
          color: var(--color-text-heading);
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          outline: none;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .lp-form-group input:focus,
        .lp-form-group textarea:focus,
        .lp-form-group select:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .lp-form-group input::placeholder,
        .lp-form-group textarea::placeholder {
          color: var(--color-text-muted);
        }

        .lp-form-group input:disabled,
        .lp-form-group select:disabled {
          background: var(--color-bg);
          color: var(--color-text-muted);
          cursor: not-allowed;
        }

        .lp-form-group textarea {
          resize: none;
          min-height: 56px;
          max-height: 80px;
        }

        .lp-form-group select {
          cursor: pointer;
          appearance: auto;
        }

        .lp-char-count {
          font-size: 12px;
          color: var(--color-text-muted);
          text-align: right;
        }

        .lp-form-hint {
          font-size: 12px;
          color: var(--color-text-muted);
          margin-top: -2px;
        }

        /* ── Row layouts ── */
        .lp-form-row {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .lp-form-row-3 {
          grid-template-columns: 1fr 1fr 1fr;
        }

        /* ── Input Mode Toggle ── */
        .lp-mode-toggle {
          display: inline-flex;
          border: 1px solid var(--color-border);
          border-radius: 8px;
          overflow: hidden;
        }

        .lp-mode-btn {
          padding: 8px 18px;
          font-size: 13px;
          font-weight: 500;
          color: var(--color-text-secondary);
          background: var(--color-bg-card);
          border: none;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lp-mode-btn:not(:last-child) {
          border-right: 1px solid var(--color-border);
        }

        .lp-mode-btn.lp-mode-active {
          color: #ffffff;
          background: var(--color-primary);
        }

        .lp-mode-btn:hover:not(.lp-mode-active) {
          background: var(--color-bg);
        }

        /* ── Toggle Switch ── */
        .lp-toggle-wrapper {
          display: inline-flex;
          align-items: center;
          gap: 8px;
        }

        .lp-toggle {
          position: relative;
          display: inline-block;
          width: 36px;
          height: 20px;
          flex-shrink: 0;
        }

        .lp-toggle input {
          opacity: 0;
          width: 0;
          height: 0;
          position: absolute;
        }

        .lp-toggle-slider {
          position: absolute;
          cursor: pointer;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: var(--color-border-hover);
          border-radius: 20px;
          transition: background 0.2s ease;
        }

        .lp-toggle-slider::before {
          content: "";
          position: absolute;
          height: 16px;
          width: 16px;
          left: 2px;
          bottom: 2px;
          background: #ffffff;
          border-radius: 50%;
          transition: transform 0.2s ease;
        }

        .lp-toggle input:checked + .lp-toggle-slider {
          background: var(--color-primary);
        }

        .lp-toggle input:checked + .lp-toggle-slider::before {
          transform: translateX(16px);
        }

        .lp-toggle input:disabled + .lp-toggle-slider {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .lp-toggle-label {
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
        }

        /* ── Form Actions ── */
        .lp-form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 8px;
          padding-top: 24px;
          border-top: 1px solid var(--color-border);
        }

        .lp-btn-cancel {
          padding: 10px 20px;
          font-size: 14px;
          font-weight: 500;
          color: var(--color-text-secondary);
          background: var(--color-border-light);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lp-btn-cancel:hover {
          background: var(--color-border);
          color: var(--color-text-label);
        }

        .lp-btn-submit {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          color: white;
          background: var(--color-primary);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lp-btn-submit:hover:not(.lp-btn-disabled) {
          background: var(--color-primary-hover);
        }

        .lp-btn-disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .lp-btn-loader {
          animation: lp-spin 1s linear infinite;
        }

        @keyframes lp-spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }

        @media (max-width: 768px) {
          .lp-page {
            padding: 24px;
          }

          .lp-card-title {
            font-size: 24px;
          }

          .lp-form-row,
          .lp-form-row-3 {
            grid-template-columns: 1fr;
          }

          .lp-form-actions {
            flex-direction: column-reverse;
          }

          .lp-btn-cancel,
          .lp-btn-submit {
            width: 100%;
            justify-content: center;
          }
        }
      `}</style>
    </div>
  );
};

export default CreateLiveProject;
