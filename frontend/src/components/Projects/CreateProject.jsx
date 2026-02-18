import React, { useState } from "react";
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

const CreateProject = () => {
  const [formData, setFormData] = useState({
    projectName: "",
    description: "",
    movieDirectory: "",
  });
  const [openSections, setOpenSections] = useState({
    project: true,
    data: true,
  });
  const [isLoading, setLoading] = useState(false);
  const [disable, setDisable] = useState(false);
  const [error, setError] = useState(null);
  const showToast = useToast();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    if (error) setError(null);
  };

  const toggleSection = (section) => {
    setOpenSections((prev) => ({ ...prev, [section]: !prev[section] }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);

    if (!formData.projectName.trim()) {
      setError({ message: "Project name is required.", type: "validation" });
      return;
    }

    setLoading(true);

    const payload = {
      projectName: formData.projectName,
      description: formData.description,
    };

    if (formData.movieDirectory.trim()) {
      payload.movieDirectory = formData.movieDirectory.trim();
    }

    createProjectApi(payload)
      .then(() => {
        showToast("Project created successfully!", {
          type: "success",
          autoClose: 3000,
        });
        setDisable(true);
        setTimeout(() => {
          navigate("/projects");
        }, 2000);
      })
      .catch((err) => {
        const errorMessage =
          err?.response?.data?.message ||
          "Something went wrong while creating the project, please try again.";
        const errorType = err?.response?.data?.errorType || "unknown";
        setError({ message: errorMessage, type: errorType });
      })
      .finally(() => {
        setLoading(false);
      });
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
        return "Error Creating Project";
    }
  };

  const handleCancel = () => {
    navigate("/projects");
  };

  const renderSectionHeader = (key, title, description) => {
    const isOpen = openSections[key];
    return (
      <div className="lp-section-header" onClick={() => toggleSection(key)} role="button" tabIndex="0" onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggleSection(key); } }} aria-expanded={isOpen} aria-label={`${title} section`}>
        <div className="lp-section-header-left">
          <h3 className="lp-section-title">{title}</h3>
          <p className="lp-section-desc">{description}</p>
        </div>
        <FiChevronDown
          className={`lp-section-chevron ${isOpen ? "lp-chevron-open" : ""}`}
          aria-hidden="true"
        />
      </div>
    );
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
          <h1 className="lp-card-title">Create New Project</h1>
          <p className="lp-card-subtitle">
            Set up a new cryo-EM processing project
          </p>
        </div>

        {/* Error Card */}
        {error && (
          <div className="lp-error-card" role="alert">
            <div className="lp-error-card-icon" aria-hidden="true">
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
              aria-label="Close error message"
            >
              <FiX aria-hidden="true" />
            </button>
          </div>
        )}

        <form onSubmit={handleSubmit} className="lp-form">
          {/* Section 1: Project Details */}
          <div className="lp-section">
            {renderSectionHeader(
              "project",
              "Project Details",
              "Name and describe your project"
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
                    placeholder="e.g. Ribosome_20260206"
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
                    placeholder="Brief description of the project (optional)"
                    rows="2"
                    maxLength={200}
                  />
                  <span className="lp-char-count">
                    {formData.description.length}/200
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Section 2: Data Source */}
          <div className="lp-section">
            {renderSectionHeader(
              "data",
              "Data Source",
              "Link your movie or micrograph files to this project"
            )}
            {openSections.data && (
              <div className="lp-section-body">
                <div className="lp-form-group">
                  <label htmlFor="movieDirectory">
                    Movie / Micrograph Directory
                  </label>
                  <input
                    type="text"
                    id="movieDirectory"
                    name="movieDirectory"
                    value={formData.movieDirectory}
                    onChange={handleChange}
                    placeholder="/data/microscope/session_001"
                  />
                  <span className="lp-form-hint">
                    Absolute path to your movie files. A symlink will be created
                    in the project folder. Leave empty to link later.
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="lp-form-actions">
            <button
              type="button"
              onClick={handleCancel}
              className="lp-btn-cancel"
            >
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
                  Creating...
                </>
              ) : (
                "Create Project"
              )}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .lp-page {
          min-height: calc(100vh - 56px);
          background: var(--color-bg);
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

        .lp-error-card {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          padding: 16px;
          background: var(--color-danger-bg);
          border: 1px solid var(--color-danger);
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
          color: var(--color-danger);
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
          color: var(--color-danger);
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

        .lp-form {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }

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
          background: var(--color-bg-hover);
        }

        .lp-section-header-left {
          flex: 1;
          min-width: 0;
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
        }

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
          color: var(--color-text);
        }

        .lp-form-group input,
        .lp-form-group textarea {
          padding: 10px 12px;
          font-size: 14px;
          color: var(--color-text-heading);
          background: var(--color-bg-input);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          outline: none;
          transition: all 0.15s ease;
          font-family: inherit;
        }

        .lp-form-group input:focus,
        .lp-form-group textarea:focus {
          border-color: var(--color-primary);
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }

        .lp-form-group input::placeholder,
        .lp-form-group textarea::placeholder {
          color: var(--color-text-muted);
        }

        .lp-form-group textarea {
          resize: none;
          min-height: 56px;
          max-height: 80px;
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
          background: var(--color-bg-hover);
          border: none;
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .lp-btn-cancel:hover {
          background: var(--color-border);
          color: var(--color-text);
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

export default CreateProject;
