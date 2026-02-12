import React, { useState, useRef, useEffect } from "react";
import { FiMoreHorizontal, FiTrash2, FiCheckCircle, FiXCircle, FiCopy, FiColumns, FiBell, FiCheck } from "react-icons/fi";
import { BiLoader } from "react-icons/bi";
import { cancelJobById, deleteJob, updateJobStatus, toggleJobNotifyEmail } from "../../../../services/slurmApi";
import { getJobDetailsApi } from "../../../../services/builders/jobs";
import { useBuilder } from "../../../../context/BuilderContext";
import JobLogs from "../JobLogs";
import JobComparisonModal from "../../../JobComparison";
import "./JobActions.css";

/**
 * JobActions Component - Dropdown menu for job management actions
 *
 * Features:
 * - Copy job parameters (opens job form with pre-filled parameters)
 * - Delete job (requires typing "delete/JobXXX" to confirm)
 * - Mark as Finished (requires typing job name to confirm)
 * - Mark as Error (requires typing job name to confirm)
 * - Cancel running job
 * - View job logs
 *
 * Props:
 * - jobId: CryoScale job ID
 * - jobName: Job name (e.g., "Job024")
 * - jobType: Job type (e.g., "Motion", "CTF", "Class2D")
 * - jobStatus: Current job status ('running', 'pending', 'success', 'error', 'cancelled')
 * - onJobUpdated: Callback when job is updated/deleted
 * - showLogs: Show logs button (default: true)
 * - showCancel: Show cancel button (default: true)
 * - showCopy: Show copy button (default: true)
 * - notifyEmail: Whether email notification is enabled for this job
 */
