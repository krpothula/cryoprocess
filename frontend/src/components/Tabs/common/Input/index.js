import React, { useState, useRef, useEffect } from "react";
import { IoInformationCircleOutline } from "react-icons/io5";
import { PiBrowser } from "react-icons/pi";
import { getStageOptimiserFilesApi, getStageOutputFilesApi } from "../../../../services/builders/jobs";
import { BiLoader } from "react-icons/bi";
import { FiCheckCircle, FiAlertCircle, FiClock, FiChevronDown, FiChevronRight } from "react-icons/fi";
import { useBuilder } from "../../../../context/BuilderContext";

// Display names for stage types in dropdowns
const STAGE_DISPLAY_NAMES = {
  ManualSelect: "Select Classes",
  CtfFind: "CTF Estimation",
  MotionCorr: "Motion Correction",
};

/**
 * Transform optimiser files API response to grouped format with job info
 * Groups files by stage name, showing _optimiser.star files for continuing stalled jobs
 * Format: Stage header -> Job001/run_it025_optimiser.star (iter 25)
 * Returns { groups: [...], message: string | null }
 */
function transformOptimiserFilesResponse(apiResponse, stage) {
  const result = { groups: [], message: null };

  // Extract message if present (helpful when no files found)
  if (apiResponse?.data?.data?.message) {
    result.message = apiResponse.data.data.message;
  }

  if (!apiResponse?.data?.data?.files || !Array.isArray(apiResponse.data.data.files)) {
    return result;
  }

  // Group all files under the stage name, with job/filename format
  // Extract just the job folder (e.g., "Job035") if job_name contains a path like "Select/Job035"
  const files = apiResponse.data.data.files.map((file) => {
    const jobFolder = file.jobName?.includes('/')
      ? file.jobName.split('/').pop()
      : file.jobName;
    return {
      name: `${jobFolder}/${file.fileName}`,
      path: file.filePath,
      jobStatus: file.jobStatus,
      jobName: file.jobName,
      createdAt: file.createdAt,
      iteration: file.iteration,
    };
  });

  if (files.length > 0) {
    const displayName = STAGE_DISPLAY_NAMES[stage] || stage;
    result.groups = [{
      group: `${displayName} (Continue From)`,
      jobStatus: "success",
      files: files,
    }];
  }

  return result;
}

/**
 * Transform database-backed stage output files response to grouped format.
 * Groups files by jobType (stage), with job/filename labels and entry counts.
 * Works for both STAR and MRC files from the unified stage-outputs API.
 */
function transformStageOutputFilesResponse(apiResponse) {
  const result = { groups: [], message: null };

  const files = apiResponse?.data?.data;
  if (!Array.isArray(files) || files.length === 0) {
    return result;
  }

  // Group by jobType (stage)
  const groupMap = {};
  for (const file of files) {
    const stage = file.jobType || 'Unknown';
    if (!groupMap[stage]) {
      groupMap[stage] = {
        group: STAGE_DISPLAY_NAMES[stage] || stage,
        jobStatus: 'success',
        files: [],
      };
    }
    groupMap[stage].files.push({
      name: `${file.jobName}/${file.fileName}`,
      path: file.filePath,
      entryCount: file.entryCount || 0,
      jobStatus: file.jobStatus,
      jobName: file.jobName,
      createdAt: file.createdAt,
    });
  }

  result.groups = Object.values(groupMap);
  return result;
}

