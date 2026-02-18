import React, { useEffect, useState, useCallback, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiActivity,
  FiCheckCircle,
  FiAlertCircle,
  FiClock,
  FiTarget,
  FiTerminal,
  FiCopy,
  FiChevronDown,
  FiChevronUp,
  FiMove,
  FiUsers,
  FiLayers,
  FiCircle,
  FiDownload,
  FiImage,
} from "react-icons/fi";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import axiosInstance from "../../services/config";
import useJobNotification from "../../hooks/useJobNotification";

const API_BASE_URL = process.env.REACT_APP_API_HOST || "";

const getCTFRefineResultsApi = async (jobId) => {
  return axiosInstance.get(`${API_BASE_URL}/ctfrefine/results/?job_id=${jobId}`);
};

// Zernike polynomial names for display
const ODD_ZERNIKE_NAMES = [
  "Z1,-1 (Tilt Y)",
  "Z1,1 (Tilt X)",
  "Z3,-1 (Coma Y)",
  "Z3,1 (Coma X)",
  "Z3,-3 (Trefoil Y)",
  "Z3,3 (Trefoil X)",
];

const EVEN_ZERNIKE_NAMES = [
  "Z0,0 (Piston)",
  "Z2,-2 (Astig 45\u00b0)",
  "Z2,0 (Defocus)",
  "Z2,2 (Astig 0\u00b0)",
  "Z4,-4 (Tetrafoil)",
  "Z4,-2 (2nd Astig)",
  "Z4,0 (Spherical)",
  "Z4,2 (2nd Astig)",
  "Z4,4 (Tetrafoil)",
];

