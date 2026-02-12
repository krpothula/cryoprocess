import React, { useRef, useState, useEffect } from "react";
import { BiLoader } from "react-icons/bi";
import { FiImage } from "react-icons/fi";

const MicrographViewer = ({ imageData, loading, selectedMicrograph, zoom = 1, circleRadius = 50, showPicks = true }) => {
  const imgRef = useRef(null);
  const [imgDimensions, setImgDimensions] = useState({ width: 0, height: 0, naturalWidth: 0, naturalHeight: 0 });

  // Update dimensions when image loads
  const handleImageLoad = (e) => {
    const img = e.target;
    setImgDimensions({
      width: img.width,
      height: img.height,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight
    });
  };

  // Recalculate on zoom change
  useEffect(() => {
    if (imgRef.current) {
      const img = imgRef.current;
      setImgDimensions({
        width: img.width,
        height: img.height,
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight
      });
    }
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

  // Calculate scale factor for coordinates
  const originalWidth = imageData.original_width || imgDimensions.naturalWidth || 1;
  const originalHeight = imageData.original_height || imgDimensions.naturalHeight || 1;

  const scaleX = imgDimensions.width > 0 ? imgDimensions.width / originalWidth : 1;
  const scaleY = imgDimensions.height > 0 ? imgDimensions.height / originalHeight : 1;

  const coordinates = imageData.coordinates || [];
  const radius = imageData.radius || circleRadius;

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
            onLoad={handleImageLoad}
            style={{
              maxWidth: "100%",
              maxHeight: "100%",
              objectFit: "cover",
              display: "block"
            }}
          />
          {/* SVG overlay for particle picks */}
          {showPicks && coordinates.length > 0 && imgDimensions.width > 0 && (
            <svg
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: imgDimensions.width,
                height: imgDimensions.height,
                pointerEvents: "none"
              }}
              viewBox={`0 0 ${imgDimensions.width} ${imgDimensions.height}`}
            >
              {coordinates.map((coord, idx) => {
                const x = coord.x * scaleX;
                const y = coord.y * scaleY;
                const scaledRadius = radius * scaleX;

                return (
                  <circle
                    key={idx}
                    cx={x}
                    cy={y}
                    r={scaledRadius}
                    fill="none"
                    stroke="#00FF00"
                    strokeWidth={2}
                    opacity={0.8}
                  />
                );
              })}
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
