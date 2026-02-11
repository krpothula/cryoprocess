import React, { useEffect, useState, useRef } from "react";
import { useBuilder } from "../../context/BuilderContext";
import { BiLoader } from "react-icons/bi";
import {
  FiImage,
  FiMaximize2,
} from "react-icons/fi";
import axiosInstance from "../../services/config";

const MovieViewer = ({ selectedFile, importType, zoom = 1, onToggleFullscreen }) => {
  const { selectedJob } = useBuilder();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [thumbnailUrl, setThumbnailUrl] = useState(null);
  const [fullscreen, setFullscreen] = useState(false);
  const imageRef = useRef(null);

  const jobId = selectedJob?.id;

  // Get thumbnail for selected file
  useEffect(() => {
    if (!selectedFile || !jobId) {
      setThumbnailUrl(null);
      return;
    }

    // Check if file has pre-generated thumbnail
    if (selectedFile.thumbnail_url) {
      setLoading(true);
      setError(null);

      const url = selectedFile.thumbnail_url;
      axiosInstance.get(url, { responseType: 'blob' })
        .then(response => {
          const imageUrl = URL.createObjectURL(response.data);
          setThumbnailUrl(imageUrl);
          setError(null);
        })
        .catch(err => {
          console.error("Error loading thumbnail:", err);
          setError("Thumbnail not available");
          setThumbnailUrl(null);
        })
        .finally(() => {
          setLoading(false);
        });
    } else {
      setThumbnailUrl(null);
      setError("No thumbnail available");
    }

    return () => {
      if (thumbnailUrl) {
        URL.revokeObjectURL(thumbnailUrl);
      }
    };
  }, [selectedFile, jobId]);

  const toggleFullscreen = () => {
    setFullscreen(!fullscreen);
    if (onToggleFullscreen) onToggleFullscreen();
  };

  // Empty state - no file selected
  if (!selectedFile) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-400 bg-gray-50">
        <FiImage className="text-4xl mb-3" />
        <p className="text-center text-sm">Select a file to view</p>
      </div>
    );
  }

  // Loading state
  if (loading) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-50">
        <BiLoader className="animate-spin text-blue-500 text-3xl" />
        <p className="text-gray-600 mt-2 text-sm">Loading image...</p>
      </div>
    );
  }

  // Error state
  if (error || !thumbnailUrl) {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center bg-yellow-50">
        <FiImage className="text-yellow-400 text-3xl" />
        <p className="text-yellow-600 mt-2 text-sm">{error || "No preview available"}</p>
      </div>
    );
  }

  if (fullscreen) {
    return (
      <div className="fixed inset-0 z-50 bg-black flex flex-col">
        <div className="absolute top-2 right-2 z-10 flex items-center gap-1 bg-gray-900/80 rounded-lg px-2 py-1">
          <span className="text-xs text-white min-w-[40px] text-center">
            {Math.round(zoom * 100)}%
          </span>
          <button
            onClick={toggleFullscreen}
            className="p-1 hover:bg-gray-700 rounded ml-1"
            title="Exit Fullscreen"
          >
            <FiMaximize2 className="text-white" size={14} />
          </button>
        </div>
        <img
          ref={imageRef}
          src={thumbnailUrl}
          alt={selectedFile?.name || "Preview"}
          style={{
            display: "block",
            width: "100%",
            height: "100%",
            objectFit: "cover",
            transform: `scale(${zoom})`,
            transformOrigin: "center",
            transition: "transform 0.2s ease",
          }}
        />
        <button
          onClick={toggleFullscreen}
          className="absolute top-4 left-4 text-white bg-gray-800 hover:bg-gray-700 px-3 py-1 rounded"
        >
          Close
        </button>
      </div>
    );
  }

  return (
    <div className="absolute inset-0 overflow-hidden bg-white">
      <img
        ref={imageRef}
        src={thumbnailUrl}
        alt={selectedFile?.name || "Preview"}
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
    </div>
  );
};

export default MovieViewer;
