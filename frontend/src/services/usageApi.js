import axiosInstance from "./config";

/**
 * Get usage report
 * @param {object} params - { startDate, endDate, groupBy }
 */
export const getUsageReport = (params = {}) => {
  const query = new URLSearchParams(params).toString();
  return axiosInstance.get(`/api/admin/usage?${query}`);
};

/**
 * Download usage report as CSV
 */
export const downloadUsageCsv = (params = {}) => {
  const query = new URLSearchParams({ ...params, format: 'csv' }).toString();
  return axiosInstance.get(`/api/admin/usage?${query}`, { responseType: 'blob' })
    .then((resp) => {
      const url = window.URL.createObjectURL(new Blob([resp.data]));
      const link = document.createElement('a');
      link.href = url;
      link.download = 'usage-report.csv';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(url);
    });
};