const CustomInput = ({
  type,
  isCustomUpload,
  name,
  label,
  tooltipText,
  disabled = false,
  onFileSelect,
  placeholder,
  value,
  onChange,
  stageStarFiles, // Stage name for fetching star files (e.g., "Import", "Motion", "CTF")
  stageMrcFiles, // Stage name for fetching MRC reference maps (e.g., "InitialModel", "Class3D", "AutoRefine")
  stageOptimiserFiles, // Stage name for fetching optimiser files for continuing stalled jobs (e.g., "Class2D", "Class3D")
  stageRole, // Filter by role: 'particlesStar', 'modelStar', 'referenceMrc', etc. (optional)
  jobType,
  showBrowseButton = false, // Show a browse button to open file explorer
  onBrowseClick, // Callback when browse button is clicked
  browseOnly = false, // Show only input + browse button (no dropdown)
}) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState(value || "");
  const [showDropdown, setShowDropdown] = useState(false);
  const [groupedFiles, setGroupedFiles] = useState([]);
  const [filesLoading, setFilesLoading] = useState(false);
  const [stageMessage, setStageMessage] = useState(null); // Message from API when no files found
  const [expandedGroups, setExpandedGroups] = useState({}); // Track expanded state per group (collapsed by default)

  const { projectId, setActiveInputField } = useBuilder();
  const dropdownRef = useRef(null);

  // Sync searchQuery with value prop when parent updates it
  useEffect(() => {
    if (value !== undefined && value !== searchQuery) {
      setSearchQuery(value || "");
    }
  }, [value]);

  // Filter file groups by search query (case-insensitive)
  const filteredGroups = groupedFiles
    .map((group) => ({
      ...group,
      files: group.files.filter(
        (file) =>
          file?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          file?.path?.toLowerCase().includes(searchQuery.toLowerCase())
      ),
    }))
    .filter((group) => group.files.length > 0);

  const fileList = filteredGroups?.length > 0 ? filteredGroups : groupedFiles;

  /**
   * Effect 1: Fetch STAR files from completed jobs (database-backed)
   * Runs only if `stageStarFiles` is set.
   * Supports multiple stages (comma-separated, e.g., "Extract,Class2D").
   * Uses database output_files instead of filesystem scanning.
   */
  useEffect(() => {
    if (!stageStarFiles) return;

    setFilesLoading(true);
    setStageMessage(null);

    getStageOutputFilesApi(projectId, stageStarFiles, 'star', stageRole || '')
      .then((response) => {
        const { groups, message } = transformStageOutputFilesResponse(response);
        if (groups?.length > 0) setGroupedFiles(groups);
        if (message && groups.length === 0) setStageMessage(message);
      })
      .catch(() => { setStageMessage('Failed to load files'); })
      .finally(() => setFilesLoading(false));

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [stageStarFiles, stageRole, projectId]);

  /**
   * Effect 4: Fetch MRC files from completed jobs (database-backed)
   * Runs only if `stageMrcFiles` is set.
   * Supports multiple stages (comma-separated, e.g., "InitialModel,Class3D").
   * Uses database output_files instead of filesystem scanning.
   */
  useEffect(() => {
    if (!stageMrcFiles) return;

    setFilesLoading(true);
    setStageMessage(null);

    getStageOutputFilesApi(projectId, stageMrcFiles, 'mrc')
      .then((response) => {
        const { groups, message } = transformStageOutputFilesResponse(response);
        if (groups?.length > 0) setGroupedFiles(groups);
        if (message && groups.length === 0) setStageMessage(message);
      })
      .catch(() => { setStageMessage('Failed to load files'); })
      .finally(() => setFilesLoading(false));

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [stageMrcFiles, projectId]);

  /**
   * Effect 5: Fetch optimiser files for continuing stalled jobs
   * Runs only if `stageOptimiserFiles` is set.
   * Used for "Continue from here" functionality in classification/refinement jobs.
   */
  useEffect(() => {
    if (!stageOptimiserFiles) return;

    setFilesLoading(true);
    setStageMessage(null);

    getStageOptimiserFilesApi(projectId, stageOptimiserFiles)
      .then((response) => {
        const { groups, message } = transformOptimiserFilesResponse(response, stageOptimiserFiles);
        if (groups?.length > 0) setGroupedFiles(groups);
        if (message && groups.length === 0) setStageMessage(message);
      })
      .catch(() => { setStageMessage('Failed to load files'); })
      .finally(() => setFilesLoading(false));

    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [stageOptimiserFiles, projectId]);

  const handleOptionClick = (selectedValue) => {
    setSearchQuery(selectedValue);
    setShowDropdown(false);
    onChange(selectedValue);
  };

  const toggleGroup = (groupName) => {
    setExpandedGroups((prev) => ({ ...prev, [groupName]: !prev[groupName] }));
  };

  /**
   * Renders input types:
   * 1. `isCustomUpload` - Local file browser button
   * 2. `browseOnly` - Browse button only
   * 3. `stageStarFiles` - STAR file dropdown with job status
   * 4. `stageMrcFiles` - MRC file dropdown with job status
   * 5. `stageOptimiserFiles` - Optimiser file dropdown for continuing jobs
   * 6. Default - Plain text input
   */
  const renderInputField = () => {
    if (isCustomUpload) {
      return (
        <button
          style={{ width: "280px", minWidth: "280px", maxWidth: "280px", height: "32px", fontSize: "12px", border: "1px solid var(--color-border)", borderRadius: "6px" }}
          className={`flex items-center px-4 text-[var(--color-text-heading)] bg-[var(--color-bg-card)] focus:outline-none ${
            disabled ? "cursor-not-allowed opacity-30" : ""
          }`}
          onClick={onChange}
          title={value || "Browse File .."}
          type="button"
          disabled={disabled}
        >
          {value ? (
            <span className="whitespace-nowrap block w-full max-w-[320px] break-all overflow-x-auto no-scrollbar">
              {value}
            </span>
          ) : (
            <>
              Browse ...
              <PiBrowser className="text-base ml-auto" />
            </>
          )}
        </button>
      );
    }

    // Browse-only: shows selected path or browse button (no input field)
    else if (browseOnly && onBrowseClick) {
      return (
        <button
          type="button"
          onClick={onBrowseClick}
          disabled={disabled}
          style={{ width: "280px", minWidth: "280px", maxWidth: "280px", height: "32px", fontSize: "12px", border: "1px solid var(--color-border)", borderRadius: "6px" }}
          className={`px-3 bg-[var(--color-bg-card)] hover:bg-[var(--color-bg)] flex items-center gap-2 transition-colors text-left ${
            disabled ? "opacity-30 cursor-not-allowed" : ""
          }`}
          title={value || "Browse project folder"}
        >
          <PiBrowser className="text-[var(--color-text-secondary)] flex-shrink-0" style={{ fontSize: "14px" }} />
          {value ? (
            <span className="text-[var(--color-text-heading)] truncate flex-1" style={{ fontSize: "12px" }}>{value}</span>
          ) : (
            <span className="text-[var(--color-text-secondary)]" style={{ fontSize: "12px" }}>{placeholder || "Browse..."}</span>
          )}
        </button>
      );
    }

    // Stage STAR files dropdown with job status and entry count
    // Works for any stage: Import, Motion, CTF, etc.
    else if (stageStarFiles) {
      return (
        <div className="relative" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }} ref={dropdownRef}>
          <input
            id={name}
            name={name}
            type="text"
            value={searchQuery}
            placeholder={placeholder || `Select ${stageStarFiles} STAR file`}
            disabled={disabled}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
              onChange(e.target.value);
            }}
            onFocus={() => { setShowDropdown(true); setActiveInputField(name); }}
            style={{ width: "280px", maxWidth: "280px", height: "32px", fontSize: "12px" }}
            className={`border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg-card)] focus:outline-none ${
              disabled ? "opacity-30 cursor-not-allowed" : ""
            }`}
          />
          {showDropdown && (
            <div className="absolute z-10 w-full min-w-[400px] mt-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded shadow max-h-60 overflow-y-auto no-scrollbar">
              {filesLoading ? (
                <p className="flex items-center text-[var(--color-text-heading)] font-medium m-0 p-2" style={{ fontSize: "12px" }}>
                  <BiLoader className="mr-2 animate-spin" />
                  Loading {stageStarFiles} jobs...
                </p>
              ) : fileList.length > 0 ? (
                fileList.map((group, groupIdx) => {
                  const isExpanded = expandedGroups[group.group];
                  return (
                    <div key={groupIdx} className="border-b border-[var(--color-border-light)] last:border-b-0">
                      <div
                        className="flex items-center gap-2 font-bold text-[var(--color-text-heading)] py-1 px-2 cursor-pointer hover:bg-[var(--color-bg)] select-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => toggleGroup(group.group)}
                      >
                        {isExpanded ? <FiChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <FiChevronRight size={14} className="text-[var(--color-text-muted)]" />}
                        {group.jobStatus === "success" ? (
                          <FiCheckCircle className="text-[var(--color-success-text)]" size={14} />
                        ) : group.jobStatus === "failed" ? (
                          <FiAlertCircle className="text-[var(--color-danger-text)]" size={14} />
                        ) : (
                          <FiClock className="text-[var(--color-warning-text)]" size={14} />
                        )}
                        <span className="flex-1">{group.group}</span>
                        <span className="text-xs text-[var(--color-text-muted)] font-normal">{group.files.length}</span>
                      </div>
                      {isExpanded && group.files.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleOptionClick(file.path)}
                          className="cursor-pointer px-2 py-1 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-heading)]"
                          style={{ fontSize: "12px", paddingLeft: "28px" }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="flex-1 min-w-0" title={file.name}>{file.name}</span>
                            {file.entryCount > 0 && (
                              <span className="text-xs text-[var(--color-text-secondary)] flex-shrink-0">
                                ({file.entryCount})
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)] p-2">
                  {stageMessage || `No matching files found. Complete a ${stageStarFiles?.split(',')[0] || 'required'} job first.`}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Stage MRC files dropdown for reference maps
    // Works for any stage: InitialModel, Class3D, AutoRefine, etc.
    else if (stageMrcFiles) {
      return (
        <div className="relative" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }} ref={dropdownRef}>
          <div className="relative">
            <input
              id={name}
              name={name}
              type="text"
              value={searchQuery}
              placeholder={placeholder || `Select ${stageMrcFiles} MRC file`}
              disabled={disabled}
              onChange={(e) => {
                setSearchQuery(e.target.value);
                setShowDropdown(true);
                onChange(e.target.value);
              }}
              onFocus={() => { setShowDropdown(true); setActiveInputField(name); }}
              style={{ width: "280px", maxWidth: "280px", height: "32px", fontSize: "12px", paddingRight: showBrowseButton ? "32px" : "8px" }}
              className={`border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg-card)] focus:outline-none ${
                disabled ? "opacity-30 cursor-not-allowed" : ""
              }`}
            />
            {showBrowseButton && onBrowseClick && (
              <button
                type="button"
                onClick={(e) => { e.stopPropagation(); onBrowseClick(); }}
                disabled={disabled}
                className="absolute right-0 top-0 h-full px-2 flex items-center justify-center text-[var(--color-text-muted)] hover:text-[var(--color-text-secondary)] transition-colors"
                title="Browse project folder"
                style={{ background: "transparent", border: "none", boxShadow: "none", minWidth: "auto" }}
              >
                <PiBrowser style={{ fontSize: "14px" }} />
              </button>
            )}
          </div>
          {showDropdown && (
            <div className="absolute z-10 w-full min-w-[400px] mt-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded shadow max-h-60 overflow-y-auto no-scrollbar">
              {filesLoading ? (
                <p className="flex items-center text-[var(--color-text-heading)] font-medium m-0 p-2" style={{ fontSize: "12px" }}>
                  <BiLoader className="mr-2 animate-spin" />
                  Loading {stageMrcFiles} MRC files...
                </p>
              ) : fileList.length > 0 ? (
                fileList.map((group, groupIdx) => {
                  const isExpanded = expandedGroups[group.group];
                  return (
                    <div key={groupIdx} className="border-b border-[var(--color-border-light)] last:border-b-0">
                      <div
                        className="flex items-center gap-2 font-bold text-[var(--color-text-heading)] py-1 px-2 cursor-pointer hover:bg-[var(--color-bg)] select-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => toggleGroup(group.group)}
                      >
                        {isExpanded ? <FiChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <FiChevronRight size={14} className="text-[var(--color-text-muted)]" />}
                        {group.jobStatus === "success" ? (
                          <FiCheckCircle className="text-[var(--color-success-text)]" size={14} />
                        ) : group.jobStatus === "failed" ? (
                          <FiAlertCircle className="text-[var(--color-danger-text)]" size={14} />
                        ) : (
                          <FiClock className="text-[var(--color-warning-text)]" size={14} />
                        )}
                        <span className="flex-1">{group.group}</span>
                        <span className="text-xs text-[var(--color-text-muted)] font-normal">{group.files.length}</span>
                      </div>
                      {isExpanded && group.files.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleOptionClick(file.path)}
                          className="cursor-pointer px-2 py-1 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-heading)] flex items-center justify-between gap-2"
                          style={{ fontSize: "12px", paddingLeft: "28px" }}
                        >
                          <span className="flex-1 min-w-0" title={file.name || file.path}>{file.name || file.path}</span>
                          <div className="flex items-center gap-2 flex-shrink-0 text-xs text-[var(--color-text-secondary)]">
                            {file.iteration && <span>iter {file.iteration}</span>}
                            {file.classNum && <span>class {file.classNum}</span>}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)] p-2">
                  {stageMessage || `No ${stageMrcFiles} MRC files found. Run a ${stageMrcFiles} job first.`}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Stage Optimiser files dropdown for continuing stalled jobs
    // Shows _optimiser.star files from Class2D, Class3D, AutoRefine, InitialModel jobs
    else if (stageOptimiserFiles) {
      return (
        <div className="relative" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }} ref={dropdownRef}>
          <input
            id={name}
            name={name}
            type="text"
            value={searchQuery}
            placeholder={placeholder || `Select ${stageOptimiserFiles} optimiser file to continue`}
            disabled={disabled}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setShowDropdown(true);
              onChange(e.target.value);
            }}
            onFocus={() => { setShowDropdown(true); setActiveInputField(name); }}
            style={{ width: "280px", maxWidth: "280px", height: "32px", fontSize: "12px" }}
            className={`border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg-card)] focus:outline-none ${
              disabled ? "opacity-30 cursor-not-allowed" : ""
            }`}
          />
          {showDropdown && (
            <div className="absolute z-10 w-full mt-1 bg-[var(--color-bg-card)] border border-[var(--color-border)] rounded shadow max-h-60 overflow-y-auto no-scrollbar">
              {filesLoading ? (
                <p className="flex items-center text-[var(--color-text-heading)] font-medium m-0 p-2" style={{ fontSize: "12px" }}>
                  <BiLoader className="mr-2 animate-spin" />
                  Loading {stageOptimiserFiles} optimiser files...
                </p>
              ) : fileList.length > 0 ? (
                fileList.map((group, groupIdx) => {
                  const isExpanded = expandedGroups[group.group];
                  return (
                    <div key={groupIdx} className="border-b border-[var(--color-border-light)] last:border-b-0">
                      <div
                        className="flex items-center gap-2 font-bold text-[var(--color-text-heading)] py-1 px-2 cursor-pointer hover:bg-[var(--color-bg)] select-none"
                        style={{ fontSize: "12px" }}
                        onClick={() => toggleGroup(group.group)}
                      >
                        {isExpanded ? <FiChevronDown size={14} className="text-[var(--color-text-muted)]" /> : <FiChevronRight size={14} className="text-[var(--color-text-muted)]" />}
                        <FiClock className="text-[var(--color-primary)]" size={14} />
                        <span className="flex-1">{group.group}</span>
                        <span className="text-xs text-[var(--color-text-muted)] font-normal">{group.files.length}</span>
                      </div>
                      {isExpanded && group.files.map((file, idx) => (
                        <div
                          key={idx}
                          onClick={() => handleOptionClick(file.path)}
                          className="cursor-pointer px-2 py-1 hover:bg-[var(--color-bg-hover)] text-[var(--color-text-heading)] flex items-center justify-between"
                          style={{ fontSize: "12px", paddingLeft: "28px" }}
                        >
                          <span className="truncate">{file.name || file.path}</span>
                          <div className="flex items-center gap-2 ml-2 text-xs text-[var(--color-text-secondary)]">
                            {file.iteration && <span>iter {file.iteration}</span>}
                            {file.jobStatus && (
                              <span className={`${
                                file.jobStatus === "success" ? "text-[var(--color-success-text)]" :
                                file.jobStatus === "failed" ? "text-[var(--color-danger-text)]" :
                                "text-[var(--color-warning-text)]"
                              }`}>
                                {file.jobStatus}
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })
              ) : (
                <p className="text-xs text-[var(--color-text-secondary)] p-2">
                  {stageMessage || `No ${stageOptimiserFiles} optimiser files found. Run a ${stageOptimiserFiles} job first.`}
                </p>
              )}
            </div>
          )}
        </div>
      );
    }

    // Default plain input field
    else {
      return (
        <div className="relative flex items-center gap-2" style={{ width: "280px", minWidth: "280px", maxWidth: "280px" }}>
          <input
            id={name}
            name={name}
            type={type || "text"}
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            disabled={disabled}
            className="border border-[var(--color-border)] rounded px-2 bg-[var(--color-bg-card)] focus:outline-none"
            style={{
              width: "280px",
              maxWidth: "280px",
              height: "32px",
              fontSize: "12px",
              opacity: disabled ? 0.3 : 1,
              cursor: disabled ? "not-allowed" : "auto",
            }}
          />
          {showBrowseButton && onBrowseClick && (
            <button
              type="button"
              onClick={onBrowseClick}
              disabled={disabled}
              className={`h-9 px-2 border border-[var(--color-border)] rounded bg-[var(--color-bg)] hover:bg-[var(--color-bg-hover)] flex items-center justify-center transition-colors ${
                disabled ? "opacity-30 cursor-not-allowed" : ""
              }`}
              title="Browse project folder"
            >
              <PiBrowser className="text-[var(--color-text-secondary)] text-lg" />
            </button>
          )}
        </div>
      );
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div style={{ width: "30%" }}>
        <label style={{ textAlign: "left", opacity: disabled ? 0.3 : 1 }}>
          {label}
        </label>
      </div>
      <div className="flex items-center gap-[7px]">
        {renderInputField()}
        <div
          className="bg-[var(--color-bg-card)] p-[2px] rounded flex items-center justify-center cursor-pointer relative"
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <IoInformationCircleOutline className="text-[var(--color-text-muted)] text-sm" />
          {isTooltipVisible && (
            <div
              style={{
                position: "absolute",
                left: "calc(100% + 8px)",
                top: "50%",
                transform: "translateY(-50%)",
                backgroundColor: "var(--color-text-heading)",
                color: "var(--color-bg)",
                padding: "8px 10px",
                borderRadius: "6px",
                fontSize: "11px",
                lineHeight: "1.4",
                width: "220px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
              }}
            >
              {tooltipText}
              <div
                style={{
                  position: "absolute",
                  left: "-6px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  width: "0",
                  height: "0",
                  borderTop: "6px solid transparent",
                  borderBottom: "6px solid transparent",
                  borderRight: "6px solid var(--color-text-heading)",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CustomInput;
