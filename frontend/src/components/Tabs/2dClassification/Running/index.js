import SlurmRunningConfig from "../../common/SlurmRunningConfig";
import { JOB_COMPUTE_PROFILES } from "../../common/Data/jobs";

const Running = ({
  formData,
  handleInputChange,
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
        computeProfile={JOB_COMPUTE_PROFILES.class_2d}
        disableMpi={formData.useVDAM === "Yes"}
      />
    </div>
  );
};

export default Running;
