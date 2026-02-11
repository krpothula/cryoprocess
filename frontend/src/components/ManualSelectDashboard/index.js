import React, { useEffect, useState, useCallback } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { getManualSelectResultsApi } from "../../services/builders/manual-select/manual-select";
import axiosInstance from "../../services/config";
import { BiLoader } from "react-icons/bi";
import {
  FiCheckCircle,
  FiAlertCircle,
  FiLayers,
  FiGrid,
} from "react-icons/fi";

const ManualSelectDashboard = () => {
  const { selectedJob, projectId } = useBuilder();
  const [loading, setLoading] = useState(true);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [classes, setClasses] = useState([]);
  const [classesLoading, setClassesLoading] = useState(false);

  // Fetch results
  const fetchResults = useCallback(async () => {
    if (!selectedJob?.id) return;

    try {
      setLoading(true);
      const response = await getManualSelectResultsApi(selectedJob.id);
      if (response?.data?.status === "success") {
        setResults(response.data.data);
        setError(null);
      }
    } catch (err) {
      setError("Failed to load selection results");
      console.error("Error fetching results:", err);
    } finally {
      setLoading(false);
    }
  }, [selectedJob?.id]);

  // Fetch class images from source job
  const fetchClassImages = useCallback(async () => {
    if (!results?.source_star_file || !projectId) return;

    setClassesLoading(true);
    try {
      let jobPath = results.source_star_file;

      if (jobPath.startsWith('/')) {
        const parts = jobPath.split('/');
        const classIdx = parts.findIndex(p => p.startsWith('Class') || p === 'InitialModel');
        if (classIdx !== -1) {
          jobPath = parts.slice(classIdx).join('/');
        }
      }

      const url = `/class2d/individual-images/?project_id=${projectId}&job_path=${encodeURIComponent(jobPath)}&iteration=latest`;
      const response = await axiosInstance.get(url);

      if (response.data.status === "success") {
        setClasses(response.data.data.classes || []);
      }
    } catch (err) {
      console.error("Error fetching class images:", err);
    } finally {
      setClassesLoading(false);
    }
  }, [results?.source_star_file, projectId]);

  useEffect(() => {
    if (selectedJob?.id) {
      fetchResults();
    }
  }, [selectedJob?.id, fetchResults]);

  useEffect(() => {
    if (results?.source_star_file) {
      fetchClassImages();
    }
  }, [results?.source_star_file, fetchClassImages]);

  const selectedClassSet = new Set(results?.selected_classes || []);
  const numSelected = results?.num_classes_selected || results?.selected_classes?.length || 0;

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh]">
        <BiLoader className="animate-spin text-primary text-4xl" />
        <p className="text-lg text-black font-medium mt-4">
          Loading class selection results...
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

  return (
    <div className="pt-2 pb-4 space-y-2 bg-white min-h-screen">
      {/* Header */}
      {(() => {
        // Use status from results API (most current) or fallback to selectedJob
        const jobStatus = results?.job_status || selectedJob?.status || 'pending';
        return (
          <div className="bg-white rounded-lg p-4 shadow-sm">
            <div className="flex items-center gap-3">
              {jobStatus === "success" ? (
                <FiCheckCircle className="text-green-500 text-xl" />
              ) : jobStatus === "error" || jobStatus === "failed" ? (
                <FiAlertCircle className="text-red-500 text-xl" />
              ) : (
                <FiCheckCircle className="text-yellow-500 text-xl" />
              )}
              <div>
                <h2 style={{ fontSize: "12px", fontWeight: 700, color: "#1e293b" }}>
                  Select/{results?.job_name || selectedJob?.job_name || "Job"}
                </h2>
                <p style={{
                  fontSize: "12px",
                  fontWeight: 500,
                  color: jobStatus === "success"
                    ? "#16a34a"
                    : jobStatus === "error" || jobStatus === "failed"
                    ? "#dc2626"
                    : jobStatus === "running"
                    ? "#f59e0b"
                    : "#ca8a04"
                }}>
                  {jobStatus === "success"
                    ? "Success"
                    : jobStatus === "running"
                    ? "Running..."
                    : jobStatus === "pending"
                    ? "Pending"
                    : jobStatus === "error" || jobStatus === "failed"
                    ? "Error"
                    : jobStatus}
                </p>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Stats Card - Merged */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FiGrid className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Classes Selected:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#7c3aed" }}>
              {numSelected} / {classes.length || "?"}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <FiLayers className="text-gray-400" size={14} />
            <span style={{ fontSize: "12px", color: "#64748b" }}>Total Particles:</span>
            <span style={{ fontSize: "12px", fontWeight: 600, color: "#16a34a" }}>
              {results?.particle_count?.toLocaleString() || 0}
            </span>
          </div>
        </div>
      </div>

      {/* Class Images Grid */}
      <div className="bg-white rounded-lg p-4 shadow-sm">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2" style={{ fontSize: "12px" }}>
          <FiGrid className="text-violet-500" />
          Class Selection ({numSelected} of {classes.length} selected)
        </h3>

        {classesLoading ? (
          <div className="flex items-center justify-center py-12">
            <BiLoader className="animate-spin text-violet-500 text-2xl mr-2" />
            <span className="text-gray-500">Loading class images...</span>
          </div>
        ) : classes.length > 0 ? (
          <div className="class-images-grid">
            {classes.map((cls) => {
              const isSelected = selectedClassSet.has(cls.class_number);
              return (
                <div
                  key={cls.class_number}
                  className={`class-image-card ${isSelected ? 'selected' : 'not-selected'}`}
                >
                  <div className="class-image-wrapper">
                    <img src={cls.image} alt={`Class ${cls.class_number}`} />
                    {isSelected && (
                      <div className="selected-badge">
                        <FiCheckCircle />
                      </div>
                    )}
                    {!isSelected && (
                      <div className="not-selected-overlay" />
                    )}
                  </div>
                  <div className="class-image-info">
                    <span className="class-number">#{cls.class_number}</span>
                    <span className="class-particles">{cls.distribution?.toFixed(1) || cls.particle_fraction?.toFixed(1) || '0'}%</span>
                    <span className="class-resolution">{cls.resolution?.toFixed(1) || cls.estimated_resolution?.toFixed(1) || '-'}Å</span>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            <p>Class images not available</p>
            {results?.selected_classes?.length > 0 && (
              <p className="text-sm mt-1">Selected classes: {results.selected_classes.join(', ')}</p>
            )}
          </div>
        )}
      </div>


      <style>{`
        .class-images-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(100px, 1fr));
          gap: 8px;
          max-height: 600px;
          overflow-y: auto;
          padding: 8px;
          background: #f8fafc;
          border-radius: 8px;
        }

        .class-image-card {
          position: relative;
          border-radius: 6px;
          overflow: hidden;
          transition: all 0.2s ease;
        }

        .class-image-card.selected {
          border: 3px solid #10b981;
          box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
        }

        .class-image-card.not-selected {
          border: 2px solid #e2e8f0;
          opacity: 0.6;
        }

        .class-image-card.not-selected:hover {
          opacity: 0.8;
        }

        .class-image-wrapper {
          position: relative;
          background: #1e293b;
        }

        .class-image-wrapper img {
          width: 100%;
          height: auto;
          display: block;
        }

        .selected-badge {
          position: absolute;
          top: 4px;
          right: 4px;
          background: #10b981;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          box-shadow: 0 2px 4px rgba(0,0,0,0.2);
        }

        .not-selected-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0, 0, 0, 0.3);
        }

        .class-image-info {
          display: flex;
          flex-direction: row;
          justify-content: space-between;
          padding: 4px 6px;
          background: #1e293b;
          font-size: 9px;
        }

        .class-image-card.selected .class-image-info {
          background: #064e3b;
        }

        .class-number {
          color: white;
          font-weight: 600;
        }

        .class-particles {
          color: #10b981;
        }

        .class-resolution {
          color: #60a5fa;
        }

        .class-image-card.not-selected .class-number {
          color: #94a3b8;
        }

        .class-image-card.not-selected .class-particles {
          color: #64748b;
        }

        .class-image-card.not-selected .class-resolution {
          color: #64748b;
        }
      `}</style>
    </div>
  );
};

export default ManualSelectDashboard;
