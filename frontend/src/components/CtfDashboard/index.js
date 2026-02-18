import React, { useEffect, useState, useCallback, useMemo, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import {
  getCTFResultsApi,
  getCTFImageWithCacheApi,
  exportCTFSelectionApi,
  getMicrographImageApi,
} from "../../services/builders/ctf/ctf";
import { getJobProgress } from "../../services/jobs";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiList,
  FiFilter,
  FiSave,
  FiImage,
  FiZoomIn,
  FiZoomOut,
} from "react-icons/fi";
import MicrographList from "./MicrographList";
import MicrographViewer from "./MicrographViewer";
import CTFParameterHistogram from "./CTFParameterHistogram";
import useJobNotification from "../../hooks/useJobNotification";
import useJobProgress from "../../hooks/useJobProgress";

const CtfDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [liveStats, setLiveStats] = useState(null);
  const [results, setResults] = useState(null);
  const [selectedMicrograph, setSelectedMicrograph] = useState(null);
  const [powerSpectrumImage, setPowerSpectrumImage] = useState(null);
  const [micrographImage, setMicrographImage] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);
  const [viewerZoom, setViewerZoom] = useState(1);
  const [activeImageTab, setActiveImageTab] = useState("micrograph");

  // Zoom controls
  const handleZoomIn = () => setViewerZoom((z) => Math.min(z + 0.25, 3));
  const handleZoomOut = () => setViewerZoom((z) => Math.max(z - 0.25, 0.5));

  // Selection and filtering state
  const [selectedMicrographs, setSelectedMicrographs] = useState(new Set());

  // Initialize filters from localStorage if available
  const getInitialFilters = () => {
    try {
      if (selectedJob?.id) {
        const saved = localStorage.getItem(`ctf_filters_${selectedJob.id}`);
        if (saved) return JSON.parse(saved);
      }
    } catch (e) { /* private browsing or corrupt data */ }
    return {
      maxResolution: null,
      minFOM: null,
      maxAstigmatism: null,
      minDefocus: null,
      maxDefocus: null,
    };
  };

  const [filters, setFilters] = useState(getInitialFilters);

  // Export state
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(null);

  // Load filters from localStorage when job changes
  useEffect(() => {
    if (selectedJob?.id) {
      try {
        const saved = localStorage.getItem(`ctf_filters_${selectedJob.id}`);
        if (saved) {
          setFilters(JSON.parse(saved));
          return;
        }
      } catch (e) { /* private browsing or corrupt data */ }
      // Reset filters for new job with no saved filters
      setFilters({
        maxResolution: null,
        minFOM: null,
        maxAstigmatism: null,
        minDefocus: null,
        maxDefocus: null,
      });
    }
  }, [selectedJob?.id]);

  // Auto-save filters to localStorage when they change
  useEffect(() => {
    if (selectedJob?.id) {
      // Check if any filter is set (not all null)
      const hasFilters = Object.values(filters).some(v => v !== null);
      if (hasFilters) {
        try { localStorage.setItem(`ctf_filters_${selectedJob.id}`, JSON.stringify(filters)); } catch (e) { /* private browsing */ }
      }
    }
  }, [filters, selectedJob?.id]);

  // Clear all filters
  const clearFilters = () => {
    const emptyFilters = {
      maxResolution: null,
      minFOM: null,
      maxAstigmatism: null,
      minDefocus: null,
      maxDefocus: null,
    };
    setFilters(emptyFilters);
    try { if (selectedJob?.id) localStorage.removeItem(`ctf_filters_${selectedJob.id}`); } catch (e) { /* ignore */ }
  };

  // Copy command to clipboard
  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getCTFResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load CTF estimation results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  // Fetch progress stats (for running jobs)
  const fetchLiveStats = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      const response = await getJobProgress(selectedJob.id);
      if (response?.data?.success && response?.data?.data) {
        const progressData = response.data.data;
        setLiveStats(progressData);
        setError(null);

        // If job just completed, refresh results
        if (progressData.status === "success" && selectedJob?.status === "running") {
          fetchResults();
        }
      }
    } catch (err) {
      console.error("Error fetching progress:", err);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults]);

  // Fetch power spectrum image for selected micrograph
  const fetchPowerSpectrum = useCallback(async (micrographName) => {
    if (!selectedJob?.id || !micrographName) return;

    try {
      const response = await getCTFImageWithCacheApi(selectedJob.id, micrographName);
      if (response?.data?.status === "success") {
        setPowerSpectrumImage(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching power spectrum:", err);
      setPowerSpectrumImage(null);
    }
  }, [selectedJob?.id]);

  // Fetch micrograph image for selected micrograph
  const fetchMicrographImage = useCallback(async (micrographName) => {
    if (!selectedJob?.id || !micrographName) return;

    try {
      const response = await getMicrographImageApi(selectedJob.id, micrographName);
      if (response?.data?.status === "success") {
        setMicrographImage(response.data.data);
      }
    } catch (err) {
      console.error("Error fetching micrograph image:", err);
      setMicrographImage(null);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
      fetchLiveStats();

      // Poll for live stats if job is running
      const interval = setInterval(() => {
        if (selectedJob?.status === "running") {
          fetchLiveStats();
        }
      }, 5000);

      return () => clearInterval(interval);
    }
  }, [selectedJob?.id, selectedJob?.status, fetchResults, fetchLiveStats]);

  // Fetch power spectrum and micrograph image when micrograph is selected
  useEffect(() => {
    if (selectedMicrograph) {
      fetchPowerSpectrum(selectedMicrograph);
      fetchMicrographImage(selectedMicrograph);
    }
  }, [selectedMicrograph, fetchPowerSpectrum, fetchMicrographImage]);

  // Reset zoom when micrograph changes
  useEffect(() => {
    setViewerZoom(1);
  }, [selectedMicrograph]);

  // Auto-select first micrograph when data loads
  useEffect(() => {
    if (results?.micrographs?.length > 0 && !selectedMicrograph) {
      const firstMic = results.micrographs[0];
      if (firstMic?.micrographName) {
        setSelectedMicrograph(firstMic.micrographName);
      }
    }
  }, [results?.micrographs, selectedMicrograph]);

  // Apply filters to ALL micrographs (for accurate filter counts)
  const filteredMicrographs = useMemo(() => {
    const micrographs = results?.micrographs || [];

    // If no micrographs, return empty
    if (micrographs.length === 0) {
      return [];
    }

    return micrographs.filter((m) => {
      if (filters.maxResolution !== null && m.maxResolution > filters.maxResolution) {
        return false;
      }

      if (filters.minFOM !== null && m.figureOfMerit < filters.minFOM) {
        return false;
      }

      if (filters.maxAstigmatism !== null) {
        const astigmatism = Math.abs((m.defocusU || 0) - (m.defocusV || 0));
        if (astigmatism > filters.maxAstigmatism) {
          return false;
        }
      }

      const defocusAvg = (m.defocusU != null && m.defocusV != null) ? (m.defocusU + m.defocusV) / 2 : null;
      if (filters.minDefocus != null && defocusAvg != null && defocusAvg < filters.minDefocus) {
        return false;
      }
      if (filters.maxDefocus != null && defocusAvg != null && defocusAvg > filters.maxDefocus) {
        return false;
      }

      return true;
    });
  }, [results?.micrographs, filters]);

  // Toggle micrograph selection
  const toggleSelection = (micName) => {
    const newSet = new Set(selectedMicrographs);
    if (newSet.has(micName)) {
      newSet.delete(micName);
    } else {
      newSet.add(micName);
    }
    setSelectedMicrographs(newSet);
  };

  // Direct save filtered micrographs (without modal)
  const handleSaveFiltered = async () => {
    if (!selectedJob?.id || filteredMicrographs.length === 0) return;

    setIsSaving(true);
    setSaveSuccess(null);

    try {
      const micrographNames = filteredMicrographs.map((m) => m.micrographName);
      const filename = `filtered_micrographs_ctf_${filteredMicrographs.length}.star`;
      const response = await exportCTFSelectionApi(
        selectedJob.id,
        micrographNames,
        filename
      );

      if (response.data?.status === "success") {
        setSaveSuccess({
          status: "success",
          message: `Saved ${response.data.data?.selectedCount} micrographs to ${response.data.data?.filename}`,
          data: response.data.data
        });
        // Auto-hide success message after 5 seconds
        setTimeout(() => setSaveSuccess(null), 5000);
      }
    } catch (err) {
      console.error("Save failed:", err);
      setSaveSuccess({
        status: "error",
        message: err.response?.data?.message || "Save failed",
      });
      setTimeout(() => setSaveSuccess(null), 5000);
    } finally {
      setIsSaving(false);
    }
  };

  // Trigger immediate fetch on WebSocket job_update (supplements polling)
  useJobNotification(selectedJob?.id, fetchResults);
  const wsProgress = useJobProgress(selectedJob?.id);

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-amber-500 text-xl animate-pulse" />;
      case "failed":
      case "error":
        return <FiAlertCircle className="text-red-500 text-xl" />;
      default:
        return <FiClock className="text-yellow-500 text-xl" />;
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading CTF estimation results...
        </p>
      </div>
    );
  }

  // All micrographs — react-window virtualizes the list so 20K items scrolls fine
  const allMicrographs = results?.micrographs || [];
  const totalMicrographs = allMicrographs.length;

  const pStats = selectedJob?.pipelineStats || {};
  const params = selectedJob?.parameters || {};
  const status = selectedJob?.status;
  const command = selectedJob?.command || "";

  if (error && status !== "running" && status !== "pending") {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-[var(--color-danger-bg)] m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-[var(--color-danger-text)] font-medium mt-4">{error}</p>
      </div>
    );
  }

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                CtfEstimation/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success" ? "var(--color-success-text)"
                  : status === "failed" ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {status === "success" ? "Success"
                  : status === "running" ? "Running..."
                  : status === "pending" ? "Pending"
                  : status === "failed" ? "Error"
                  : status}
              </p>
            </div>
          </div>

        </div>

        {/* RELION Command Section */}
        <div className="mt-3 pt-3 border-t border-[var(--color-border)] -mx-4 px-4">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-[var(--color-bg)] rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-[var(--color-text-muted)]" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--color-text-secondary)" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-[var(--color-text-muted)]" size={12} />
              ) : (
                <FiChevronDown className="text-[var(--color-text-muted)]" size={12} />
              )}
            </button>
            {showCommand && command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-[var(--color-bg-hover)] rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-[var(--color-text-muted)]" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "var(--color-success-text)" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: 'var(--color-text-secondary)',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.4'
              }}
            >
              {command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card — DB only */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiImage className="text-[var(--color-text-muted)]" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {liveStats?.processed ?? wsProgress?.micrographCount ?? pStats.micrographCount ?? 0}/{liveStats?.total ?? wsProgress?.micrographCount ?? pStats.micrographCount ?? 0}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Power Spectra:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {["No", "no", "false", false].includes(params.usePowerSpectraFromMotionCorr) ? "No" : "Yes"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Exhaustive Search:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {["Yes", "yes", "true", true].includes(params.useExhaustiveSearch) ? "Yes" : "No"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>FFT Box Size:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {params.fftBoxSize ?? 512}
            </span>
          </div>
        </div>
      </div>

      {/* Main Content - Two Column Layout */}
      <div className="flex border-b border-[var(--color-border)] overflow-hidden" style={{ height: "411px" }}>
          {/* Micrograph List */}
          <div className="flex-1 min-w-0 border-r border-[var(--color-border)] flex flex-col">
            <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
              <FiList className="text-[var(--color-text-muted)]" size={13} />
              <span className="text-xs font-bold text-[var(--color-text-secondary)]">Processed Micrographs</span>
            </div>
            <div className="flex-1 min-h-0">
              <MicrographList
                micrographs={allMicrographs}
                latestMicrographs={liveStats?.latestMicrographs}
                selectedMicrograph={selectedMicrograph}
                onSelect={setSelectedMicrograph}
                selectedMicrographs={selectedMicrographs}
                onToggleSelection={toggleSelection}
                selectionMode={false}
              />
            </div>
          </div>

          {/* Micrograph and Power Spectrum Viewer - Square */}
          <div className="bg-[var(--color-bg-card)] flex flex-col" style={{ width: "411px", flexShrink: 0 }}>
            <div className="px-3 py-2 border-b border-[var(--color-border-light)] flex items-center gap-2 flex-shrink-0">
              <FiImage className="text-[var(--color-text-muted)]" size={13} />
              <span className="text-xs font-bold text-[var(--color-text-secondary)]">Viewer</span>
              <button onClick={handleZoomOut} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded ml-1" title="Zoom Out">
                <FiZoomOut className="text-[var(--color-text-secondary)]" size={12} />
              </button>
              <span className="text-[9px] text-[var(--color-text-secondary)]">{Math.round(viewerZoom * 100)}%</span>
              <button onClick={handleZoomIn} className="p-0.5 hover:bg-[var(--color-bg-hover)] rounded" title="Zoom In">
                <FiZoomIn className="text-[var(--color-text-secondary)]" size={12} />
              </button>
              {/* Image type tabs */}
              <div className="flex bg-[var(--color-bg)] rounded p-0.5 ml-auto">
                <button
                  onClick={() => setActiveImageTab("micrograph")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                    activeImageTab === "micrograph"
                      ? "bg-[var(--color-bg-card)] text-[var(--color-info-text)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Micrograph
                </button>
                <button
                  onClick={() => setActiveImageTab("spectrum")}
                  className={`px-2 py-0.5 text-[10px] rounded transition-all ${
                    activeImageTab === "spectrum"
                      ? "bg-[var(--color-bg-card)] text-[var(--color-info-text)] shadow-sm"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text)]"
                  }`}
                >
                  Power Spectrum
                </button>
              </div>
            </div>
            <div className="flex-1 min-h-0 relative">
              <MicrographViewer
                micrographImage={micrographImage}
                powerSpectrumImage={powerSpectrumImage}
                selectedMicrograph={selectedMicrograph}
                micrographData={allMicrographs.find(m => m.micrographName === selectedMicrograph)}
                zoom={viewerZoom}
                activeTab={activeImageTab}
              />
            </div>
          </div>
      </div>

      {/* Select Best Micrographs Section */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-bold text-[var(--color-text-heading)] flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiFilter className="text-green-500" size={13} />
            Select Best Micrographs
          </h3>
          <button
            onClick={clearFilters}
            className="text-[var(--color-primary)] hover:text-[var(--color-primary-hover)]"
            style={{ fontSize: "12px" }}
          >
            Reset Filters
          </button>
        </div>
        <div className="flex items-center gap-4">
          {/* 1. Defocus Range Inputs */}
          <div className="flex items-center gap-2">
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", fontWeight: 500, textTransform: "uppercase", letterSpacing: "0.05em" }}>Defocus (Å)</span>
            <input
              type="number"
              placeholder="Min"
              value={filters.minDefocus != null ? Math.round(filters.minDefocus) : ""}
              onChange={(e) => setFilters({ ...filters, minDefocus: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-20 px-2 py-1 border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-primary-light)]"
              style={{ fontSize: '12px' }}
            />
            <span style={{ fontSize: "11px", color: "var(--color-border-hover)" }}>—</span>
            <input
              type="number"
              placeholder="Max"
              value={filters.maxDefocus != null ? Math.round(filters.maxDefocus) : ""}
              onChange={(e) => setFilters({ ...filters, maxDefocus: e.target.value ? parseFloat(e.target.value) : null })}
              className="w-20 px-2 py-1 border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-border-focus)] focus:ring-1 focus:ring-[var(--color-primary-light)]"
              style={{ fontSize: '12px' }}
            />
          </div>

          {/* 2. Micrograph Count */}
          <div className="flex items-center gap-1">
            <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--color-primary)", fontFamily: "monospace" }}>{filteredMicrographs.length.toLocaleString()}</span>
            <span style={{ fontSize: "12px", color: "var(--color-text-muted)", fontWeight: 500 }}>/</span>
            <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--color-text-secondary)", fontFamily: "monospace" }}>{totalMicrographs.toLocaleString()}</span>
            <span style={{ fontSize: "11px", color: "var(--color-text-muted)", marginLeft: "2px" }}>micrographs</span>
          </div>

          {/* 3. Save Button */}
          <button
            onClick={handleSaveFiltered}
            disabled={filteredMicrographs.length === 0 || isSaving}
            className={`flex items-center gap-2 px-5 py-1.5 font-semibold rounded-lg transition-all flex-shrink-0 ${
              filteredMicrographs.length > 0 && !isSaving
                ? "bg-[var(--color-primary)] text-white hover:bg-[var(--color-primary-hover)] shadow-sm"
                : "bg-[var(--color-bg)] text-[var(--color-text-muted)] cursor-not-allowed"
            }`}
            style={{ fontSize: "12px" }}
            title="Save filtered micrographs to STAR file"
          >
            {isSaving ? (
              <>
                <BiLoader className="animate-spin" size={13} />
                <span>Saving...</span>
              </>
            ) : (
              <>
                <FiSave size={13} />
                <span>Save Selection</span>
              </>
            )}
          </button>

          {/* 4. Saved Filename */}
          {saveSuccess && (
            <div className={`flex items-center gap-1.5 ${
              saveSuccess.status === "success" ? "text-[var(--color-success)]" : "text-[var(--color-danger)]"
            }`}>
              {saveSuccess.status === "success" ? (
                <FiCheckCircle size={12} />
              ) : (
                <FiAlertCircle size={12} />
              )}
              <span style={{ fontSize: "11px", fontFamily: "monospace" }}>
                {saveSuccess.data?.filename || saveSuccess.message}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Parameter Distribution Histograms - 4 side by side */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <CTFParameterHistogram
          micrographs={allMicrographs}
          paramKey="defocusAvg"
          title="Defocus Range"
          unit="Å"
          color="blue"
          rangeFilter
          filterMinValue={filters.minDefocus}
          filterMaxValue={filters.maxDefocus}
          onFilterMinChange={(val) => setFilters(f => ({ ...f, minDefocus: val != null ? Math.round(val) : null }))}
          onFilterMaxChange={(val) => setFilters(f => ({ ...f, maxDefocus: val != null ? Math.round(val) : null }))}
        />
        <CTFParameterHistogram
          micrographs={allMicrographs}
          paramKey="maxResolution"
          title="Resolution (lower is better)"
          unit="Å"
          color="green"
          filterValue={filters.maxResolution}
          filterType="max"
          onFilterChange={(val) => setFilters(f => ({ ...f, maxResolution: val }))}
        />
        <CTFParameterHistogram
          micrographs={allMicrographs}
          paramKey="figureOfMerit"
          title="Figure of Merit (higher is better)"
          unit=""
          color="purple"
          filterValue={filters.minFOM}
          filterType="min"
          onFilterChange={(val) => setFilters(f => ({ ...f, minFOM: val }))}
        />
        <CTFParameterHistogram
          micrographs={allMicrographs}
          paramKey="astigmatism"
          title="Astigmatism (lower is better)"
          unit="Å"
          color="orange"
          filterValue={filters.maxAstigmatism}
          filterType="max"
          onFilterChange={(val) => setFilters(f => ({ ...f, maxAstigmatism: val }))}
        />
      </div>
    </div>
  );
};

export default CtfDashboard;
