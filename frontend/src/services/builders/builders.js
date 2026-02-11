import axiosInstance from "../config";

const importBuilderApi = (payload = {}) => {
  return axiosInstance.post(`/api/import/`, payload);
};

export { importBuilderApi };