const JobActions = ({
  jobId,
  jobName,
  jobType,
  jobStatus,
  onJobUpdated,
  onJobCancelled,
  notifyEmail: initialNotifyEmail = false,
  showLogs = true,
  showCancel = true,
  showCopy = true,
  showCompare = true,
}) => {
  const { setCopiedJobParams, emailNotificationsEnabled } = useBuilder();
  const [showLogsModal, setShowLogsModal] = useState(false);
  const [showCompareModal, setShowCompareModal] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [activeAction, setActiveAction] = useState(null); // 'delete' | 'finished' | 'error' | 'cancel'
  const [confirmInput, setConfirmInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [notifyEmail, setNotifyEmail] = useState(initialNotifyEmail);
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef(null);

  const canCancel = ["running", "pending", "queued"].includes(jobStatus);

  // Calculate dropdown position when menu opens
  useEffect(() => {
    if (showMenu && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
      });
    }
  }, [showMenu]);

  const handleMenuToggle = (e) => {
    e.stopPropagation();
    setShowMenu(!showMenu);
    setActiveAction(null);
    setConfirmInput("");
    setError(null);
  };

  const handleActionSelect = (e, action) => {
    e.stopPropagation();
    setActiveAction(action);
    setConfirmInput("");
    setError(null);
  };

  const handleInputChange = (e) => {
    e.stopPropagation();
    setConfirmInput(e.target.value);
    setError(null);
  };

  const getExpectedInput = () => {
    if (activeAction === "delete") {
      return `delete/${jobName}`;
    }
    return jobName;
  };

  const handleConfirm = async (e) => {
    e.stopPropagation();

    const expected = getExpectedInput();
    if (confirmInput !== expected) {
      setError(`Please type exactly: ${expected}`);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result;
      if (activeAction === "delete") {
        result = await deleteJob(jobId);
      } else if (activeAction === "finished") {
        result = await updateJobStatus(jobId, "success");
      } else if (activeAction === "error") {
        result = await updateJobStatus(jobId, "error");
      } else if (activeAction === "cancel") {
        result = await cancelJobById(jobId);
        if (result.success && onJobCancelled) {
          onJobCancelled(jobId);
        }
      }

      if (result?.success) {
        setShowMenu(false);
        setActiveAction(null);
        setConfirmInput("");
        if (onJobUpdated) {
          onJobUpdated(activeAction, jobId);
        }
      } else {
        setError(result?.error || "Action failed");
      }
    } catch (err) {
      setError(err.message || "Action failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleCancel = (e) => {
    e.stopPropagation();
    setActiveAction(null);
    setConfirmInput("");
    setError(null);
  };

  const handleKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      handleConfirm(e);
    } else if (e.key === "Escape") {
      handleCancel(e);
    }
  };

  const closeMenu = (e) => {
    e?.stopPropagation();
    setShowMenu(false);
    setActiveAction(null);
    setConfirmInput("");
    setError(null);
  };

  // Handle toggle email notification
  const handleToggleNotify = async (e) => {
    e.stopPropagation();
    try {
      const result = await toggleJobNotifyEmail(jobId);
      if (result?.success) {
        setNotifyEmail(result.notify_email);
      }
    } catch (err) {
      console.error("Failed to toggle notification:", err);
    }
  };

  // Map job_type (from database) to UI job names for navigation
  // Includes both stage names (AutoPick) and job_type values (auto_picking)
  const stageToUiJobName = {
    // Stage names (database job_type values)
    "LinkMovies": "Link Movies",
    "Import": "Import",
    "MotionCorr": "Motion Correction",
    "CtfFind": "CTF Estimation",
    "ManualPick": "Manual Picking",
    "AutoPick": "Auto-Picking",
    "Extract": "Particle extraction",
    "Class2D": "2D classification",
    "Class3D": "3D classification",
    "InitialModel": "3D initial model",
    "AutoRefine": "3D auto-refine",
    "Multibody": "3D multi-body",
    "Subset": "Subset selection",
    "CtfRefine": "CTF refinement",
    "Polish": "Bayesian polishing",
    "MaskCreate": "Mask creation",
    "PostProcess": "Post-processing",
    "JoinStar": "Join star files",
    "Subtract": "Particle subtraction",
    "LocalRes": "Local resolution",
    "Dynamight": "DynaMight flexibility",
    "ModelAngelo": "ModelAngelo building",
    "ManualSelect": "Select Classes",
    // API job type values (used for submission)
    "link_movies": "Link Movies",
    "import": "Import",
    "motion_correction": "Motion Correction",
    "ctf_estimation": "CTF Estimation",
    "manual_picking": "Manual Picking",
    "auto_picking": "Auto-Picking",
    "particle_extraction": "Particle extraction",
    "class_2d": "2D classification",
    "class_3d": "3D classification",
    "initial_model": "3D initial model",
    "auto_refine": "3D auto-refine",
    "multi_body": "3D multi-body",
    "subset_selection": "Subset selection",
    "ctf_refine": "CTF refinement",
    "bayesian_polishing": "Bayesian polishing",
    "mask_create": "Mask creation",
    "post_process": "Post-processing",
    "join_star": "Join star files",
    "particle_subtraction": "Particle subtraction",
    "local_resolution": "Local resolution",
    "dynamight": "DynaMight flexibility",
    "model_angelo": "ModelAngelo building",
    "manual_select": "Select Classes",
  };

  // Handle copy job action
  const handleCopyJob = async (e) => {
    e.stopPropagation();
    setIsLoading(true);
    setError(null);

    try {
      const response = await getJobDetailsApi(jobId);

      if (response?.data?.status === "success") {
        const params = response.data.data.parameters || {};
        const type = response.data.data.job_type || jobType;
        const uiJobName = stageToUiJobName[type] || type;


        // Set copied parameters in context and switch to that form
        setCopiedJobParams(params, uiJobName);
        closeMenu(e);
      } else {
        console.error("[CopyJob] Failed - unexpected response:", response?.data);
        setError("Failed to get job parameters");
      }
    } catch (err) {
      console.error("[CopyJob] Error:", err);
      console.error("[CopyJob] Error details:", err.response?.data || err.message);
      setError(err.message || "Failed to copy job");
    } finally {
      setIsLoading(false);
    }
  };

  const getActionTitle = () => {
    switch (activeAction) {
      case "delete":
        return "Delete Job";
      case "finished":
        return "Mark as Finished";
      case "error":
        return "Mark as Error";
      case "cancel":
        return "Cancel Job";
      default:
        return "";
    }
  };

  return (
    <div className="job-actions">
      {showLogs && (
        <button
          className="job-action-btn logs-btn"
          onClick={(e) => {
            e.stopPropagation();
            setShowLogsModal(true);
          }}
          title="View job logs"
          aria-label="View job logs"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
            <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
            <polyline points="10 9 9 9 8 9"/>
          </svg>
          Logs
        </button>
      )}

      {/* More Actions Menu */}
      <div className="job-actions-menu-container">
        <button
          ref={buttonRef}
          className="job-action-btn more-btn"
          onClick={handleMenuToggle}
          title="More actions"
          aria-label="More actions"
          aria-expanded={showMenu}
          aria-haspopup="menu"
        >
          <FiMoreHorizontal size={14} aria-hidden="true" />
        </button>

        {showMenu && (
          <>
            <div className="job-actions-overlay" onClick={closeMenu} role="presentation" />
            <div
              className="job-actions-dropdown"
              style={{ top: dropdownPosition.top, left: dropdownPosition.left }}
              role={activeAction ? "alertdialog" : "menu"}
              aria-label={activeAction ? getActionTitle() : "Job actions"}
            >
              {!activeAction ? (
                // Menu items
                <div className="job-actions-menu-list">
                  {showCopy && (
                    <button
                      className="job-menu-item job-menu-copy"
                      onClick={handleCopyJob}
                      disabled={isLoading}
                      role="menuitem"
                    >
                      {isLoading ? <BiLoader className="animate-spin" aria-hidden="true" /> : <FiCopy aria-hidden="true" />}
                      <span>Copy Job</span>
                    </button>
                  )}
                  {showCompare && (
                    <button
                      className="job-menu-item job-menu-copy"
                      onClick={(e) => {
                        e.stopPropagation();
                        closeMenu(e);
                        setShowCompareModal(true);
                      }}
                      role="menuitem"
                    >
                      <FiColumns aria-hidden="true" />
                      <span>Compare</span>
                    </button>
                  )}
                  {showCancel && canCancel && (
                    <button
                      className="job-menu-item job-menu-cancel"
                      onClick={(e) => handleActionSelect(e, "cancel")}
                      role="menuitem"
                    >
                      <FiXCircle aria-hidden="true" />
                      <span>Cancel Job</span>
                    </button>
                  )}
                  <button
                    className="job-menu-item job-menu-finished"
                    onClick={(e) => handleActionSelect(e, "finished")}
                    role="menuitem"
                  >
                    <FiCheckCircle aria-hidden="true" />
                    <span>Mark as Finished</span>
                  </button>
                  <button
                    className="job-menu-item job-menu-error"
                    onClick={(e) => handleActionSelect(e, "error")}
                    role="menuitem"
                  >
                    <FiXCircle aria-hidden="true" />
                    <span>Mark as Error</span>
                  </button>
                  <button
                    className={`job-menu-item job-menu-notify${notifyEmail ? ' active' : ''}${!emailNotificationsEnabled ? ' disabled' : ''}`}
                    onClick={emailNotificationsEnabled ? handleToggleNotify : undefined}
                    disabled={!emailNotificationsEnabled}
                    role="menuitem"
                    title={!emailNotificationsEnabled ? 'Email notifications not configured' : ''}
                  >
                    <FiBell aria-hidden="true" />
                    <span>Email on completion</span>
                    {notifyEmail && emailNotificationsEnabled && <FiCheck size={12} className="notify-check" aria-hidden="true" />}
                  </button>
                  <div className="job-menu-divider" role="separator" />
                  <button
                    className="job-menu-item job-menu-delete"
                    onClick={(e) => handleActionSelect(e, "delete")}
                    role="menuitem"
                  >
                    <FiTrash2 aria-hidden="true" />
                    <span>Delete Job</span>
                  </button>
                </div>
              ) : (
                // Confirmation dialog
                <div className="job-confirm-dialog">
                  <div className={`job-confirm-header job-confirm-${activeAction}`}>
                    {getActionTitle()}
                  </div>
                  <div className="job-confirm-body">
                    <p className="job-confirm-instruction">
                      {activeAction === "delete"
                        ? "To delete this job permanently, type:"
                        : "To confirm this action, type the job name:"}
                    </p>
                    <code className="job-confirm-code">{getExpectedInput()}</code>
                    <input
                      type="text"
                      className="job-confirm-input"
                      placeholder={`Type: ${getExpectedInput()}`}
                      value={confirmInput}
                      onChange={handleInputChange}
                      onKeyDown={handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                      autoFocus
                      aria-label={`Type ${getExpectedInput()} to confirm`}
                    />
                    {error && <p className="job-confirm-error" role="alert">{error}</p>}
                  </div>
                  <div className="job-confirm-actions">
                    <button
                      className="job-confirm-btn job-confirm-btn-cancel"
                      onClick={handleCancel}
                      disabled={isLoading}
                    >
                      Cancel
                    </button>
                    <button
                      className={`job-confirm-btn job-confirm-btn-${activeAction}`}
                      onClick={handleConfirm}
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <BiLoader className="animate-spin" />
                      ) : (
                        "Confirm"
                      )}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Logs Modal */}
      {showLogsModal && (
        <div className="modal-overlay" onClick={() => setShowLogsModal(false)} role="presentation">
          <div className="modal-content logs-modal" onClick={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Job logs">
            <JobLogs
              jobId={jobId}
              autoRefresh={["running", "pending"].includes(jobStatus)}
              maxHeight="500px"
              onClose={() => setShowLogsModal(false)}
            />
          </div>
        </div>
      )}

      {/* Compare Modal */}
      {showCompareModal && (
        <JobComparisonModal
          jobId={jobId}
          jobName={jobName}
          jobType={jobType}
          onClose={() => setShowCompareModal(false)}
        />
      )}
    </div>
  );
};

export default JobActions;
