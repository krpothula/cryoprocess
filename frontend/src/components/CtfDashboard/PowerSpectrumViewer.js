import React from "react";
import { FiImage, FiTarget } from "react-icons/fi";
import { BiLoader } from "react-icons/bi";

const PowerSpectrumViewer = ({ imageData, selectedMicrograph, micrographData }) => {
  if (!selectedMicrograph) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
        <FiImage className="text-5xl mb-3" />
        <p className="text-center">
          Select a micrograph to view
          <br />
          its power spectrum
        </p>
      </div>
    );
  }

  if (!imageData) {
    return (
      <div className="h-80 flex flex-col items-center justify-center text-gray-400 bg-gray-50 rounded-lg">
        <BiLoader className="text-4xl animate-spin text-blue-500 mb-3" />
        <p className="text-sm">Loading power spectrum...</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Power Spectrum Image */}
      <div className="relative bg-gray-900 rounded-lg overflow-hidden">
        <img
          src={imageData.image}
          alt={`Power spectrum for ${selectedMicrograph}`}
          className="w-full h-auto"
          style={{ maxHeight: "400px", objectFit: "contain" }}
        />

        {/* Overlay with CTF rings indicator */}
        <div className="absolute bottom-2 left-2 bg-black/60 px-2 py-1 rounded text-xs text-white">
          {imageData.width} x {imageData.height} px
        </div>
      </div>

      {/* Quick Info */}
      {micrographData && (
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-blue-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FiTarget className="text-blue-500" />
              <span className="text-xs text-gray-500">Defocus</span>
            </div>
            <p className="text-lg font-semibold text-gray-800 mt-1">
              {micrographData.defocus_avg?.toLocaleString() || "N/A"}
              <span className="text-sm text-gray-500 ml-1">A</span>
            </p>
          </div>

          <div className="bg-green-50 rounded-lg p-3">
            <div className="flex items-center gap-2">
              <FiImage className="text-green-500" />
              <span className="text-xs text-gray-500">Resolution</span>
            </div>
            <p className="text-lg font-semibold text-gray-800 mt-1">
              {micrographData.ctf_max_resolution?.toFixed(2) || "N/A"}
              <span className="text-sm text-gray-500 ml-1">A</span>
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default PowerSpectrumViewer;
