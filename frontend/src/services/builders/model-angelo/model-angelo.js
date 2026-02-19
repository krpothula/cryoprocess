import axiosInstance from "../../config";

const modelAngeloAPI = (payload = {}) => {
  // Use unified jobs API endpoint
  return axiosInstance.post(`/api/jobs/model_angelo/`, payload);
};

const saveFastaSequenceApi = (projectId, fastaType, sequenceText, filename) => {
  return axiosInstance.post('/api/jobs/save-fasta', {
    projectId,
    fastaType,
    sequenceText,
    filename,
  });
};

export { modelAngeloAPI, saveFastaSequenceApi };
