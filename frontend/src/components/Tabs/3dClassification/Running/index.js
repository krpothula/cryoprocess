import SlurmRunningConfig from "../../common/SlurmRunningConfig";
import { JOB_COMPUTE_PROFILES } from "../../common/Data/jobs";

const Running = ({ formData, handleInputChange, handleRangeChange, dropdownOptions }) => {
  return (
    <div className="tab-content">
      <SlurmRunningConfig
        formData={formData}
        handleInputChange={handleInputChange}
        handleRangeChange={handleRangeChange}
        dropdownOptions={dropdownOptions}
        computeProfile={JOB_COMPUTE_PROFILES.class_3d}
      />
    </div>
  );
};

export default Running;
