import axiosInstance from "./config";

/**
 * Fetch software configuration from .env file
 * Returns paths for MOTIONCOR2, CTFFIND, GCTF, RELION, etc.
 */
export const getSoftwareConfig = async () => {
  return axiosInstance.get("/api/software-config/");
};
