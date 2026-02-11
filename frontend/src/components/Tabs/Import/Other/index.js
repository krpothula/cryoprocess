import React from "react";
import CustomDropdown from "../../common/Dropdown";
import CustomInput from "../../common/Input";
import SimpleInput from "../../common/SimpleInput";

const Other = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
  nodeOptions,
  setFilePopup,
}) => {
  const isNodeTypeYes = formData.nodetype === "Yes";
  return (
    <div className="tab-content">
      <CustomDropdown
        label="Import other node types?"
        onChange={handleInputChange}
        options={dropdownOptions}
        name="nodetype"
        value={formData.nodetype}
        tooltipText="Import existing reference maps, masks, or particle stacks from previous RELION projects or external sources."
        // disabled={true}
      />
      {/*
      <CustomInput
        label="Input file:"
        name="otherInputFile"
        placeholder="ref.mrc"
        disabled={!isNodeTypeYes}
        tooltipText="otherInputFile"
        onChange={handleInputChange}
      /> */}

      <CustomInput
        isCustomUpload={true}
        onChange={() => {
          setFilePopup("otherInputFile");
        }}
        name="otherInputFile"
        label="Input file:"
        placeholder="Browse to select a file..."
        tooltipText="Browse to select a file from your project folder. The file type depends on your Node type selection: 3D reference/mask (.mrc), 2D references (.mrcs), or particle coordinates (.star)."
        value={formData?.["otherInputFile"]}
        disabled={!isNodeTypeYes}
      />

      <CustomDropdown
        label="Node type:"
        onChange={handleInputChange}
        options={nodeOptions}
        name="otherNodeType"
        value={formData.otherNodeType}
        disabled={!isNodeTypeYes}
        tooltipText="Specify what type of file you're importing: 2D references, 3D reference map, 3D mask, particle coordinates, or particle stack."
      />
      <SimpleInput
        label="Rename optics group for particles:"
        name="renameopticsgroup"
        onChange={handleInputChange}
        value={formData.renameopticsgroup}
        tooltipText="Optionally rename the optics group when importing particles. Useful when merging datasets from different microscope sessions."
        placeholder=""
        disabled={!isNodeTypeYes}
      />
    </div>
  );
};

export default Other;
