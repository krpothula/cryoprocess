import React, { useEffect, useState } from "react";
import JobLogs from "../Tabs/common/JobLogs";
import { useBuilder } from "../../context/BuilderContext";
import { getFilesApi } from "../../services/builders/jobs";
import { FiActivity, FiDownload, FiAlertCircle } from "react-icons/fi";
import MotionDashboard from "../MotionDashboard";
import ImportDashboard from "../ImportDashboard";
import CtfDashboard from "../CtfDashboard";
import AutoPickDashboard from "../AutoPickDashboard";
import ExtractDashboard from "../ExtractDashboard";
import Class2DDashboard from "../Class2DDashboard";
import InitialModelDashboard from "../InitialModelDashboard";
import Class3DDashboard from "../Class3DDashboard";
import AutoRefineDashboard from "../AutoRefineDashboard";
import PostProcessDashboard from "../PostProcessDashboard";
import PolishDashboard from "../PolishDashboard";
import CTFRefineDashboard from "../CTFRefineDashboard";
import MaskCreateDashboard from "../MaskCreateDashboard";
import LocalResDashboard from "../LocalResDashboard";
import ModelAngeloDashboard from "../ModelAngeloDashboard";
import DynamightDashboard from "../DynamightDashboard";
import ManualSelectDashboard from "../ManualSelectDashboard";
import SubsetDashboard from "../SubsetDashboard";
import SubtractDashboard from "../SubtractDashboard";
import JoinStarDashboard from "../JoinStarDashboard";
import DashboardErrorBoundary from "../common/DashboardErrorBoundary";

