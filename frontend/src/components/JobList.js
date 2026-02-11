import React from "react";
import "./JobList.css";

const JobList = ({ selectedJob, onSelectJob }) => {
  const jobs = [
    "Import",
    "Motion Correction",
    "CTF Estimation",
    // "Manual Picking", // Hidden for now
    "Auto-Picking",
    "Particle extraction",
    "2D classification",
    "Select Classes",
    "3D initial model",
    "3D classification",
    "3D auto-refine",
    "3D multi-body",
    "Subset selection",
    "CTF refinement",
    "Bayesian polishing",
    "DynaMight flexibility",
    "Mask creation",
    "Join star files",
    "Particle substraction",
    "Post-processing",
    "Local resolution",
    "ModelAngelo building",
  ];

  const handleJobSelect = (job) => {
    onSelectJob(job);
  };

  return (
    <div className="joblist">
      <ul className="joblist-items">
        {jobs.map((job, index) => {
          const isSelected = selectedJob === job;

          return (
            <li key={index}>
              <button
                className={`joblist-item ${isSelected ? 'joblist-item-active' : ''}`}
                onClick={() => handleJobSelect(job)}
              >
                <span className="joblist-label">{job}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default JobList;
