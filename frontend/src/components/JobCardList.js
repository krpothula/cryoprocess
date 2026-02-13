import React from "react";
import PropTypes from "prop-types";
import { BiLoader } from "react-icons/bi";
import { AiOutlineCloseCircle } from "react-icons/ai";
import { MdCheckCircle, MdCancel } from "react-icons/md";
import { formatDateString } from "../utils/datetime";
import JobActions from "./Tabs/common/JobActions";
import { JOB_STATUS, getStatusCssVar } from "../utils/jobStatus";

const getStatusStyle = (status) => {
  return { color: getStatusCssVar(status) };
};

const getIcon = (status) => {
  switch (status) {
    case JOB_STATUS.FAILED:
      return <AiOutlineCloseCircle />;
    case JOB_STATUS.PENDING:
    case JOB_STATUS.RUNNING:
      return <BiLoader className="animate-spin" />;
    case JOB_STATUS.SUCCESS:
      return <MdCheckCircle />;
    case JOB_STATUS.CANCELLED:
      return <MdCancel />;
    default:
      return null;
  }
};

// Map job_type (PascalCase) to display names
const JOB_TYPE_DISPLAY_NAMES = {
  LinkMovies: "Link Movies",
  Import: "Import",
  MotionCorr: "Motion Correction",
  CtfFind: "CTF Estimation",
  ManualPick: "Manual Picking",
  AutoPick: "Auto-Picking",
  Extract: "Particle Extraction",
  Class2D: "2D Classification",
  Class3D: "3D Classification",
  InitialModel: "3D Initial Model",
  AutoRefine: "3D Auto-Refine",
  Multibody: "3D Multi-Body",
  Subset: "Subset Selection",
  CtfRefine: "CTF Refinement",
  Polish: "Bayesian Polishing",
  MaskCreate: "Mask Creation",
  PostProcess: "Post-Processing",
  JoinStar: "Join Star Files",
  Subtract: "Particle Subtraction",
  LocalRes: "Local Resolution",
  Dynamight: "DynaMight",
  ModelAngelo: "ModelAngelo",
  ManualSelect: "Select Classes",
};

const getJobTypeDisplayName = (jobType) => {
  return JOB_TYPE_DISPLAY_NAMES[jobType] || jobType;
};

const JobCardList = ({ jobs, setSelectedJob, selectedJob, onJobCancelled, onJobUpdated }) => {
  const handleJobUpdated = (action, jobId) => {
    // Refresh job list when job is deleted or status changed
    if (onJobUpdated) {
      onJobUpdated(action, jobId);
    }
    // For delete, also call onJobCancelled to refresh the list
    if (action === "delete" && onJobCancelled) {
      onJobCancelled(jobId);
    }
  };

  return (
    <>
      <div className="job-cards-container">
        {jobs.map((job) => {
          const isSelected = selectedJob?.id === job.id;
          const statusStyle = getStatusStyle(job.status);

          return (
            <div
              key={job.id}
              className={`job-card ${isSelected ? 'job-card-selected' : ''}`}
              id={`jb${job.id}`}
              onClick={() => setSelectedJob(job)}
              role="button"
              tabIndex="0"
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedJob(job); } }}
              aria-label={`${job.job_name} - ${getJobTypeDisplayName(job.job_type)} - ${job.status}`}
              aria-pressed={isSelected}
            >
              <div className="job-card-header">
                <span
                  className="job-name"
                  style={{ color: statusStyle.color }}
                >
                  <span aria-hidden="true">{getIcon(job.status)}</span>
                  {job.job_name}
                </span>
                <JobActions
                  jobId={job.id}
                  jobName={job.job_name}
                  jobType={job.job_type}
                  jobStatus={job.status}
                  notifyEmail={job.notify_email}
                  onJobUpdated={handleJobUpdated}
                  onJobCancelled={onJobCancelled}
                  showLogs={false}
                  showCancel={true}
                  showCopy={true}
                />
              </div>
              <div className="job-card-details">
                <span className="job-type">{getJobTypeDisplayName(job.job_type)}</span>
                <span className="job-date">{formatDateString(job.start_time)}</span>
              </div>
            </div>
          );
        })}
      </div>

      <style>{`
        .job-cards-container {
          display: flex;
          flex-direction: column;
          gap: 0;
          padding-right: 0;
        }

        .job-card {
          padding: 12px 14px;
          background: var(--color-bg-card);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .job-card:hover {
          border-color: var(--color-border-hover);
        }

        .job-card-selected {
          border-color: var(--color-primary);
          background: var(--color-bg-card);
          box-shadow: 0 0 0 1px var(--color-primary);
        }

        .job-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 8px;
          margin-bottom: 8px;
        }

        .job-name {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          font-size: 12px;
          font-weight: 600;
          line-height: 1.3;
          flex: 1;
          min-width: 0;
        }

        .job-name svg {
          font-size: 14px;
          flex-shrink: 0;
        }

        .job-card-details {
          display: flex;
          justify-content: space-between;
          align-items: center;
        }

        .job-type {
          font-size: 12px;
          color: var(--color-text-secondary);
          text-transform: capitalize;
        }

        .job-date {
          font-size: 11px;
          color: var(--color-text-muted);
        }

        .job-card {
          position: relative;
        }

      `}</style>
    </>
  );
};

JobCardList.propTypes = {
  jobs: PropTypes.arrayOf(
    PropTypes.shape({
      id: PropTypes.string.isRequired,
      job_name: PropTypes.string.isRequired,
      status: PropTypes.string.isRequired,
      start_time: PropTypes.string,
    })
  ).isRequired,
  setSelectedJob: PropTypes.func.isRequired,
  selectedJob: PropTypes.object,
  onJobCancelled: PropTypes.func,
  onJobUpdated: PropTypes.func,
};

export default JobCardList;