const JobDashboard = () => {
  const [files, setFiles] = useState([]);
  const [isLoading, setLoading] = useState(true);
  const [viewMode, setViewMode] = useState("dashboard"); // "dashboard" or "issues"
  const [showDownloads, setShowDownloads] = useState(false);
  const { selectedJob, projectId } = useBuilder();

  // Job type checks - all use PascalCase (standardized format from backend)
  const jobType = selectedJob?.jobType;

  const isMotionJob = jobType === "MotionCorr";
  const isImportJob = jobType === "Import";
  const isCtfJob = jobType === "CtfFind";
  const isAutoPickJob = jobType === "AutoPick";
  const isExtractJob = jobType === "Extract";
  const isClass2DJob = jobType === "Class2D";
  const isInitialModelJob = jobType === "InitialModel";
  const isClass3DJob = jobType === "Class3D";
  const isAutoRefineJob = jobType === "AutoRefine";
  const isPostProcessJob = jobType === "PostProcess";
  const isPolishJob = jobType === "Polish";
  const isCTFRefineJob = jobType === "CtfRefine";
  const isMaskCreateJob = jobType === "MaskCreate";
  const isLocalResJob = jobType === "LocalRes";
  const isModelAngeloJob = jobType === "ModelAngelo";
  const isDynamightJob = jobType === "Dynamight";
  const isManualSelectJob = jobType === "ManualSelect";
  const isSubsetJob = jobType === "Subset";
  const isSubtractJob = jobType === "Subtract";
  const isJoinStarJob = jobType === "JoinStar";

  // Check if this job type supports dashboard view
  const hasDashboard = isMotionJob || isImportJob || isCtfJob || isAutoPickJob || isExtractJob || isClass2DJob || isInitialModelJob || isClass3DJob || isAutoRefineJob || isPostProcessJob || isPolishJob || isCTFRefineJob || isMaskCreateJob || isLocalResJob || isModelAngeloJob || isDynamightJob || isManualSelectJob || isSubsetJob || isSubtractJob || isJoinStarJob;

  useEffect(() => {
    if (selectedJob?.id) {
      getFilesApi(projectId, selectedJob?.id)
        .then((response) => {
          if (response?.data?.files?.length > 0) {
            setFiles(response?.data?.files || []);
          }
        })
        .catch((err) => {
          setFiles([]);
        })
        .finally(() => {
          setLoading(false);
        });
    }
  }, [selectedJob?.id, projectId]);

  useEffect(() => {
    setLoading(true);
    // Reset to dashboard view for jobs that have dashboards
    if (hasDashboard) {
      setViewMode("dashboard");
    } else {
      setViewMode("issues");
    }
  }, [selectedJob, hasDashboard]);



  return (
    <div className="logs-area">
      {/* Header */}
      <div className="logs-header">
        <div className="logs-header-content">
          {/* View mode toggle for jobs with dashboards */}
          {hasDashboard ? (
            <div className="logs-view-toggle">
              <button
                onClick={() => setViewMode("dashboard")}
                className={`logs-toggle-btn ${viewMode === "dashboard" ? "logs-toggle-btn-active" : ""}`}
              >
                <FiActivity size={14} />
                Dashboard
              </button>
              <button
                onClick={() => setViewMode("issues")}
                className={`logs-toggle-btn ${viewMode === "issues" ? "logs-toggle-btn-active" : ""} ${selectedJob?.status === "failed" ? "logs-toggle-btn-error" : ""}`}
              >
                <FiAlertCircle size={14} />
                Log
              </button>
              {files.length > 0 && (
                <div className="logs-download-wrapper">
                  <button
                    onClick={() => setShowDownloads(!showDownloads)}
                    className="logs-toggle-btn logs-download-btn"
                  >
                    <FiDownload size={14} />
                    Downloads
                  </button>
                  {showDownloads && (
                    <div className="logs-download-menu">
                      {files.map((file, index) => (
                        <button
                          key={index}
                          className="logs-download-item"
                          onClick={() => {
                            window.open(file.url, "_blank");
                            setShowDownloads(false);
                          }}
                        >
                          {file.fileName}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : selectedJob?.id ? (
            <div className="logs-view-toggle">
              <span className="logs-toggle-btn logs-toggle-btn-active">
                <FiAlertCircle size={14} />
                Logs
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {isMotionJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Motion Correction" key={`motion-${selectedJob?.id}`}><MotionDashboard /></DashboardErrorBoundary>
      )}
      {isImportJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Import" key={`import-${selectedJob?.id}`}><ImportDashboard /></DashboardErrorBoundary>
      )}
      {isCtfJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="CTF Estimation" key={`ctf-${selectedJob?.id}`}><CtfDashboard /></DashboardErrorBoundary>
      )}
      {isAutoPickJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Auto-Picking" key={`autopick-${selectedJob?.id}`}><AutoPickDashboard /></DashboardErrorBoundary>
      )}
      {isExtractJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Extraction" key={`extract-${selectedJob?.id}`}><ExtractDashboard /></DashboardErrorBoundary>
      )}
      {isClass2DJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="2D Classification" key={`class2d-${selectedJob?.id}`}><Class2DDashboard /></DashboardErrorBoundary>
      )}
      {isInitialModelJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Initial Model" key={`initmodel-${selectedJob?.id}`}><InitialModelDashboard /></DashboardErrorBoundary>
      )}
      {isClass3DJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="3D Classification" key={`class3d-${selectedJob?.id}`}><Class3DDashboard /></DashboardErrorBoundary>
      )}
      {isAutoRefineJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Auto-Refine" key={`autorefine-${selectedJob?.id}`}><AutoRefineDashboard /></DashboardErrorBoundary>
      )}
      {isPostProcessJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Post-Processing" key={`postprocess-${selectedJob?.id}`}><PostProcessDashboard /></DashboardErrorBoundary>
      )}
      {isPolishJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Polishing" key={`polish-${selectedJob?.id}`}><PolishDashboard /></DashboardErrorBoundary>
      )}
      {isCTFRefineJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="CTF Refinement" key={`ctfrefine-${selectedJob?.id}`}><CTFRefineDashboard /></DashboardErrorBoundary>
      )}
      {isMaskCreateJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Mask Creation" key={`mask-${selectedJob?.id}`}><MaskCreateDashboard /></DashboardErrorBoundary>
      )}
      {isLocalResJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Local Resolution" key={`localres-${selectedJob?.id}`}><LocalResDashboard /></DashboardErrorBoundary>
      )}
      {isModelAngeloJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="ModelAngelo" key={`modelangelo-${selectedJob?.id}`}><ModelAngeloDashboard /></DashboardErrorBoundary>
      )}
      {isDynamightJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="DynaMight" key={`dynamight-${selectedJob?.id}`}><DynamightDashboard /></DashboardErrorBoundary>
      )}
      {isManualSelectJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Select Classes" key={`manualselect-${selectedJob?.id}`}><ManualSelectDashboard /></DashboardErrorBoundary>
      )}
      {isSubsetJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Subset Selection" key={`subset-${selectedJob?.id}`}><SubsetDashboard /></DashboardErrorBoundary>
      )}
      {isSubtractJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Subtraction" key={`subtract-${selectedJob?.id}`}><SubtractDashboard /></DashboardErrorBoundary>
      )}
      {isJoinStarJob && viewMode === "dashboard" && (
        <DashboardErrorBoundary name="Join Star" key={`joinstar-${selectedJob?.id}`}><JoinStarDashboard /></DashboardErrorBoundary>
      )}

      {/* Issues & Logs View - JobLogs component with Issues tab */}
      {viewMode === "issues" && selectedJob?.id && (
        <div className="issues-logs-container">
          <JobLogs
            jobId={selectedJob.id}
            autoRefresh={["running", "pending"].includes(selectedJob?.status)}
          />
        </div>
      )}

      {/* Fallback for jobs without dashboards - show logs instead */}
      {!hasDashboard && selectedJob?.id && viewMode === "dashboard" && (
        <div className="issues-logs-container">
          <JobLogs
            jobId={selectedJob.id}
            autoRefresh={["running", "pending"].includes(selectedJob?.status)}
          />
        </div>
      )}

      {/* No job selected state */}
      {!selectedJob?.id && (
        <div className="logs-content">
          <div className="logs-empty-state">
            <div className="logs-empty-icon">
              <FiActivity />
            </div>
            <p className="logs-empty-title">No Job Selected</p>
            <p className="logs-empty-subtitle">
              Select a job from the list to view its dashboard or logs.
            </p>
          </div>
        </div>
      )}

      <style>{`
        .logs-area {
          display: flex;
          flex-direction: column;
          background: var(--color-bg-card);
          padding: 0;
        }
        .logs-header {
          background: var(--color-bg-hover);
          position: sticky;
          top: 0;
          z-index: 10;
          padding: 4px 16px;
          height: 36px;
          box-sizing: border-box;
          border-bottom: 1px solid var(--color-border);
          display: flex;
          align-items: center;
        }
        .logs-header-content {
          display: flex;
          align-items: center;
          height: 28px;
          box-sizing: border-box;
        }
        .logs-view-toggle {
          display: flex;
          align-items: center;
          background: transparent;
          padding: 0;
          gap: 4px;
          height: 28px;
          box-sizing: border-box;
        }
        .logs-toggle-btn {
          display: flex;
          align-items: center;
          gap: 4px;
          padding: 4px 10px;
          font-size: 12px;
          font-weight: 500;
          color: var(--color-text-secondary);
          background: transparent;
          border: none;
          border-radius: 6px;
          cursor: pointer;
          transition: all 50ms ease;
          white-space: nowrap;
          height: 28px;
          box-sizing: border-box;
        }
        .logs-toggle-btn:hover {
          color: var(--color-text);
        }
        .logs-toggle-btn-active {
          color: var(--color-primary);
          font-weight: 600;
        }
        .logs-toggle-btn-error {
          color: var(--color-danger-text);
        }
        .logs-toggle-btn-error.logs-toggle-btn-active {
          color: var(--color-danger-text);
        }
        .logs-download-wrapper {
          position: relative;
        }
        .logs-download-btn {
          background: transparent;
          transition: all 50ms ease;
        }
        .logs-download-btn:hover {
          background: var(--color-bg-card);
          color: var(--color-text);
        }
        .logs-download-menu {
          position: absolute;
          top: 100%;
          left: 0;
          margin-top: 4px;
          min-width: 200px;
          max-height: 300px;
          overflow-y: auto;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
          z-index: 50;
        }
        .logs-download-item {
          display: block;
          width: 100%;
          padding: 10px 14px;
          font-size: 12px;
          color: var(--color-text-label);
          background: transparent;
          border: none;
          border-bottom: 1px solid var(--color-bg-hover);
          text-align: left;
          cursor: pointer;
          transition: background 50ms ease;
        }
        .logs-download-item:last-child {
          border-bottom: none;
        }
        .logs-download-item:hover {
          background: var(--color-bg-hover);
          color: var(--color-primary);
        }
        .logs-content {
          flex: 1;
          padding: 0;
        }
        .logs-empty-state {
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          min-height: 400px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 32px;
          text-align: center;
        }
        .logs-empty-icon {
          width: 56px;
          height: 56px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 28px;
          color: var(--color-text-muted);
          background: var(--color-bg-hover);
          border-radius: 50%;
          margin-bottom: 16px;
        }
        .logs-loading-icon {
          color: var(--color-primary);
          animation: spin 1s linear infinite;
        }
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        .logs-empty-title {
          font-size: 16px;
          font-weight: 600;
          color: var(--color-text);
          margin: 0 0 8px 0;
        }
        .logs-empty-subtitle {
          font-size: 13px;
          color: var(--color-text-secondary);
          margin: 0;
          max-width: 300px;
          line-height: 1.5;
        }
        .issues-logs-container {
          padding: 0;
          background: var(--color-bg-card);
          border-radius: 12px;
          overflow: hidden;
        }
      `}</style>
    </div>
  );
};

export default JobDashboard;
