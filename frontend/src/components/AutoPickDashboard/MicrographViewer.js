import React, { useRef, useState, useEffect } from "react";
import { BiLoader } from "react-icons/bi";
import { FiImage } from "react-icons/fi";

/**
 * MicrographViewer with SVG overlay for autopick particle markers.
 *
 * Coordinate system:
 *   RELION autopick coordinates (_rlnCoordinateX/Y) are in **MRC pixels**
 *   of the motion-corrected micrograph. The backend returns original_width
 *   and original_height (MRC header nx/ny) so the SVG viewBox can map
 *   directly from MRC-pixel space to the displayed thumbnail.
 *
 * Circle sizing:
 *   circleDiameterA (Angstroms) / pixelSize (Å/px) → radius in MRC pixels.
 */
const MicrographViewer = ({
  imageData,
  loading,
  selectedMicrograph,
  zoom = 1,
  circleDiameterA = 200,
  pixelSize = null,
  showPicks = true,
}) => {
  const imgRef = useRef(null);
  const [imgSize, setImgSize] = useState({ w: 0, h: 0 });

  // Track rendered image size (needed to size the SVG overlay exactly)
  const updateImgSize = () => {
    if (imgRef.current) {
      setImgSize({ w: imgRef.current.width, h: imgRef.current.height });
    }
  };

  useEffect(() => {
    updateImgSize();
  }, [zoom, imageData]);

  if (!selectedMicrograph) {
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

  if (!imageData?.image) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 dark:text-slate-500 bg-gray-50 dark:bg-slate-900">
        <FiImage className="text-4xl mb-3" />
        <p className="text-center text-sm">Could not load micrograph image</p>
      </div>
    );
  }

  // MRC dimensions (full-size micrograph that coordinates reference)
  const mrcW = imageData.original_width || 1;
  const mrcH = imageData.original_height || 1;

  // Convert Å diameter → MRC-pixel radius
  const effectivePixelSize = pixelSize || imageData.pixel_size || 1;
  const radiusMrcPx = (circleDiameterA / 2) / effectivePixelSize;

  // Stroke width: ~2 screen-px equivalent in MRC-pixel space
  const strokeMrcPx = Math.max(1, mrcW / 400);

  const coordinates = imageData.coordinates || [];

  return (
    <div className="absolute inset-0 overflow-hidden" style={{ position: "absolute" }}>
      <div
        className="h-full w-full flex items-center justify-center"
        style={{ position: "relative", backgroundColor: "var(--color-bg-card)" }}
      >
        <div
          style={{
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.2s ease",
            position: "relative",
            display: "inline-block",
            maxWidth: "100%",
            maxHeight: "100%",
          }}
        >
          <img
            ref={imgRef}
            src={imageData.image}
            alt={`Micrograph ${selectedMicrograph}`}
            onLoad={updateImgSize}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              display: "block",
            }}
          />
          {/* SVG overlay — viewBox in MRC-pixel space, auto-scales to match thumbnail */}
          {showPicks && coordinates.length > 0 && imgSize.w > 0 && (
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: imgSize.w,
                height: imgSize.h,
                pointerEvents: "none",
              }}
              viewBox={`0 0 ${mrcW} ${mrcH}`}
              preserveAspectRatio="xMidYMid meet"
            >
              {coordinates.map((coord, idx) => (
                <circle
                  key={idx}
                  cx={coord.x}
                  cy={coord.y}
                  r={radiusMrcPx}
                  fill="none"
                  stroke="#00FF00"
                  strokeWidth={strokeMrcPx}
                  opacity={0.8}
                />
              ))}
            </svg>
          )}
        </div>
      </div>
      {/* Particle count indicator */}
      {coordinates.length > 0 && (
        <div className="absolute bottom-2 right-2 bg-black bg-opacity-60 text-white text-xs px-2 py-1 rounded">
          {coordinates.length} particles
        </div>
      )}
    </div>
  );
};

export default MicrographViewer;