const CTFRefineDashboard = () => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showCommand, setShowCommand] = useState(false);
  const [commandCopied, setCommandCopied] = useState(false);

  const copyCommand = (cmd) => {
    if (cmd) {
      navigator.clipboard.writeText(cmd);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  const handlePdfDownload = () => {
    const url = `${API_BASE_URL}/ctfrefine/pdf/?job_id=${selectedJob?.id}`;
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selectedJob?.jobName || "ctfrefine"}_logfile.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  // Guard against state updates after unmount
  const mountedRef = useRef(true);
  useEffect(() => () => { mountedRef.current = false; }, []);

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getCTFRefineResultsApi(selectedJob.id);
      if (!mountedRef.current) return;
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load CTF refinement results");
      console.error("Error fetching results:", err);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, [selectedJob?.id]);

  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
    }
  }, [selectedJob?.id, fetchResults]);

  useEffect(() => {
    if (selectedJob?.status === "running") {
      const interval = setInterval(() => {
        fetchResults();
      }, 15000);
      return () => clearInterval(interval);
    }
  }, [selectedJob?.status, fetchResults]);

  // Trigger immediate fetch on WebSocket job_update (supplements polling)
  useJobNotification(selectedJob?.id, fetchResults);

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

  // Format beam tilt value
  const formatBeamTilt = (value) => {
    if (value === null || value === undefined) return "N/A";
    return `${value.toFixed(3)} mrad`;
  };

  // Get bar width for visualization (normalized to max)
  const getBarWidth = (value, maxAbs) => {
    if (maxAbs === 0) return 0;
    return Math.min(100, (Math.abs(value) / maxAbs) * 100);
  };

  // Build histogram chart data from backend response
  const buildChartData = (histogram) => {
    if (!histogram?.labels || !histogram?.counts) return [];
    return histogram.labels.map((label, i) => ({
      value: label,
      count: histogram.counts[i],
    }));
  };

  const CustomHistogramTooltip = ({ active, payload, unit }) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-[var(--color-bg-card)] p-2 rounded-lg shadow-lg border border-[var(--color-border)]">
          <p className="text-xs text-[var(--color-text-secondary)]">
            {payload[0]?.payload?.value?.toFixed(2)} {unit}
          </p>
          <p className="text-sm font-medium text-[var(--color-text-heading)]">
            {payload[0]?.value} particles
          </p>
        </div>
      );
    }
    return null;
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-[var(--color-text)] font-medium mt-4">
          Loading CTF refinement results...
        </p>
      </div>
    );
  }

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

  // Derive flags and stats from pipelineStats
  const ctfFitting = ["Yes", "yes", "true", true].includes(pStats.ctfFitting);
  const beamTiltEnabled = ["Yes", "yes", "true", true].includes(pStats.beamTiltEnabled);
  const anisoMag = ["Yes", "yes", "true", true].includes(pStats.anisoMag);

  // Calculate max values for Zernike bar charts
  const oddMax = results?.oddZernike?.length > 0
    ? Math.max(...results.oddZernike.map(Math.abs))
    : 1;
  const evenMax = results?.evenZernike?.length > 0
    ? Math.max(...results.evenZernike.map(Math.abs))
    : 1;

  // Prepare histogram data (only when CTF fitting was enabled)
  const defocusChartData = ctfFitting ? buildChartData(results?.defocusHistogram) : [];
  const astigChartData = ctfFitting ? buildChartData(results?.astigmatismHistogram) : [];

  return (
    <div className="pb-4 bg-[var(--color-bg-card)] min-h-screen">
      {/* Header */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "var(--color-text-heading)" }}>
                CtfRefine/{selectedJob?.jobName || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: status === "success"
                  ? "var(--color-success-text)"
                  : status === "failed"
                  ? "var(--color-danger-text)"
                  : "var(--color-warning)"
              }}>
                {status === "success"
                  ? "Success"
                  : status === "running"
                  ? "Running..."
                  : status === "pending"
                  ? "Pending"
                  : status === "failed"
                  ? "Error"
                  : status}
              </p>
            </div>
          </div>

          {/* PDF Download button */}
          {results?.hasPdf && (
            <button
              onClick={handlePdfDownload}
              className="flex items-center gap-1 px-3 py-1 bg-[var(--color-info-bg)] hover:bg-[var(--color-info-bg)] text-[var(--color-info-text)] rounded-lg transition-colors"
              style={{ fontSize: "12px" }}
              title="Download logfile PDF"
            >
              <FiDownload size={13} />
              PDF
            </button>
          )}
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
                onClick={() => copyCommand(command)}
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

      {/* Stats Card */}
      <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
        {/* Row 1: Always shown */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUsers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.particleCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiImage className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Micrographs:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--color-text-heading)" }}>
              {(pStats.micrographCount ?? 0).toLocaleString()}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>CTF Fitting:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: ctfFitting ? "var(--color-success-text)" : "var(--color-text-heading)" }}>
              {ctfFitting ? "Yes" : "No"}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <FiMove className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
              <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Beam Tilt:</span>
              <span style={{ fontSize: "12px", fontWeight: 600, color: beamTiltEnabled ? "var(--color-success-text)" : "var(--color-text-heading)" }}>
                {beamTiltEnabled ? "Yes" : "No"}
              </span>
            </div>
            {beamTiltEnabled && (
              <div style={{ fontSize: "10px", color: "var(--color-text-muted)", marginTop: "2px", paddingLeft: "22px" }}>
                X: {formatBeamTilt(pStats.beamTiltX)}
                {" / "}
                Y: {formatBeamTilt(pStats.beamTiltY)}
              </div>
            )}
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-[var(--color-text-muted)] flex-shrink-0" size={14} />
            <span style={{ fontSize: "12px", color: "var(--color-text-secondary)" }}>Aniso Mag:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: anisoMag ? "var(--color-success-text)" : "var(--color-text-heading)" }}>
              {anisoMag ? "Yes" : "No"}
            </span>
          </div>
        </div>
      </div>

      {/* Distribution Charts — only when CTF Fitting is enabled */}
      {ctfFitting && (defocusChartData.length > 0 || astigChartData.length > 0) && (
        <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiActivity className="text-blue-500" size={13} />
            Particle Distributions
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Defocus Distribution */}
            {defocusChartData.length > 0 && (
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-medium">
                  Defocus Distribution ({"μm"})
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={defocusChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                      <XAxis
                        dataKey="value"
                        tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                        tickFormatter={(v) => (v / 10000).toFixed(1)}
                        tickLine={{ stroke: "var(--color-chart-grid)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                        tickLine={{ stroke: "var(--color-chart-grid)" }}
                      />
                      <Tooltip content={<CustomHistogramTooltip unit="\u00c5" />} />
                      <Bar dataKey="count" fill="#3b82f6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}

            {/* Astigmatism Distribution */}
            {astigChartData.length > 0 && (
              <div>
                <p className="text-xs text-[var(--color-text-secondary)] mb-2 font-medium">
                  Astigmatism Distribution (|{"Δ"}Defocus| {"Å"})
                </p>
                <div className="h-48">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={astigChartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-chart-grid)" />
                      <XAxis
                        dataKey="value"
                        tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                        tickFormatter={(v) => v.toFixed(0)}
                        tickLine={{ stroke: "var(--color-chart-grid)" }}
                      />
                      <YAxis
                        tick={{ fontSize: 9, fill: "var(--color-text-secondary)" }}
                        tickLine={{ stroke: "var(--color-chart-grid)" }}
                      />
                      <Tooltip content={<CustomHistogramTooltip unit="\u00c5" />} />
                      <Bar dataKey="count" fill="#8b5cf6" radius={[2, 2, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Aberration Analysis - Odd Zernike (Asymmetric) — only when Beam Tilt is enabled */}
      {beamTiltEnabled && results?.oddZernike?.length > 0 && (
        <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiCircle className="text-purple-500" size={13} />
            Asymmetric Aberrations (Odd Zernike)
            <span className="text-xs font-normal text-[var(--color-text-muted)] ml-2">
              Beam tilt, coma, trefoil
            </span>
          </h3>
          <div className="space-y-2">
            {results.oddZernike.map((value, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-xs text-[var(--color-text-secondary)] truncate" title={ODD_ZERNIKE_NAMES[idx] || `Z${idx}`}>
                  {ODD_ZERNIKE_NAMES[idx] || `Coeff ${idx + 1}`}
                </div>
                <div className="flex-1 h-6 bg-[var(--color-bg-hover)] rounded relative overflow-hidden">
                  <div
                    className={`h-full ${value >= 0 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-danger)]'} absolute`}
                    style={{
                      width: `${getBarWidth(value, oddMax)}%`,
                      left: value >= 0 ? '50%' : `${50 - getBarWidth(value, oddMax)}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-[var(--color-border)]" />
                  </div>
                </div>
                <div className={`w-24 text-right text-sm font-mono px-2 py-1 rounded ${
                  value === 0
                    ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    : value > 0
                    ? 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
                    : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
                }`}>
                  {value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aberration Analysis - Even Zernike (Symmetric) */}
      {results?.evenZernike?.length > 0 && (
        <div className="bg-[var(--color-bg-card)] p-4 border-b border-[var(--color-border)]">
          <h3 className="font-bold text-[var(--color-text)] mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiCircle className="text-blue-500" size={13} />
            Symmetric Aberrations (Even Zernike)
            <span className="text-xs font-normal text-[var(--color-text-muted)] ml-2">
              Defocus, astigmatism, spherical aberration
            </span>
          </h3>
          <div className="space-y-2">
            {results.evenZernike.map((value, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-xs text-[var(--color-text-secondary)] truncate" title={EVEN_ZERNIKE_NAMES[idx] || `Z${idx}`}>
                  {EVEN_ZERNIKE_NAMES[idx] || `Coeff ${idx + 1}`}
                </div>
                <div className="flex-1 h-6 bg-[var(--color-bg-hover)] rounded relative overflow-hidden">
                  <div
                    className={`h-full ${value >= 0 ? 'bg-[var(--color-primary)]' : 'bg-[var(--color-danger)]'} absolute`}
                    style={{
                      width: `${getBarWidth(value, evenMax)}%`,
                      left: value >= 0 ? '50%' : `${50 - getBarWidth(value, evenMax)}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-[var(--color-border)]" />
                  </div>
                </div>
                <div className={`w-24 text-right text-sm font-mono px-2 py-1 rounded ${
                  value === 0
                    ? 'bg-[var(--color-bg-hover)] text-[var(--color-text-secondary)]'
                    : value > 0
                    ? 'bg-[var(--color-info-bg)] text-[var(--color-info-text)]'
                    : 'bg-[var(--color-danger-bg)] text-[var(--color-danger-text)]'
                }`}>
                  {value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default CTFRefineDashboard;
