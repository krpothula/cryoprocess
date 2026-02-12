import React, { useState } from "react";
import CustomDropdown from "../../common/Dropdown";
import SimpleInput from "../../common/SimpleInput";
import { FolderBrowserPopup } from "../../common/FolderBrowser";
import { PiBrowser } from "react-icons/pi";
import { IoInformationCircleOutline } from "react-icons/io5";

// Reusable component for file browse only (no text input)
const FileBrowseOnly = ({ label, name, value, onBrowse, tooltipText, disabled }) => {
  const [isTooltipVisible, setTooltipVisible] = useState(false);

  return (
    <div className="flex items-center gap-2">
      <div style={{ width: "30%" }}>
        <label style={{ textAlign: "left", opacity: disabled ? 0.3 : 1 }}>{label}</label>
      </div>
      <div className="flex items-center gap-[7px]">
        <div style={{ width: "280px", display: "flex", alignItems: "center" }}>
          <button
            type="button"
            onClick={onBrowse}
            disabled={disabled}
            style={{
              height: "32px",
              width: "100%",
              border: "1px solid #d1d5db",
              backgroundColor: "#ffffff",
              padding: "6px 10px",
              fontSize: "12px",
              borderRadius: "6px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              cursor: disabled ? "not-allowed" : "pointer",
              color: value ? "#1f2937" : "#9ca3af",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              textAlign: "left",
              opacity: disabled ? 0.3 : 1,
            }}
            title={value || "Browse ..."}
          >
            {value ? (
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{value}</span>
            ) : (
              <>
                <span style={{ flex: 1 }}>Browse ...</span>
                <PiBrowser style={{ color: "var(--color-text-label)", flexShrink: 0, fontSize: "14px" }} />
              </>
            )}
          </button>
        </div>
        <div
          style={{
            backgroundColor: "#fff",
            padding: "4px 4.4px",
            borderRadius: "4px",
            display: "grid",
            alignItems: "center",
            cursor: "pointer",
            position: "relative",
          }}
          onMouseEnter={() => setTooltipVisible(true)}
          onMouseLeave={() => setTooltipVisible(false)}
        >
          <IoInformationCircleOutline className="text-black text-xl" />
          {isTooltipVisible && (
            <div
              style={{
                position: "absolute",
                bottom: "calc(100% + 8px)",
                right: "0",
                backgroundColor: "#1e293b",
                color: "#f8fafc",
                padding: "10px 12px",
                borderRadius: "6px",
                fontSize: "12px",
                lineHeight: "1.5",
                width: "280px",
                maxWidth: "320px",
                boxShadow: "0 4px 12px rgba(0, 0, 0, 0.2)",
                zIndex: 1000,
              }}
            >
              {tooltipText}
              <div
                style={{
                  position: "absolute",
                  bottom: "-6px",
                  right: "8px",
                  width: "0",
                  height: "0",
                  borderLeft: "6px solid transparent",
                  borderRight: "6px solid transparent",
                  borderTop: "6px solid #1e293b",
                }}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Hmmer = ({
  handleInputChange,
  formData,
  handleRangeChange,
  dropdownOptions,
}) => {
  const [browserOpen, setBrowserOpen] = useState(false);
  const disableHmmerInputs = formData.performHmmerSearch === "No";

  const alphabetOptions = [
    { label: "amino", value: "amino" },
    { label: "DNA", value: "DNA" },
    { label: "RNA", value: "RNA" },
  ];

  const handleFileSelect = ({ path }) => {
    handleInputChange({ target: { name: "hmmerSequenceLibrary", value: path } });
    setBrowserOpen(false);
  };

  return (
    <div className="tab-content">
      <CustomDropdown
        label="Perform HMMer search?"
        options={dropdownOptions}
        value={formData.performHmmerSearch}
        name="performHmmerSearch"
        onChange={handleInputChange}
        tooltipText="Enable HMMER sequence search after model building. This will search your FASTA sequences against the built model to improve chain assignments and sequence matching."
      />

      <FileBrowseOnly
        label="Library with sequences for HMMer search:"
        name="hmmerSequenceLibrary"
        value={formData?.hmmerSequenceLibrary}
        onBrowse={() => setBrowserOpen(true)}
        tooltipText="Path to the sequence database/library for HMMER search. This should be a FASTA file containing reference sequences to match against your model."
        disabled={disableHmmerInputs}
      />

      <CustomDropdown
        label="Alphabet for the HMMer search:"
        options={alphabetOptions}
        value={formData.hmmerAlphabet}
        name="hmmerAlphabet"
        onChange={handleInputChange}
        tooltipText="Sequence alphabet type for HMMER search. Use 'amino' for protein sequences, 'DNA' for DNA, or 'RNA' for RNA sequences."
        disabled={disableHmmerInputs}
      />

      <SimpleInput
        label="HMMSearch F1:"
        placeholder="0.02"
        value={formData.hmmerF1}
        name="hmmerF1"
        onChange={handleInputChange}
        tooltipText="MSV filter threshold (F1). Controls the first filter stage sensitivity. Default 0.02. Lower values are more stringent, higher values more sensitive."
        disabled={disableHmmerInputs}
      />

      <SimpleInput
        label="HMMSearch F2:"
        placeholder="0.001"
        value={formData.hmmerF2}
        name="hmmerF2"
        onChange={handleInputChange}
        tooltipText="Viterbi filter threshold (F2). Controls the second filter stage. Default 0.001. Lower values are more stringent."
        disabled={disableHmmerInputs}
      />

      <SimpleInput
        label="HMMSearch F3:"
        placeholder="1e-05"
        value={formData.hmmerF3}
        name="hmmerF3"
        onChange={handleInputChange}
        tooltipText="Forward filter threshold (F3). Controls the third filter stage. Default 1e-05. Lower values are more stringent."
        disabled={disableHmmerInputs}
      />

      <SimpleInput
        label="HMMSearch E-value:"
        placeholder="10"
        value={formData.hmmerE}
        name="hmmerE"
        onChange={handleInputChange}
        tooltipText="E-value threshold for reporting hits. Default 10. Lower values report only more significant hits. Typical values: 10 (permissive), 1 (moderate), 0.01 (stringent)."
        disabled={disableHmmerInputs}
      />

      {/* Folder Browser Popup */}
      {browserOpen && (
        <FolderBrowserPopup
          onClose={() => setBrowserOpen(false)}
          onFileSelect={handleFileSelect}
          extensions=".fasta,.fa,.faa,.fna"
          title="Select Sequence Library for HMMer"
        />
      )}
    </div>
  );
};

export default Hmmer;
