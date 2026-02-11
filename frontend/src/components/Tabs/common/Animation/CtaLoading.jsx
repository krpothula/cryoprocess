import React from "react";

const CtaLoading = () => {
  return (
    <div className="flex items-center justify-center space-x-2">
      <div className="w-5 h-5 border-2 border-t-4 border-white border-solid rounded-full animate-spin border-t-primary"></div>
      <span className="text-base text-white">Loading...</span>
    </div>
  );
};

export default CtaLoading;
