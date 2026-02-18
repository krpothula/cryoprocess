import React from "react";
import { FiImage } from "react-icons/fi";
import { BiLoader } from "react-icons/bi";

const MicrographViewer = ({
  micrographImage,
  powerSpectrumImage,
  selectedMicrograph,
  micrographData,
  zoom = 1,
  activeTab = "micrograph"
}) => {
  if (!selectedMicrograph) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-[var(--color-text-muted)] bg-[var(--color-bg)]">
        <FiImage className="text-4xl mb-3" />
        <p className="text-center text-sm">Select a micrograph to view</p>
      </div>
    );
  }

  const currentImage = activeTab === "micrograph" ? micrographImage : powerSpectrumImage;
  const isLoading = !currentImage;

  if (isLoading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-[var(--color-bg)]">
        <BiLoader className="animate-spin text-blue-500 text-3xl" />
        <p className="text-[var(--color-text-secondary)] mt-2 text-sm">Loading image...</p>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-[var(--color-bg-card)]">
      {currentImage?.image ? (
        <img
          src={currentImage.image}
          alt={`${activeTab} - ${selectedMicrograph}`}
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
        <div className="absolute inset-0 flex items-center justify-center text-[var(--color-text-secondary)]">
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
