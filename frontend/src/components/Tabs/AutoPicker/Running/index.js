import SlurmRunningConfig from "../../common/SlurmRunningConfig";
import { JOB_COMPUTE_PROFILES } from "../../common/Data/jobs";

const Running = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  return (
    <div className="tab-content">
      <SlurmRunningConfig
        formData={formData}
        handleInputChange={handleInputChange}
        handleRangeChange={handleRangeChange}
        dropdownOptions={dropdownOptions}
        computeProfile={JOB_COMPUTE_PROFILES.auto_picking}
      />
    </div>
  );
};

export default Running;
