import SlurmRunningConfig from "../../common/SlurmRunningConfig";

const Running = ({ formData, handleInputChange, handleRangeChange, dropdownOptions }) => {
  return (
    <div className="tab-content">
      <SlurmRunningConfig
        formData={formData}
        handleInputChange={handleInputChange}
        handleRangeChange={handleRangeChange}
        dropdownOptions={dropdownOptions}
        computeProfile={{ tier: 'local', defaultMpi: 1, defaultGpu: 0, defaultThreads: 1 }}
      />
    </div>
  );
};

export default Running;
