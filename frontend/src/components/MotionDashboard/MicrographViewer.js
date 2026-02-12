import React, { useEffect, useState } from "react";
import {
  getMicrographImageWithCacheApi,
} from "../../services/builders/motion/motion";
import { BiLoader } from "react-icons/bi";
import { FiImage } from "react-icons/fi";

const MicrographViewer = ({ jobId, micrograph, shiftData, zoom = 1, activeTab = "micrograph" }) => {
  const [loading, setLoading] = useState(false);
  const [imageData, setImageData] = useState(null);
  const [powerSpectrumData, setPowerSpectrumData] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!jobId || !micrograph) {
      setImageData(null);
      setPowerSpectrumData(null);
      return;
    }

    const fetchImages = async () => {
      setLoading(true);
      setError(null);

      // Fetch micrograph image - handle independently
      try {
        const micrographResponse = await getMicrographImageWithCacheApi(
          jobId,
          micrograph,
          "micrograph"
        );

        if (micrographResponse?.data?.status === "success") {
          setImageData(micrographResponse.data.data);
        } else {
          setImageData(null);
        }
      } catch (err) {
        console.warn("Micrograph image not available:", err.message);
        setImageData(null);
      }

      // Fetch power spectrum - handle independently (may not exist for all jobs)
      try {
        const psResponse = await getMicrographImageWithCacheApi(
          jobId,
          micrograph,
          "power_spectrum"
        );

        if (psResponse?.data?.status === "success") {
          setPowerSpectrumData(psResponse.data.data);
        } else {
          setPowerSpectrumData(null);
        }
      } catch (err) {
        // Power spectrum may not exist - this is not an error
        console.debug("Power spectrum not available:", err.message);
        setPowerSpectrumData(null);
      }

      setLoading(false);
    };

    fetchImages();
  }, [jobId, micrograph]);

  if (!micrograph) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900">
        <FiImage className="text-4xl mb-3" />
        <p className="text-center text-sm">Select a micrograph to view</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50 dark:bg-slate-900">
        <BiLoader className="animate-spin text-blue-500 text-3xl" />
        <p className="text-gray-600 dark:text-slate-300 mt-2 text-sm">Loading image...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-red-50 dark:bg-red-900/30">
        <FiImage className="text-red-400 text-3xl" />
        <p className="text-red-600 dark:text-red-400 mt-2 text-sm">{error}</p>
      </div>
    );
  }

  const currentImage = activeTab === "micrograph" ? imageData : powerSpectrumData;

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ backgroundColor: "var(--color-bg-card)" }}>
      {currentImage?.image ? (
        <img
          src={currentImage.image}
          alt={`${activeTab} - ${micrograph}`}
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.2s ease",
          }}
        />
      ) : (
        <div className="absolute inset-0 flex items-center justify-center text-gray-500 dark:text-slate-400">
          <p>
            {activeTab === "micrograph"
              ? "Micrograph image not available"
              : "Power spectrum not available"}
          </p>
        </div>
      )}
    </div>
  );
};

export default MicrographViewer;
