import React, { useEffect, useState, useCallback } from "react";
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
  FiSettings,
  FiZap,
  FiMove,
  FiUsers,
  FiLayers,
  FiCircle,
} from "react-icons/fi";
import axiosInstance from "../../services/config";

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
  "Z2,-2 (Astig 45°)",
  "Z2,0 (Defocus)",
  "Z2,2 (Astig 0°)",
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

  const copyCommand = () => {
    if (selectedJob?.command) {
      navigator.clipboard.writeText(selectedJob.command);
      setCommandCopied(true);
      setTimeout(() => setCommandCopied(false), 2000);
    }
  };

  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getCTFRefineResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load CTF refinement results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
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

  const getStatusIcon = (status) => {
    switch (status) {
      case "success":
        return <FiCheckCircle className="text-green-500 text-xl" />;
      case "running":
        return <FiActivity className="text-blue-500 text-xl animate-pulse" />;
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

  // Format defocus value (convert from Angstrom to microns)
  const formatDefocus = (value) => {
    if (value === null || value === undefined) return "N/A";
    return `${(value / 10000).toFixed(2)} μm`;
  };

  // Get color for Zernike value (red for negative, blue for positive)
  const getZernikeColor = (value) => {
    if (value === 0) return "bg-gray-100";
    if (value > 0) return "bg-blue-100 text-blue-800";
    return "bg-red-100 text-red-800";
  };

  // Get bar width for visualization (normalized to max)
  const getBarWidth = (value, maxAbs) => {
    if (maxAbs === 0) return 0;
    return Math.min(100, (Math.abs(value) / maxAbs) * 100);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black font-medium mt-4">
          Loading CTF refinement results...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] bg-red-50 m-4 rounded">
        <FiAlertCircle className="text-red-500 text-4xl" />
        <p className="text-lg text-red-600 font-medium mt-4">{error}</p>
      </div>
    );
  }

  // Calculate max values for bar charts
  const oddMax = results?.odd_zernike?.length > 0
    ? Math.max(...results.odd_zernike.map(Math.abs))
    : 1;
  const evenMax = results?.even_zernike?.length > 0
    ? Math.max(...results.even_zernike.map(Math.abs))
    : 1;

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {getStatusIcon(selectedJob?.status)}
            <div>
              <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                CtfRefine/{selectedJob?.job_name || "Job"}
              </h2>
              <p style={{
                fontSize: "12px",
                fontWeight: 500,
                color: selectedJob?.status === "success"
                  ? "#16a34a"
                  : selectedJob?.status === "error"
                  ? "#dc2626"
                  : selectedJob?.status === "running"
                  ? "#f59e0b"
                  : "#ca8a04"
              }}>
                {selectedJob?.status === "success"
                  ? "Success"
                  : selectedJob?.status === "running"
                  ? "Running..."
                  : selectedJob?.status === "pending"
                  ? "Pending"
                  : selectedJob?.status === "error"
                  ? "Error"
                  : selectedJob?.status}
              </p>
            </div>
          </div>
        </div>

        {/* RELION Command Section */}
        <div className="mt-3 pt-3 border-t">
          <div className="flex items-center justify-between">
            <button
              onClick={() => setShowCommand(!showCommand)}
              className="flex items-center gap-2 hover:bg-gray-50 rounded px-1 py-0.5 transition-colors"
            >
              <FiTerminal className="text-gray-400" size={12} />
              <span style={{ fontSize: "12px", fontWeight: 500, color: "#64748b" }}>RELION Command</span>
              {showCommand ? (
                <FiChevronUp className="text-gray-400" size={12} />
              ) : (
                <FiChevronDown className="text-gray-400" size={12} />
              )}
            </button>
            {showCommand && selectedJob?.command && (
              <button
                onClick={copyCommand}
                className="flex items-center gap-1 px-2 py-1 hover:bg-gray-100 rounded transition-colors"
                title="Copy command"
              >
                <FiCopy className="text-gray-400" size={12} />
                {commandCopied && (
                  <span style={{ fontSize: "10px", color: "#16a34a" }}>Copied!</span>
                )}
              </button>
            )}
          </div>
          {showCommand && (
            <div
              className="mt-2 overflow-x-auto font-mono"
              style={{
                fontSize: '9px',
                color: '#475569',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                lineHeight: '1.4'
              }}
            >
              {selectedJob?.command || "Command not available for this job"}
            </div>
          )}
        </div>
      </div>

      {/* Stats Card - Merged */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiUsers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {results?.particle_count?.toLocaleString() || "0"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMove className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Beam Tilt X:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {formatBeamTilt(results?.beam_tilt_x)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiMove className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Beam Tilt Y:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {formatBeamTilt(results?.beam_tilt_y)}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiTarget className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Mean Defocus:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
              {formatDefocus(results?.defocus_mean)}
            </span>
          </div>
        </div>
      </div>

      {/* Aberration Analysis - Odd Zernike (Asymmetric) */}
      {results?.odd_zernike?.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiCircle className="text-purple-500" />
            Asymmetric Aberrations (Odd Zernike)
            <span className="text-xs font-normal text-gray-400 ml-2">
              Beam tilt, coma, trefoil
            </span>
          </h3>
          <div className="space-y-2">
            {results.odd_zernike.map((value, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600 truncate" title={ODD_ZERNIKE_NAMES[idx] || `Z${idx}`}>
                  {ODD_ZERNIKE_NAMES[idx] || `Coeff ${idx + 1}`}
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded relative overflow-hidden">
                  <div
                    className={`h-full ${value >= 0 ? 'bg-blue-400' : 'bg-red-400'} absolute`}
                    style={{
                      width: `${getBarWidth(value, oddMax)}%`,
                      left: value >= 0 ? '50%' : `${50 - getBarWidth(value, oddMax)}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-300" />
                  </div>
                </div>
                <div className={`w-24 text-right text-sm font-mono px-2 py-1 rounded ${getZernikeColor(value)}`}>
                  {value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Aberration Analysis - Even Zernike (Symmetric) */}
      {results?.even_zernike?.length > 0 && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiCircle className="text-blue-500" />
            Symmetric Aberrations (Even Zernike)
            <span className="text-xs font-normal text-gray-400 ml-2">
              Defocus, astigmatism, spherical aberration
            </span>
          </h3>
          <div className="space-y-2">
            {results.even_zernike.map((value, idx) => (
              <div key={idx} className="flex items-center gap-3">
                <div className="w-32 text-xs text-gray-600 truncate" title={EVEN_ZERNIKE_NAMES[idx] || `Z${idx}`}>
                  {EVEN_ZERNIKE_NAMES[idx] || `Coeff ${idx + 1}`}
                </div>
                <div className="flex-1 h-6 bg-gray-100 rounded relative overflow-hidden">
                  <div
                    className={`h-full ${value >= 0 ? 'bg-blue-400' : 'bg-red-400'} absolute`}
                    style={{
                      width: `${getBarWidth(value, evenMax)}%`,
                      left: value >= 0 ? '50%' : `${50 - getBarWidth(value, evenMax)}%`,
                    }}
                  />
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-px h-full bg-gray-300" />
                  </div>
                </div>
                <div className={`w-24 text-right text-sm font-mono px-2 py-1 rounded ${getZernikeColor(value)}`}>
                  {value.toFixed(2)}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Defocus Statistics */}
      {results?.defocus_mean && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiLayers className="text-blue-500" />
            Defocus Statistics
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Mean:</span>
              <span className="ml-2 font-medium">{formatDefocus(results?.defocus_mean)}</span>
            </div>
            <div>
              <span className="text-gray-500">Min:</span>
              <span className="ml-2 font-medium">{formatDefocus(results?.defocus_min)}</span>
            </div>
            <div>
              <span className="text-gray-500">Max:</span>
              <span className="ml-2 font-medium">{formatDefocus(results?.defocus_max)}</span>
            </div>
            <div>
              <span className="text-gray-500">Std Dev:</span>
              <span className="ml-2 font-medium">{formatDefocus(results?.defocus_std)}</span>
            </div>
          </div>
        </div>
      )}

      {/* Microscope Parameters */}
      {(results?.voltage || results?.spherical_aberration || results?.pixel_size) && (
        <div className="bg-white rounded-lg p-4 shadow-sm">
          <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
            <FiSettings className="text-gray-500" />
            Microscope Parameters
          </h3>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
            {results?.voltage && (
              <div>
                <span className="text-gray-500">Voltage:</span>
                <span className="ml-2 font-medium">{results.voltage} kV</span>
              </div>
            )}
            {results?.spherical_aberration && (
              <div>
                <span className="text-gray-500">Cs:</span>
                <span className="ml-2 font-medium">{results.spherical_aberration} mm</span>
              </div>
            )}
            {results?.pixel_size && (
              <div>
                <span className="text-gray-500">Pixel Size:</span>
                <span className="ml-2 font-medium">{results.pixel_size} Å</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Refinement Settings */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiSettings className="text-blue-500" />
          Refinement Settings
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiTarget className="text-blue-500" />
              <span className="text-sm font-medium text-gray-600">CTF Fitting</span>
            </div>
            <span className="text-xl font-bold text-gray-800">
              {results?.do_defocus_refine === "Yes" ? "Enabled" : "Disabled"}
            </span>
            {results?.do_defocus_refine === "Yes" && (
              <p className="text-xs text-gray-500 mt-1">
                Min res: {results?.min_res_defocus || 30}Å
              </p>
            )}
          </div>

          <div className="bg-purple-50 border border-purple-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiMove className="text-purple-500" />
              <span className="text-sm font-medium text-gray-600">Beam Tilt</span>
            </div>
            <span className="text-xl font-bold text-gray-800">
              {results?.do_beam_tilt === "Yes" ? "Enabled" : "Disabled"}
            </span>
          </div>

          <div className="bg-orange-50 border border-orange-100 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <FiZap className="text-orange-500" />
              <span className="text-sm font-medium text-gray-600">Higher-Order Aberrations</span>
            </div>
            <div className="text-sm text-gray-700">
              <span className={results?.do_trefoil === "Yes" ? "text-green-600" : "text-gray-400"}>
                Trefoil {results?.do_trefoil === "Yes" ? "Yes" : "No"}
              </span>
              <span className={`ml-3 ${results?.do_4th_order === "Yes" ? "text-green-600" : "text-gray-400"}`}>
                4th Order {results?.do_4th_order === "Yes" ? "Yes" : "No"}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Output Status */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiCheckCircle className="text-blue-500" />
          Output Status
        </h3>
        <div className="flex flex-wrap items-center gap-4">
          {results?.has_output ? (
            <div className="flex items-center gap-2 text-green-600">
              <FiCheckCircle />
              <span>Refined particles star file available</span>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-yellow-600">
              <FiClock />
              <span>Processing...</span>
            </div>
          )}
          {results?.has_aberration_plots && (
            <div className="flex items-center gap-2 text-green-600">
              <FiCheckCircle />
              <span>Aberration plots available</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CTFRefineDashboard;
